/**
 * Ephemeral demo visitors: Firebase uid derived from client IP + salt.
 * Mounted only when DEMO_VISITOR_MODE=true (see server.js) — omitted from real/production API by default.
 * @see docs/deployment/DEMO_VISITOR.md
 * @see docs/deployment/DEMO_FORK_VS_PRODUCTION.md
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { auth } = require('../config/firebase');
const { UserTenant } = require('../models/user');
const { Customer } = require('../models/customer');
const { WorkOrder } = require('../models/work-order');
const { Incident } = require('../models/incident');
const { InventoryItem } = require('../models/inventory');

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) {
    const first = String(xf).split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function maskIp(ip) {
  if (!ip) return 'unknown';
  const normalized = String(ip).replace(/^::ffff:/i, '');
  if (normalized === '127.0.0.1' || normalized === '::1') return 'local';
  if (normalized.includes('.')) {
    const parts = normalized.split('.');
    if (parts.length >= 2) return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (normalized.includes(':')) {
    return `${normalized.split(':').slice(0, 3).join(':')}:…`;
  }
  return '••••';
}

/**
 * POST /api/demo/visitor-start
 * Returns Firebase custom token for uid demo_v_<hash(ip+salt)>.
 */
router.post('/visitor-start', async (req, res) => {
  try {
    if (process.env.DEMO_VISITOR_MODE !== 'true') {
      return res.status(403).json({
        error: 'Demo visitor login disabled',
        message: 'Set DEMO_VISITOR_MODE=true on the API (demo environments only).'
      });
    }

    const tenantId =
      process.env.DEMO_VISITOR_TENANT_ID || process.env.SINGLE_TENANT_ID || '';
    if (!tenantId) {
      return res.status(503).json({
        error: 'Demo tenant not configured',
        message: 'Set DEMO_VISITOR_TENANT_ID or SINGLE_TENANT_ID to the demo org Mongo id.'
      });
    }

    const salt = process.env.DEMO_VISITOR_SALT || 'dev-only-change-me';
    const ip = clientIp(req);
    const visitorKey = crypto.createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 20);
    const uid = `demo_v_${visitorKey}`;
    const email = `demo.v.${visitorKey.slice(0, 12)}@visitor.demo.wisptools`;

    try {
      await auth.createUser({
        uid,
        email,
        emailVerified: true,
        displayName: `Demo · ${maskIp(ip)}`
      });
    } catch (e) {
      if (e.code !== 'auth/uid-already-exists') {
        console.error('[demo-visitor] createUser:', e);
        throw e;
      }
      await auth.updateUser(uid, { displayName: `Demo · ${maskIp(ip)}` });
    }

    await auth.setCustomUserClaims(uid, { demoVisitor: true, visitorKey });
    const customToken = await auth.createCustomToken(uid);

    await UserTenant.findOneAndUpdate(
      { userId: uid, tenantId },
      {
        userId: uid,
        tenantId,
        role: 'engineer',
        status: 'active',
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.json({
      customToken,
      visitorKey,
      visitorLabel: visitorKey.slice(0, 8),
      ipHint: maskIp(ip),
      tenantId,
      email
    });
  } catch (err) {
    console.error('[demo-visitor] visitor-start failed:', err);
    return res.status(500).json({
      error: 'Demo start failed',
      message: err.message || 'Unknown error'
    });
  }
});

/**
 * POST /api/demo/visitor-purge
 * Deletes Mongo rows tagged with this visitor's key (Bearer = demo visitor).
 */
router.post('/visitor-purge', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Bearer token required' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token, true);
    if (!decoded.uid || !decoded.uid.startsWith('demo_v_')) {
      return res.status(403).json({ error: 'Not a demo visitor account' });
    }
    const visitorKey = decoded.visitorKey;
    if (!visitorKey) {
      return res.status(403).json({ error: 'Token missing visitor claim' });
    }

    const tenantId =
      req.headers['x-tenant-id'] ||
      req.headers['X-Tenant-ID'] ||
      req.body?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header or tenantId body required' });
    }

    const [c, w, i, inv] = await Promise.all([
      Customer.deleteMany({ tenantId, demoVisitorKey: visitorKey }),
      WorkOrder.deleteMany({ tenantId, demoVisitorKey: visitorKey }),
      Incident.deleteMany({ tenantId, demoVisitorKey: visitorKey }),
      InventoryItem.deleteMany({ tenantId, demoVisitorKey: visitorKey })
    ]);

    return res.json({
      ok: true,
      deleted: {
        customers: c.deletedCount,
        workOrders: w.deletedCount,
        incidents: i.deletedCount,
        inventory: inv.deletedCount
      }
    });
  } catch (err) {
    console.error('[demo-visitor] visitor-purge failed:', err);
    return res.status(500).json({
      error: 'Purge failed',
      message: err.message || 'Unknown error'
    });
  }
});

module.exports = router;
