/**
 * Internal API - called only by trusted callers (e.g. Cloud Functions) with INTERNAL_API_KEY.
 * No Firebase token verification; used when the caller has already verified the user.
 */

const express = require('express');
const tenantService = require('../services/tenant-service');
const { createFirstTenantForUser } = require('../services/first-tenant-create');
const { Tenant } = require('../models/tenant');
const { PlanProject } = require('../models/plan');
const { CustomerBilling } = require('../models/customer-billing');
const { Customer } = require('../models/customer');

const router = express.Router();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'] || req.headers['X-Internal-Key'];
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing internal key' });
  }
  next();
}

function requireTenantId(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'X-Tenant-ID header required' });
  }
  req.tenantId = tenantId;
  next();
}

router.use(requireInternalKey);

/**
 * GET /api/internal/tenant-details/:tenantId
 * Returns tenant details if the user (x-firebase-uid) has access. Caller (apiProxy) must have verified the token.
 */
router.get('/tenant-details/:tenantId', async (req, res) => {
  try {
    const userId = req.headers['x-firebase-uid'] || req.headers['X-Firebase-Uid'];
    if (!userId) {
      return res.status(400).json({ error: 'Bad Request', message: 'X-Firebase-Uid header required' });
    }
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ error: 'Bad Request', message: 'tenantId is required' });
    }
    const tenant = await tenantService.getTenant(tenantId, userId);
    if (!tenant) {
      return res.status(404).json({ error: 'Not Found', message: 'Tenant not found or not authorized' });
    }
    res.json(tenant);
  } catch (error) {
    console.error('[internal] tenant-details GET error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message || 'Failed to get tenant' });
    }
  }
});

/**
 * GET /api/internal/user-tenants/:userId
 * Returns tenants for the given userId. Caller (Cloud Function) must have verified the user token.
 */
router.get('/user-tenants/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'Bad Request', message: 'userId is required' });
    }
    const tenants = await tenantService.getUserTenants(userId);
    res.json(tenants);
  } catch (error) {
    console.error('[internal] getUserTenants error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to get user tenants'
      });
    }
  }
});

/**
 * POST /api/internal/first-tenant
 * Create the caller's first tenant. Caller (apiProxy) must verify Firebase token and pass
 * X-Firebase-Uid (+ optional X-Firebase-Email). Avoids verifyIdToken on GCE when Firebase Admin is misconfigured.
 */
router.post('/first-tenant', async (req, res) => {
  try {
    const userId = req.headers['x-firebase-uid'] || req.headers['X-Firebase-Uid'];
    const userEmail = (req.headers['x-firebase-email'] || req.headers['X-Firebase-Email'] || '').trim() || null;
    if (!userId) {
      return res.status(400).json({ error: 'Bad Request', message: 'X-Firebase-Uid header required' });
    }
    const result = await createFirstTenantForUser({
      userId,
      userEmail,
      body: req.body
    });
    if (!result.success) {
      return res.status(result.status).json(result.body);
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[internal] first-tenant POST error:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map((err) => err.message);
      return res.status(400).json({
        error: 'Validation Error',
        message: validationErrors.join(', ')
      });
    }
    if (error.code === 11000 || error.code === 11001) {
      return res.status(400).json({
        error: 'Duplicate Entry',
        message: 'A tenant with this subdomain already exists'
      });
    }
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
});

/**
 * GET /api/internal/tenant-settings
 * Returns app settings for the tenant. Caller must pass X-Tenant-ID and have verified the user has access.
 */
router.get('/tenant-settings', requireTenantId, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const appSettings = tenant.settings?.appSettings || {};
    res.json({
      acsSettings: appSettings.acs || { username: '', password: '', url: '' },
      companyInfo: appSettings.company || {
        name: '', address: '', city: '', state: '', zip: '', phone: '', email: ''
      }
    });
  } catch (error) {
    console.error('[internal] tenant-settings GET error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to load settings', message: error.message });
    }
  }
});

/**
 * PUT /api/internal/tenant-settings
 * Updates app settings for the tenant. Body: { acsSettings?, companyInfo? }. Caller must pass X-Tenant-ID.
 */
router.put('/tenant-settings', requireTenantId, async (req, res) => {
  try {
    const { acsSettings, companyInfo } = req.body || {};
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!tenant.settings) tenant.settings = {};
    if (!tenant.settings.appSettings) tenant.settings.appSettings = {};
    if (acsSettings && typeof acsSettings === 'object') {
      tenant.settings.appSettings.acs = {
        username: acsSettings.username ?? tenant.settings.appSettings.acs?.username ?? '',
        password: acsSettings.password ?? tenant.settings.appSettings.acs?.password ?? '',
        url: acsSettings.url ?? tenant.settings.appSettings.acs?.url ?? ''
      };
    }
    if (companyInfo && typeof companyInfo === 'object') {
      tenant.settings.appSettings.company = {
        name: companyInfo.name ?? '',
        address: companyInfo.address ?? '',
        city: companyInfo.city ?? '',
        state: companyInfo.state ?? '',
        zip: companyInfo.zip ?? '',
        phone: companyInfo.phone ?? '',
        email: companyInfo.email ?? ''
      };
    }
    await tenant.save();
    res.json({
      acsSettings: tenant.settings.appSettings.acs || { username: '', password: '', url: '' },
      companyInfo: tenant.settings.appSettings.company || {}
    });
  } catch (error) {
    console.error('[internal] tenant-settings PUT error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to save settings', message: error.message });
    }
  }
});

/**
 * GET /api/internal/plans
 * Returns plans for the tenant. Caller must pass X-Tenant-ID and have verified the user has access.
 */
router.get('/plans', requireTenantId, async (req, res) => {
  try {
    const { status, createdBy } = req.query;
    const query = { tenantId: req.tenantId };
    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;
    const plans = await PlanProject.find(query).sort({ updatedAt: -1 }).lean();
    plans.forEach(plan => {
      if (!plan.stagedFeatureCounts) {
        plan.stagedFeatureCounts = { total: 0, byType: {}, byStatus: {} };
      }
    });
    res.json(plans);
  } catch (error) {
    console.error('[internal] plans GET error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to load plans', message: error.message });
    }
  }
});

/**
 * POST /api/internal/cron/billing
 * Runs generate-invoices and dunning/run for one tenant (X-Tenant-ID) or all tenants.
 * For cron/Cloud Scheduler; requires x-internal-key only.
 */
router.post('/cron/billing', async (req, res) => {
  try {
    const tenantIdHeader = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    let tenantIds = [];
    if (tenantIdHeader) {
      tenantIds = [tenantIdHeader];
    } else {
      const tenants = await Tenant.find({}).select('_id').lean();
      tenantIds = tenants.map(t => t._id.toString());
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const REMINDER_THRESHOLD = 3;
    const summary = { tenants: 0, invoicesGenerated: 0, dunningProcessed: 0, errors: [] };
    for (const tenantId of tenantIds) {
      try {
        const docs = await CustomerBilling.find({
          tenantId,
          'billingCycle.nextBillingDate': { $lte: today },
          'servicePlan.monthlyFee': { $exists: true, $gt: 0 }
        });
        for (const doc of docs) {
          const fee = doc.servicePlan?.monthlyFee ?? 0;
          if (fee <= 0) continue;
          const nextDate = doc.billingCycle?.nextBillingDate ? new Date(doc.billingCycle.nextBillingDate) : new Date();
          const invNum = `INV-${new Date().getFullYear()}-${String((doc.invoices?.length || 0) + 1).padStart(4, '0')}`;
          const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          const invoice = {
            invoiceId,
            invoiceNumber: invNum,
            amount: fee,
            status: 'pending',
            dueDate: new Date(nextDate.getTime() + 14 * 24 * 60 * 60 * 1000),
            lineItems: [{ description: doc.servicePlan?.planName || 'Monthly service', quantity: 1, unitPrice: fee, total: fee }]
          };
          if (!doc.invoices) doc.invoices = [];
          doc.invoices.push(invoice);
          doc.balance = doc.balance || { current: 0, overdue: 0 };
          doc.balance.current = (doc.balance.current || 0) + fee;
          const nextBilling = new Date(nextDate);
          nextBilling.setMonth(nextBilling.getMonth() + 1);
          doc.billingCycle = doc.billingCycle || {};
          doc.billingCycle.nextBillingDate = nextBilling;
          doc.updatedAt = new Date();
          await doc.save();
          summary.invoicesGenerated++;
        }
        const dunningDocs = await CustomerBilling.find({ tenantId }).lean();
        for (const doc of dunningDocs) {
          const overdue = (doc.invoices || []).filter(
            (inv) => inv.status === 'overdue' || (inv.status === 'pending' && inv.dueDate && new Date(inv.dueDate) < today)
          );
          if (overdue.length === 0) continue;
          const billingDoc = await CustomerBilling.findOne({ _id: doc._id });
          if (!billingDoc) continue;
          if (!billingDoc.dunning) billingDoc.dunning = {};
          billingDoc.dunning.reminderCount = (billingDoc.dunning.reminderCount || 0) + 1;
          billingDoc.dunning.lastReminderAt = new Date();
          if (billingDoc.dunning.reminderCount >= REMINDER_THRESHOLD && !billingDoc.dunning.suspendedAt) {
            billingDoc.dunning.suspendedAt = new Date();
            billingDoc.dunning.suspensionReason = 'Overdue invoices after reminder threshold';
            await Customer.findOneAndUpdate(
              { tenantId, customerId: billingDoc.customerId },
              { serviceStatus: 'suspended' }
            );
          }
          await billingDoc.save();
          summary.dunningProcessed++;
        }
        summary.tenants++;
      } catch (err) {
        summary.errors.push({ tenantId, message: err.message });
      }
    }
    res.json(summary);
  } catch (error) {
    console.error('[internal] cron/billing error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message || 'Cron billing failed' });
    }
  }
});

module.exports = router;
