/**
 * Branding API
 * Manages tenant branding for customer portal
 */

const { Tenant } = require('../models/tenant');
const { Customer } = require('../models/customer');
const { UserTenant } = require('../models/user');
const { requireAuth, requireAdmin } = require('../middleware/admin-auth');
const { admin, firestore: firestoreDB } = require('../config/firebase');

/**
 * Registers branding API routes directly on the main Express app.
 * Using direct app routes avoids router mount issues we observed in production.
 */
function registerBrandingRoutes(app) {
  const requireAdminMiddleware = requireAdmin();

  /**
   * Middleware: Allow tenant owner/admin to update branding
   * This uses a simplified approach that doesn't re-invoke requireAuth
   */
  const requireTenantAdmin = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      
      // Verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      const email = (decodedToken.email || '').toLowerCase();
      const { tenantId } = req.params;
      
      console.log('[Branding API] Auth check for user:', email, 'tenant:', tenantId);
      
      // Check 1: Is user an owner/admin for this specific tenant via UserTenant?
      const userTenantRecord = await UserTenant.findOne({ 
        userId: uid, 
        tenantId: tenantId 
      }).lean();
      
      if (userTenantRecord && ['owner', 'admin', 'platform_admin'].includes(userTenantRecord.role)) {
        console.log('[Branding API] User authorized via UserTenant record, role:', userTenantRecord.role);
        req.user = {
          uid,
          email,
          role: userTenantRecord.role,
          tenantId
        };
        return next();
      }
      
      // Check 2: Is user the tenant's contact email (owner)?
      const mongoose = require('mongoose');
      let tenant;
      if (mongoose.Types.ObjectId.isValid(tenantId)) {
        tenant = await Tenant.findById(tenantId).lean();
      }
      
      if (tenant && tenant.contactEmail && tenant.contactEmail.toLowerCase() === email) {
        console.log('[Branding API] User is tenant contact email, granting owner access');
        
        // Auto-create UserTenant record for future logins
        try {
          await UserTenant.findOneAndUpdate(
            { userId: uid, tenantId },
            { 
              userId: uid, 
              tenantId, 
              role: 'owner', 
              status: 'active',
              addedAt: new Date()
            },
            { upsert: true }
          );
          console.log('[Branding API] Created UserTenant record for tenant owner');
        } catch (e) {
          console.warn('[Branding API] Could not create UserTenant record:', e.message);
        }
        
        req.user = {
          uid,
          email,
          role: 'owner',
          tenantId
        };
        return next();
      }
      
      // Check 3: Is user a platform admin (in Firestore)?
      try {
        const userDoc = await firestoreDB.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.role === 'platform_admin') {
            console.log('[Branding API] User is platform admin');
            req.user = {
              uid,
              email,
              role: 'platform_admin',
              tenantId
            };
            return next();
          }
        }
      } catch (e) {
        console.warn('[Branding API] Could not check Firestore user:', e.message);
      }
      
      console.log('[Branding API] User not authorized for tenant:', tenantId);
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You must be a tenant owner or admin to update branding' 
      });
    } catch (error) {
      console.error('[Branding API] Auth error:', error);
      res.status(401).json({ error: 'Unauthorized', message: error.message || 'Authentication failed' });
    }
  };

  console.log('[Branding API] Registering routes on application instance:');
  console.log('  GET /api/branding/:tenantId');
  console.log('  PUT /api/branding/:tenantId');
  console.log('  POST /api/branding/:tenantId/logo');

  /**
   * GET /api/branding/:tenantId
   * Get tenant branding (public endpoint for customer portal)
   * Supports both full MongoDB ObjectId (24 chars) and short portal subdomain (12 chars)
   */
  app.get('/api/branding/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    console.log('[Branding API] Fetching branding for tenant:', tenantId, 'length:', tenantId.length);
    
    // Try to find tenant by ID (handle both string and ObjectId)
    const mongoose = require('mongoose');
    let tenant;
    
    // Check if tenantId is a valid full ObjectId (24 chars)
    if (mongoose.Types.ObjectId.isValid(tenantId) && tenantId.length === 24) {
      tenant = await Tenant.findOne({ 
        _id: new mongoose.Types.ObjectId(tenantId),
        status: 'active'
      }).select('branding displayName contactEmail name');
    }
    
    // If not found, try portal subdomain lookup
    if (!tenant) {
      tenant = await Tenant.findOne({
        'branding.portal.portalSubdomain': tenantId,
        status: 'active'
      }).select('branding displayName contactEmail name');
    }
    
    // If still not found and it's 12 chars, try matching start of _id
    if (!tenant && tenantId.length === 12) {
      console.log('[Branding API] Trying regex match for short ID:', tenantId);
      tenant = await Tenant.findOne({
        _id: { $regex: `^${tenantId}` },
        status: 'active'
      }).select('branding displayName contactEmail name');
    }
    
    if (!tenant) {
      console.log('[Branding API] Tenant not found:', tenantId);
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    console.log('[Branding API] Tenant found:', { 
      hasBranding: !!tenant.branding, 
      displayName: tenant.displayName 
    });
    
    // Return branding with defaults
    const branding = tenant.branding || {};
    const defaultBranding = {
      logo: { url: '', altText: tenant.displayName || 'Logo' },
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#10b981',
        background: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280'
      },
      company: {
        name: tenant.displayName || tenant.name,
        displayName: tenant.displayName,
        supportEmail: tenant.contactEmail,
        supportPhone: '',
        supportHours: 'Mon-Fri 8am-5pm',
        website: '',
        address: ''
      },
      portal: {
        welcomeMessage: `Welcome to ${tenant.displayName || 'Customer'} Portal`,
        footerText: '',
        customCSS: '',
        enableCustomDomain: false,
        customDomain: ''
      },
      features: {
        enableFAQ: true,
        enableServiceStatus: true,
        enableBilling: true,
        enableTickets: true,
        enableLiveChat: false,
        enableKnowledgeBase: false,
        liveChatEmbedHtml: undefined
      },
      billingPortal: {
        paymentGateways: {
          stripe: { enabled: false, publicKey: '', note: '' },
          paypal: { enabled: false, clientId: '', sandbox: true, note: '' }
        },
        invoice: {
          companyName: tenant.displayName || '',
          logoUrl: '',
          address: '',
          footerText: '',
          termsAndConditions: '',
          dueDays: 14,
          currency: 'USD'
        }
      }
    };
    
    // Merge with tenant branding
    const mergedBranding = {
      logo: { ...defaultBranding.logo, ...(branding.logo || {}) },
      colors: { ...defaultBranding.colors, ...(branding.colors || {}) },
      company: { ...defaultBranding.company, ...(branding.company || {}) },
      portal: { ...defaultBranding.portal, ...(branding.portal || {}) },
      features: { ...defaultBranding.features, ...(branding.features || {}) },
      billingPortal: {
        paymentGateways: {
          stripe: { ...defaultBranding.billingPortal.paymentGateways.stripe, ...(branding.billingPortal?.paymentGateways?.stripe || {}) },
          paypal: { ...defaultBranding.billingPortal.paymentGateways.paypal, ...(branding.billingPortal?.paymentGateways?.paypal || {}) }
        },
        invoice: { ...defaultBranding.billingPortal.invoice, ...(branding.billingPortal?.invoice || {}) }
      }
    };
    
    res.json(mergedBranding);
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
  });

  /**
   * PUT /api/branding/:tenantId
   * Update tenant branding (tenant owner/admin only)
   */
  app.put('/api/branding/:tenantId', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const brandingData = req.body;
    
    console.log('[Branding API] PUT /:tenantId handler called:', { tenantId, hasData: !!brandingData, method: req.method, path: req.path });
    
    // Extract tenantId from request (set by middleware)
    const requestTenantId = req.tenantId || tenantId;
    
    // Handle both ObjectId and string
    const mongoose = require('mongoose');
    let tenant;
    
    if (mongoose.Types.ObjectId.isValid(requestTenantId)) {
      tenant = await Tenant.findOne({ 
        _id: new mongoose.Types.ObjectId(requestTenantId),
        status: 'active'
      });
    } else {
      tenant = await Tenant.findOne({ 
        _id: requestTenantId,
        status: 'active'
      });
    }
    
    if (!tenant) {
      console.log('[Branding API] Tenant not found for update:', requestTenantId);
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    console.log('[Branding API] Tenant found, updating branding');
    
    // Update branding
    if (!tenant.branding) {
      tenant.branding = {};
    }
    
    if (brandingData.logo) {
      tenant.branding.logo = { ...tenant.branding.logo, ...brandingData.logo };
    }
    
    if (brandingData.colors) {
      tenant.branding.colors = { ...tenant.branding.colors, ...brandingData.colors };
    }
    
    if (brandingData.company) {
      tenant.branding.company = { ...tenant.branding.company, ...brandingData.company };
    }
    
    if (brandingData.portal) {
      tenant.branding.portal = { ...tenant.branding.portal, ...brandingData.portal };
      
      // Generate portal URL based on configuration
      if (brandingData.portal.enableCustomDomain && brandingData.portal.customDomain) {
        tenant.branding.portal.portalUrl = `https://${brandingData.portal.customDomain}`;
      } else {
        // Use tenant ID (first 12 chars) as portal path
        const portalPath = brandingData.portal.portalSubdomain || tenant._id.toString().slice(0, 12);
        tenant.branding.portal.portalSubdomain = portalPath;
        tenant.branding.portal.portalUrl = `https://wisptools.io/wisp-management/portal/${portalPath}`;
      }
    }
    
    if (brandingData.features) {
      tenant.branding.features = { ...tenant.branding.features, ...brandingData.features };
    }
    
    if (brandingData.billingPortal) {
      if (!tenant.branding.billingPortal) tenant.branding.billingPortal = {};
      if (brandingData.billingPortal.paymentGateways) {
        tenant.branding.billingPortal.paymentGateways = tenant.branding.billingPortal.paymentGateways || {};
        if (brandingData.billingPortal.paymentGateways.stripe) {
          tenant.branding.billingPortal.paymentGateways.stripe = { ...tenant.branding.billingPortal.paymentGateways.stripe, ...brandingData.billingPortal.paymentGateways.stripe };
        }
        if (brandingData.billingPortal.paymentGateways.paypal) {
          tenant.branding.billingPortal.paymentGateways.paypal = { ...tenant.branding.billingPortal.paymentGateways.paypal, ...brandingData.billingPortal.paymentGateways.paypal };
        }
      }
      if (brandingData.billingPortal.invoice) {
        tenant.branding.billingPortal.invoice = { ...tenant.branding.billingPortal.invoice, ...brandingData.billingPortal.invoice };
      }
    }
    
    await tenant.save();
    
    res.json({ 
      success: true, 
      message: 'Branding updated successfully',
      branding: tenant.branding 
    });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
  });

  /**
   * POST /api/branding/:tenantId/logo
   * Upload logo (admin only)
   */
  app.post('/api/branding/:tenantId/logo', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { logoUrl, altText } = req.body;
    
    const requestTenantId = req.tenantId || tenantId;
    
    const tenant = await Tenant.findOne({ 
      _id: requestTenantId,
      status: 'active'
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    if (!tenant.branding) {
      tenant.branding = {};
    }
    
    if (!tenant.branding.logo) {
      tenant.branding.logo = {};
    }
    
    tenant.branding.logo.url = logoUrl;
    if (altText) {
      tenant.branding.logo.altText = altText;
    }
    
    await tenant.save();
    
    res.json({ 
      success: true, 
      message: 'Logo updated successfully',
      logo: tenant.branding.logo 
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
  });
}

module.exports = registerBrandingRoutes;

