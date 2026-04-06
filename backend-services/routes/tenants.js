/**
 * User Tenant Creation API
 * Allows regular users to create their FIRST tenant only
 * Users can only have one tenant - it's theirs permanently
 * Only system admin can delete tenants
 */

const express = require('express');
const router = express.Router();
const { verifyAuth } = require('./users/role-auth-middleware');
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('./users/user-schema');
const { createFirstTenantForUser } = require('../services/first-tenant-create');

/**
 * POST /api/tenants
 * Create a new tenant (for regular users - their first tenant only)
 */
router.post('/', verifyAuth, async (req, res) => {
  try {
    const result = await createFirstTenantForUser({
      userId: req.user.uid,
      userEmail: req.user.email,
      body: req.body
    });
    if (!result.success) {
      return res.status(result.status).json(result.body);
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Error creating tenant:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map((err) => err.message);
      return res.status(400).json({
        error: 'Validation Error',
        message: validationErrors.join(', ')
      });
    }
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000 || error.code === 11001) {
      return res.status(400).json({
        error: 'Duplicate Entry',
        message: 'A tenant with this subdomain already exists'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * PUT /api/tenants/:tenantId
 * Update tenant (limited fields - mainly for primary location)
 */
router.put('/:tenantId', verifyAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user.uid;
    
    // Verify user has access to this tenant
    const userTenant = await UserTenant.findOne({
      userId,
      tenantId,
      status: 'active'
    });
    
    if (!userTenant) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this tenant'
      });
    }
    
    // Only allow updating primaryLocation for now
    const { primaryLocation } = req.body;
    
    const tenant = await Tenant.findOne({ _id: tenantId });
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    if (primaryLocation) {
      tenant.primaryLocation = {
        siteId: primaryLocation.siteId || null,
        siteName: primaryLocation.siteName || null
      };
    }
    
    await tenant.save();
    
    res.json({ tenant });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;

