/**
 * First-tenant creation for a user (shared by POST /api/tenants and internal API).
 */

const { admin } = require('../config/firebase');
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('../routes/users/user-schema');
const { PLATFORM_ADMIN_EMAILS } = require('../utils/platformAdmin');

/**
 * @param {{ userId: string, userEmail?: string|null, body: object }} params
 * @returns {Promise<{ success: true, status: number, body: object } | { success: false, status: number, body: object }>}
 */
async function createFirstTenantForUser({ userId, userEmail, body }) {
  const existingTenants = await UserTenant.find({
    userId,
    status: 'active'
  });

  if (existingTenants.length > 0) {
    return {
      success: false,
      status: 403,
      body: {
        error: 'Forbidden',
        message: 'You already have a tenant. Each user can only create one tenant.'
      }
    };
  }

  const {
    name,
    displayName,
    contactEmail,
    subdomain,
    primaryLocation
  } = body || {};

  if (!name || !displayName || !contactEmail) {
    return {
      success: false,
      status: 400,
      body: {
        error: 'Bad Request',
        message: 'name, displayName, and contactEmail are required'
      }
    };
  }

  const finalContactEmail = contactEmail || userEmail;
  let finalSubdomain = subdomain;
  if (!finalSubdomain) {
    finalSubdomain = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  const existingTenant = await Tenant.findOne({ subdomain: finalSubdomain });
  if (existingTenant) {
    return {
      success: false,
      status: 400,
      body: {
        error: 'Bad Request',
        message: 'Subdomain already taken'
      }
    };
  }

  const cwmpBaseUrl = process.env.CWMP_BASE_URL || process.env.PUBLIC_CWMP_BASE_URL || 'https://wisptools.io';
  const cwmpUrl = `${cwmpBaseUrl}/cwmp/${finalSubdomain}`;

  const tenantData = {
    name,
    displayName,
    subdomain: finalSubdomain,
    contactEmail: finalContactEmail,
    cwmpUrl,
    createdBy: userId,
    settings: {
      allowSelfRegistration: false,
      requireEmailVerification: true,
      maxUsers: 50,
      maxDevices: 20,
      features: {
        acs: true,
        hss: true,
        pci: true,
        helpDesk: true,
        userManagement: true,
        customerManagement: true
      }
    },
    limits: {
      maxUsers: 50,
      maxDevices: 20,
      maxNetworks: 10,
      maxTowerSites: 100
    }
  };

  if (primaryLocation?.siteId) {
    tenantData.primaryLocation = {
      siteId: primaryLocation.siteId,
      siteName: primaryLocation.siteName || null
    };
  }

  const tenant = new Tenant(tenantData);
  await tenant.save();

  const userTenant = new UserTenant({
    userId,
    tenantId: tenant._id.toString(),
    role: 'owner',
    status: 'active',
    invitedBy: userId,
    invitedAt: new Date(),
    acceptedAt: new Date(),
    addedAt: new Date()
  });

  await userTenant.save();

  for (const platformAdminEmail of PLATFORM_ADMIN_EMAILS) {
    try {
      const platformAdminUser = await admin.auth().getUserByEmail(platformAdminEmail);
      const platformAdminUserId = platformAdminUser.uid;

      const existingPlatformAdmin = await UserTenant.findOne({
        userId: platformAdminUserId,
        tenantId: tenant._id.toString()
      });

      if (!existingPlatformAdmin) {
        const platformAdminTenant = new UserTenant({
          userId: platformAdminUserId,
          tenantId: tenant._id.toString(),
          role: 'admin',
          status: 'active',
          invitedBy: userId,
          invitedAt: new Date(),
          acceptedAt: new Date(),
          addedAt: new Date()
        });

        await platformAdminTenant.save();
        console.log(`✅ Added platform admin ${platformAdminEmail} (${platformAdminUserId}) as admin to tenant "${displayName}"`);
      }
    } catch (error) {
      console.error(`⚠️ Failed to add platform admin ${platformAdminEmail} to tenant:`, error.message);
    }
  }

  console.log(`✅ User ${userEmail || finalContactEmail} created their tenant "${displayName}" (${tenant._id})`);

  return {
    success: true,
    status: 201,
    body: {
      success: true,
      tenant: {
        ...tenant.toObject(),
        id: tenant._id.toString()
      }
    }
  };
}

module.exports = { createFirstTenantForUser };
