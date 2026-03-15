/**
 * PayPal Billing API
 * 
 * Handles PayPal subscription management, payment processing,
 * and billing operations using PayPal REST API
 */

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const paypal = require('@paypal/checkout-server-sdk');
const { 
  SubscriptionPlan, 
  Subscription, 
  Invoice, 
  PaymentMethod, 
  BillingAnalytics 
} = require('./billing-schema');

const router = express.Router();

// PayPal Configuration - Load from environment variables
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalEnv = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID;

if (!paypalClientId || !paypalClientSecret) {
  console.error('? PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment variables.');
  // Don't throw error here - let individual routes handle it
}

const environment = paypalClientId && paypalClientSecret
  ? (paypalEnv === 'live'
      ? new paypal.core.LiveEnvironment(paypalClientId, paypalClientSecret)
      : new paypal.core.SandboxEnvironment(paypalClientId, paypalClientSecret))
  : null;

const client = environment ? new paypal.core.PayPalHttpClient(environment) : null;

const getPayPalBaseUrl = () => (
  paypalEnv === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
);

async function getPayPalAccessToken() {
  if (!paypalClientId || !paypalClientSecret) {
    throw new Error('PayPal credentials not configured');
  }
  const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
  const response = await axios.post(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data.access_token;
}

async function verifyPayPalWebhook(event, headers) {
  if (!paypalWebhookId) {
    return { verified: false, skipped: true, reason: 'PAYPAL_WEBHOOK_ID not configured' };
  }
  const requiredHeaders = {
    transmissionId: headers['paypal-transmission-id'],
    transmissionTime: headers['paypal-transmission-time'],
    transmissionSig: headers['paypal-transmission-sig'],
    certUrl: headers['paypal-cert-url'],
    authAlgo: headers['paypal-auth-algo']
  };
  if (!requiredHeaders.transmissionId || !requiredHeaders.transmissionTime || !requiredHeaders.transmissionSig || !requiredHeaders.certUrl || !requiredHeaders.authAlgo) {
    return { verified: false, skipped: true, reason: 'Missing PayPal signature headers' };
  }

  const accessToken = await getPayPalAccessToken();
  const response = await axios.post(
    `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      auth_algo: requiredHeaders.authAlgo,
      cert_url: requiredHeaders.certUrl,
      transmission_id: requiredHeaders.transmissionId,
      transmission_sig: requiredHeaders.transmissionSig,
      transmission_time: requiredHeaders.transmissionTime,
      webhook_id: paypalWebhookId,
      webhook_event: event
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return {
    verified: response.data?.verification_status === 'SUCCESS',
    skipped: false,
    status: response.data?.verification_status
  };
}

/**
 * Authentication and Authorization Middleware
 * Uses reusable admin-auth middleware
 */
const { requireAuth, requireAdmin: requireAdminMiddleware, auditLog } = require('./middleware/admin-auth');

// Use reusable middleware
const authenticateUser = requireAuth;
const requireAdmin = requireAdminMiddleware();
// Platform admin only - restrict to platform_admin role
const requirePlatformAdmin = requireAdminMiddleware({ allowedRoles: ['platform_admin'] });

/**
 * Get all subscription plans
 */
router.get('/plans', authenticateUser, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * Get tenant's current subscription
 */
router.get('/subscription/:tenantId', authenticateUser, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const subscription = await Subscription.findOne({ 
      tenantId, 
      status: { $in: ['active', 'trialing', 'past_due'] } 
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    res.json(subscription);
  } catch (error) {
    console.error('Error fetching tenant subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * Create PayPal subscription
 */
router.post('/subscription/create', authenticateUser, async (req, res) => {
  try {
    // Check PayPal client is configured
    if (!client) {
      return res.status(500).json({ 
        error: 'PayPal not configured',
        message: 'PayPal credentials are not configured. Please contact support.'
      });
    }
    
    const { tenantId, planId, successUrl, cancelUrl } = req.body;
    
    // Get the plan details
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Create PayPal subscription request
    const request = new paypal.subscriptions.SubscriptionsCreateRequest();
    request.prefer('return=representation');
    
    request.requestBody({
      plan_id: plan.paypalPlanId || `plan_${planId}`, // PayPal plan ID
      subscriber: {
        email_address: req.user?.email || (() => {
          throw new Error('User email is required for billing operations');
        })()
      },
      application_context: {
        brand_name: 'WISP Management',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: successUrl,
        cancel_url: cancelUrl
      }
    });

    const response = await client.execute(request);
    
    // Create subscription record in database
    const subscription = new Subscription({
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      planId,
      status: 'incomplete',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + (plan.interval === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
      paypalSubscriptionId: response.result.id,
      paypalPlanId: plan.paypalPlanId || `plan_${planId}`
    });
    
    await subscription.save();

    res.json({
      subscriptionId: subscription.id,
      approvalUrl: response.result.links.find(link => link.rel === 'approve').href
    });
  } catch (error) {
    console.error('Error creating PayPal subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * Handle PayPal webhook for subscription updates
 * Webhook URL: https://your-domain.com/api/billing/webhook/paypal
 * Configure this URL and set PAYPAL_WEBHOOK_ID in PayPal Developer Dashboard.
 * Signature verification is performed via PayPal's verify-webhook-signature API when PAYPAL_WEBHOOK_ID is set.
 */
// PayPal webhook - uses express.raw so body can be passed to verification; verification requires PayPal headers
router.post('/webhook/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Parse JSON from raw body
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const verification = await verifyPayPalWebhook(event, req.headers);
    if (!verification.skipped && !verification.verified) {
      console.warn('❌ PayPal webhook verification failed', { status: verification.status });
      return res.status(400).json({ error: 'Invalid PayPal webhook signature' });
    }

    if (verification.skipped) {
      console.warn(`⚠️ PayPal webhook verification skipped: ${verification.reason}`);
    }

    console.log(`?? PayPal webhook received: ${event.event_type}`, {
      id: event.id,
      resource_type: event.resource_type,
      summary: event.summary
    });
    
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event);
        break;
      case 'PAYMENT.SALE.DENIED':
        await handlePaymentDenied(event);
        break;
    }
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Cancel subscription
 */
router.post('/subscription/:subscriptionId/cancel', authenticateUser, async (req, res) => {
  try {
    // Check PayPal client is configured
    if (!client) {
      return res.status(500).json({ 
        error: 'PayPal not configured',
        message: 'PayPal credentials are not configured. Please contact support.'
      });
    }
    
    const { subscriptionId } = req.params;
    const { tenantId } = req.body;
    
    const subscription = await Subscription.findOne({ 
      id: subscriptionId, 
      tenantId 
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Cancel PayPal subscription
    if (subscription.paypalSubscriptionId) {
      const request = new paypal.subscriptions.SubscriptionsCancelRequest(subscription.paypalSubscriptionId);
      request.requestBody({
        reason: 'User requested cancellation'
      });
      
      await client.execute(request);
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.cancelAtPeriodEnd = true;
    subscription.updatedAt = new Date();
    
    await subscription.save();

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * Get tenant's invoices
 */
router.get('/invoices/:tenantId', authenticateUser, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const invoices = await Invoice.find({ tenantId }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching tenant invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Get tenant's payment methods
 */
router.get('/payment-methods/:tenantId', authenticateUser, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const paymentMethods = await PaymentMethod.find({ tenantId });
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * Create payment method (without subscription)
 * Used during tenant setup to collect payment info
 */
router.post('/payment-methods', authenticateUser, async (req, res) => {
  try {
    const { tenantId, type, paypalEmail, creditCard } = req.body;
    
    if (!tenantId || !type) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'tenantId and type are required' 
      });
    }
    
    // Validate payment method type
    if (type === 'paypal' && !paypalEmail) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'paypalEmail is required for PayPal payment method' 
      });
    }
    
    // For credit card, we'll store basic info (in production, use a payment processor like Stripe)
    // For now, we just validate that credit card info is provided
    if (type === 'credit_card' && !creditCard) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'creditCard information is required for credit card payment method' 
      });
    }
    
    // Create payment method record
    const paymentMethod = new PaymentMethod({
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      type: type === 'credit_card' ? 'paypal' : type, // Store credit card as paypal type for now (we'll use PayPal's card processing)
      paypalEmail: paypalEmail || creditCard?.email || req.user?.email,
      isDefault: true, // First payment method is always default
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await paymentMethod.save();

    res.json({ 
      message: 'Payment method created successfully',
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        paypalEmail: paymentMethod.paypalEmail
      }
    });
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({ error: 'Failed to create payment method', message: error.message });
  }
});

/**
 * Update payment method
 */
router.put('/payment-methods/:paymentMethodId', authenticateUser, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const { tenantId, paypalEmail } = req.body;
    
    const paymentMethod = await PaymentMethod.findOne({ 
      id: paymentMethodId, 
      tenantId 
    });
    
    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    paymentMethod.paypalEmail = paypalEmail;
    paymentMethod.updatedAt = new Date();
    
    await paymentMethod.save();

    res.json({ message: 'Payment method updated successfully' });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

/**
 * Get billing analytics (platform admin only)
 */
router.get('/analytics', authenticateUser, requirePlatformAdmin, async (req, res) => {
  try {
    // Calculate analytics from database
    const activeSubscriptions = await Subscription.countDocuments({ 
      status: 'active' 
    });
    
    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const monthlyRecurringRevenue = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'subscriptionplans', localField: 'planId', foreignField: 'id', as: 'plan' } },
      { $unwind: '$plan' },
      { $group: { _id: null, total: { $sum: '$plan.price' } } }
    ]);
    
    const analytics = {
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRecurringRevenue: monthlyRecurringRevenue[0]?.total || 0,
      activeSubscriptions,
      churnRate: 0, // Calculate churn rate
      averageRevenuePerUser: activeSubscriptions > 0 ? (monthlyRecurringRevenue[0]?.total || 0) / activeSubscriptions : 0
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching billing analytics:', error);
    res.status(500).json({ error: 'Failed to fetch billing analytics' });
  }
});

/**
 * Get all subscriptions (platform admin only)
 */
router.get('/subscriptions', authenticateUser, requirePlatformAdmin, async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching all subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * Get all invoices (platform admin only)
 */
router.get('/invoices', authenticateUser, requirePlatformAdmin, async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).limit(100);
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching all invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Get all payment methods (platform admin only)
 */
router.get('/payment-methods', authenticateUser, requirePlatformAdmin, async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find().sort({ createdAt: -1 });
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching all payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Webhook handlers
async function handleSubscriptionActivated(event) {
  try {
    const subscriptionId = event.resource.id;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: subscriptionId 
    });
    
    if (subscription) {
      subscription.status = 'active';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription activation:', error);
  }
}

async function handleSubscriptionCancelled(event) {
  try {
    const subscriptionId = event.resource.id;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: subscriptionId 
    });
    
    if (subscription) {
      subscription.status = 'cancelled';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handleSubscriptionSuspended(event) {
  try {
    const subscriptionId = event.resource.id;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: subscriptionId 
    });
    
    if (subscription) {
      subscription.status = 'past_due';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription suspension:', error);
  }
}

async function handlePaymentCompleted(event) {
  try {
    const payment = event.resource;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: payment.billing_agreement_id 
    });
    
    if (subscription) {
      // Create invoice record
      const invoice = new Invoice({
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        amount: parseFloat(payment.amount.total),
        currency: payment.amount.currency,
        status: 'paid',
        paypalInvoiceId: payment.id,
        paidAt: new Date(payment.create_time),
        dueDate: new Date(payment.create_time)
      });
      
      await invoice.save();
    }
  } catch (error) {
    console.error('Error handling payment completion:', error);
  }
}

async function handlePaymentDenied(event) {
  try {
    const payment = event.resource;
    const subscription = await Subscription.findOne({ 
      paypalSubscriptionId: payment.billing_agreement_id 
    });
    
    if (subscription) {
      subscription.status = 'past_due';
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling payment denial:', error);
  }
}

module.exports = router;

module.exports = router;

module.exports = router;
