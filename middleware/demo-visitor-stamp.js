/**
 * For Firebase users uid demo_v_*: verify Bearer token, stamp demoVisitorKey on JSON bodies,
 * and enforce per-resource create limits for demo visitors.
 * @see docs/deployment/DEMO_VISITOR.md
 */

const { auth } = require('../config/firebase');
const { Customer } = require('../models/customer');
const { WorkOrder } = require('../models/work-order');
const { Incident } = require('../models/incident');
const { InventoryItem } = require('../models/inventory');

const MAX_CUSTOMERS = parseInt(process.env.DEMO_VISITOR_MAX_CUSTOMERS || '8', 10);
const MAX_WORK_ORDERS = parseInt(process.env.DEMO_VISITOR_MAX_WORK_ORDERS || '15', 10);
const MAX_INCIDENTS = parseInt(process.env.DEMO_VISITOR_MAX_INCIDENTS || '10', 10);
const MAX_INVENTORY = parseInt(process.env.DEMO_VISITOR_MAX_INVENTORY || '8', 10);

function pathKey(url) {
  const p = url.split('?')[0];
  if (p.startsWith('/api/customers/portal')) return null;
  if (p.startsWith('/api/customers')) return 'customers';
  if (p.startsWith('/api/work-orders')) return 'work-orders';
  if (p.startsWith('/api/incidents')) return 'incidents';
  if (p.startsWith('/api/inventory')) return 'inventory';
  return null;
}

module.exports = async function demoVisitorStamp(req, res, next) {
  if (process.env.DEMO_VISITOR_MODE !== 'true') {
    return next();
  }

  const method = req.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
    return next();
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1], true);
  } catch {
    return next();
  }

  if (!decoded.uid || !decoded.uid.startsWith('demo_v_') || !decoded.visitorKey) {
    return next();
  }

  const visitorKey = decoded.visitorKey;
  const tenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
  const pk = pathKey(req.originalUrl || req.url || '');

  if (tenantId && pk && method === 'POST') {
    try {
      if (pk === 'customers') {
        const n = await Customer.countDocuments({ tenantId, demoVisitorKey: visitorKey });
        if (n >= MAX_CUSTOMERS) {
          return res.status(403).json({
            error: 'Demo limit reached',
            message: `Demo visitors may create at most ${MAX_CUSTOMERS} customers. Sign out clears your demo data.`,
            limit: 'customers'
          });
        }
      } else if (pk === 'work-orders') {
        const n = await WorkOrder.countDocuments({ tenantId, demoVisitorKey: visitorKey });
        if (n >= MAX_WORK_ORDERS) {
          return res.status(403).json({
            error: 'Demo limit reached',
            message: `Demo visitors may create at most ${MAX_WORK_ORDERS} work orders.`,
            limit: 'work-orders'
          });
        }
      } else if (pk === 'incidents') {
        const n = await Incident.countDocuments({ tenantId, demoVisitorKey: visitorKey });
        if (n >= MAX_INCIDENTS) {
          return res.status(403).json({
            error: 'Demo limit reached',
            message: `Demo visitors may create at most ${MAX_INCIDENTS} incidents.`,
            limit: 'incidents'
          });
        }
      } else if (pk === 'inventory') {
        const n = await InventoryItem.countDocuments({ tenantId, demoVisitorKey: visitorKey });
        if (n >= MAX_INVENTORY) {
          return res.status(403).json({
            error: 'Demo limit reached',
            message: `Demo visitors may create at most ${MAX_INVENTORY} inventory rows.`,
            limit: 'inventory'
          });
        }
      }
    } catch (e) {
      console.error('[demo-visitor-stamp] limit check failed:', e);
      return res.status(500).json({ error: 'Demo limit check failed' });
    }
  }

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !Array.isArray(req.body)) {
    if (!req.body.demoVisitorKey) {
      req.body.demoVisitorKey = visitorKey;
    }
  }

  req.demoVisitor = { visitorKey, uid: decoded.uid };
  next();
};
