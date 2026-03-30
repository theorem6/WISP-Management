/**
 * Carrier webhooks — no X-Tenant-ID; verify HMAC when VOICE_WEBHOOK_SECRET is set.
 * Mount with express.raw() in server.js before express.json so signature matches raw bytes.
 * POST /api/voice/webhooks/:provider
 */

const crypto = require('crypto');
const express = require('express');
const { VoiceWebhookEvent } = require('../models/voice-sip');
const { getDefaultAdapter } = require('../services/voice-provider-adapter');

const router = express.Router();

function getWebhookSecret() {
  return (process.env.VOICE_WEBHOOK_SECRET || '').trim();
}

function verifySignature(rawBody, sigHeader, secret) {
  if (!secret) return true;
  if (!sigHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  let s = String(sigHeader).trim();
  if (s.toLowerCase().startsWith('sha256=')) s = s.slice(7);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(s, 'hex'));
  } catch {
    return expected.toLowerCase() === s.toLowerCase();
  }
}

router.post('/:provider', async (req, res) => {
  try {
    const provider = String(req.params.provider || 'unknown').toLowerCase().slice(0, 64);
    const secret = getWebhookSecret();
    const sig =
      req.headers['x-voice-webhook-signature'] ||
      req.headers['x-signature'] ||
      req.headers['x-twilio-signature'] ||
      '';

    const bodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ? String(req.body) : '', 'utf8');
    if (!verifySignature(bodyBuf, sig, secret)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    let idem =
      req.headers['x-idempotency-key'] ||
      req.headers['idempotency-key'] ||
      '';
    idem = String(idem || '').trim();
    if (!idem) {
      idem = crypto.createHash('sha256').update(bodyBuf).digest('hex');
    }
    idem = idem.slice(0, 512);

    const raw = bodyBuf.toString('utf8');

    try {
      await VoiceWebhookEvent.create({
        provider,
        idempotencyKey: idem,
        rawPayload: raw
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.json({ ok: true, duplicate: true, idempotencyKey: idem });
      }
      throw e;
    }

    const hdrs = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase().startsWith('x-') || k.toLowerCase() === 'content-type') {
        hdrs[k] = v;
      }
    }
    const adapter = getDefaultAdapter();
    const result = adapter.handleWebhook(provider, raw, hdrs);
    return res.json({ ok: true, duplicate: false, idempotencyKey: idem, result });
  } catch (e) {
    console.error('[voice-webhook]', e);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
