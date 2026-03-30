/**
 * Voice / SIP / UC — tenant API (X-Tenant-ID required).
 */

const express = require('express');
const { getDomainSchema } = require('../services/voice-domain-schema');
const { getDefaultAdapter } = require('../services/voice-provider-adapter');
const {
  VoiceProviderAccount,
  TelephoneNumber,
  ServiceLocation,
  EmergencyAddress,
  PortOrder,
  PortOrderEvent
} = require('../models/voice-sip');

const router = express.Router();

const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

router.get('/schema', (req, res) => {
  res.json(getDomainSchema());
});

router.get('/provider-accounts', async (req, res) => {
  try {
    const rows = await VoiceProviderAccount.find({ tenantId: req.tenantId }).sort({ updatedAt: -1 }).lean();
    res.json(rows);
  } catch (e) {
    console.error('[voice] list accounts', e);
    res.status(500).json({ error: 'Failed to list provider accounts' });
  }
});

router.post('/provider-accounts', async (req, res) => {
  try {
    const { provider, externalAccountId, displayName, credentialRef } = req.body || {};
    if (!provider || !externalAccountId) {
      return res.status(400).json({ error: 'provider and externalAccountId are required' });
    }
    const doc = await VoiceProviderAccount.create({
      tenantId: req.tenantId,
      provider,
      externalAccountId: String(externalAccountId).trim(),
      displayName,
      credentialRef
    });
    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Provider account already exists for this tenant' });
    }
    console.error('[voice] create account', e);
    res.status(500).json({ error: 'Failed to create provider account' });
  }
});

router.get('/telephone-numbers', async (req, res) => {
  try {
    const q = { tenantId: req.tenantId };
    if (req.query.customerId) {
      q.customerId = String(req.query.customerId).trim();
    }
    const rows = await TelephoneNumber.find(q)
      .populate('emergencyAddressId')
      .sort({ updatedAt: -1 })
      .lean();

    const enriched = rows.map((r) => {
      const ea = r.emergencyAddressId;
      let e911 = '—';
      if (ea && typeof ea === 'object') {
        if (ea.validationStatus === 'validated') e911 = '✓';
        else if (ea.validationStatus === 'pending' || ea.validationStatus === 'needs_update') e911 = '⚠';
        else e911 = '✗';
      }
      return { ...r, e911Display: e911 };
    });
    res.json(enriched);
  } catch (e) {
    console.error('[voice] list TNs', e);
    res.status(500).json({ error: 'Failed to list telephone numbers' });
  }
});

router.post('/telephone-numbers', async (req, res) => {
  try {
    const { e164, status, voiceProviderAccountId, providerTnId, rateCenter, lata, emergencyAddressId, customerId } =
      req.body || {};
    if (!e164 || !status || !voiceProviderAccountId) {
      return res.status(400).json({ error: 'e164, status, and voiceProviderAccountId are required' });
    }
    const doc = await TelephoneNumber.create({
      tenantId: req.tenantId,
      e164: String(e164).trim(),
      status,
      voiceProviderAccountId,
      providerTnId,
      rateCenter,
      lata,
      emergencyAddressId: emergencyAddressId || undefined,
      customerId: customerId ? String(customerId).trim() : undefined
    });
    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Telephone number already exists for this tenant' });
    }
    console.error('[voice] create TN', e);
    res.status(500).json({ error: 'Failed to create telephone number' });
  }
});

router.patch('/telephone-numbers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['status', 'providerTnId', 'rateCenter', 'lata', 'emergencyAddressId', 'customerId'];
    const set = {};
    const unset = {};
    for (const k of allowed) {
      if (req.body[k] === undefined) continue;
      if (k === 'customerId') {
        const v = req.body[k];
        if (v === null || v === '') unset.customerId = '';
        else set.customerId = String(v).trim();
        continue;
      }
      set[k] = req.body[k];
    }
    const ops = {};
    if (Object.keys(set).length) ops.$set = set;
    if (Object.keys(unset).length) ops.$unset = unset;
    if (!Object.keys(ops).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const doc = await TelephoneNumber.findOneAndUpdate({ _id: id, tenantId: req.tenantId }, ops, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) {
    console.error('[voice] patch TN', e);
    res.status(500).json({ error: 'Failed to update telephone number' });
  }
});

router.get('/service-locations', async (req, res) => {
  try {
    const q = { tenantId: req.tenantId };
    if (req.query.customerId) {
      q.customerId = String(req.query.customerId).trim();
    }
    const rows = await ServiceLocation.find(q).sort({ updatedAt: -1 }).lean();
    res.json(rows);
  } catch (e) {
    console.error('[voice] list locations', e);
    res.status(500).json({ error: 'Failed to list service locations' });
  }
});

router.post('/service-locations', async (req, res) => {
  try {
    const b = req.body || {};
    const doc = await ServiceLocation.create({
      tenantId: req.tenantId,
      customerId: b.customerId ? String(b.customerId).trim() : undefined,
      street: b.street,
      unit: b.unit,
      city: b.city,
      state: b.state,
      postal: b.postal,
      country: b.country,
      latitude: b.latitude,
      longitude: b.longitude,
      geocodeAccuracyM: b.geocodeAccuracyM,
      geocodeSource: b.geocodeSource,
      geocodeLocatorName: b.geocodeLocatorName,
      geocodeScore: b.geocodeScore
    });
    res.status(201).json(doc);
  } catch (e) {
    console.error('[voice] create location', e);
    res.status(500).json({ error: 'Failed to create service location' });
  }
});

router.get('/emergency-addresses', async (req, res) => {
  try {
    const rows = await EmergencyAddress.find({ tenantId: req.tenantId })
      .populate('serviceLocationId')
      .sort({ updatedAt: -1 })
      .lean();
    res.json(rows);
  } catch (e) {
    console.error('[voice] list emergency addresses', e);
    res.status(500).json({ error: 'Failed to list emergency addresses' });
  }
});

router.post('/emergency-addresses', async (req, res) => {
  try {
    const { serviceLocationId, voiceProviderAccountId, providerAddressId, validationStatus } = req.body || {};
    if (!serviceLocationId || !voiceProviderAccountId) {
      return res.status(400).json({ error: 'serviceLocationId and voiceProviderAccountId are required' });
    }
    const doc = await EmergencyAddress.create({
      tenantId: req.tenantId,
      serviceLocationId,
      voiceProviderAccountId,
      providerAddressId,
      validationStatus: validationStatus || 'pending'
    });
    res.status(201).json(doc);
  } catch (e) {
    console.error('[voice] create emergency address', e);
    res.status(500).json({ error: 'Failed to create emergency address' });
  }
});

router.get('/port-orders', async (req, res) => {
  try {
    const rows = await PortOrder.find({ tenantId: req.tenantId }).sort({ updatedAt: -1 }).lean();
    res.json(rows);
  } catch (e) {
    console.error('[voice] list port orders', e);
    res.status(500).json({ error: 'Failed to list port orders' });
  }
});

router.post('/port-orders', async (req, res) => {
  try {
    const b = req.body || {};
    const doc = await PortOrder.create({
      tenantId: req.tenantId,
      status: b.status || 'draft',
      telephoneNumbersE164: b.telephoneNumbersE164 || [],
      losingCarrierName: b.losingCarrierName,
      losingCarrierSpid: b.losingCarrierSpid,
      focTargetDate: b.focTargetDate,
      voiceProviderAccountId: b.voiceProviderAccountId
    });
    res.status(201).json(doc);
  } catch (e) {
    console.error('[voice] create port order', e);
    res.status(500).json({ error: 'Failed to create port order' });
  }
});

router.get('/port-orders/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await PortOrderEvent.find({ tenantId: req.tenantId, portOrderId: id })
      .sort({ receivedAt: -1 })
      .lean();
    res.json(rows);
  } catch (e) {
    console.error('[voice] list port events', e);
    res.status(500).json({ error: 'Failed to list port order events' });
  }
});

/** Stub: provision emergency via adapter (no live HTTP in default stub). */
router.post('/actions/provision-emergency-address', async (req, res) => {
  try {
    const { voiceProviderAccountExternalId, serviceLocationPayload } = req.body || {};
    if (!voiceProviderAccountExternalId) {
      return res.status(400).json({ error: 'voiceProviderAccountExternalId required' });
    }
    const adapter = getDefaultAdapter();
    const result = adapter.provisionEmergencyAddress(voiceProviderAccountExternalId, serviceLocationPayload || {});
    res.json(result);
  } catch (e) {
    console.error('[voice] provision emergency', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** Stub: create port order via adapter. */
router.post('/actions/create-port-order', async (req, res) => {
  try {
    const { voiceProviderAccountExternalId, orderPayload } = req.body || {};
    if (!voiceProviderAccountExternalId) {
      return res.status(400).json({ error: 'voiceProviderAccountExternalId required' });
    }
    const adapter = getDefaultAdapter();
    const result = adapter.createPortOrder(voiceProviderAccountExternalId, orderPayload || {});
    res.json(result);
  } catch (e) {
    console.error('[voice] create port order action', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

module.exports = router;
