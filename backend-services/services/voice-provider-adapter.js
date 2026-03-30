/**
 * Provider-abstracted voice operations — stub until Bandwidth/Telnyx/Twilio keys are wired.
 */

class VoiceProviderAdapter {
  provisionEmergencyAddress(voiceProviderAccountExternalId, serviceLocationPayload) {
    throw new Error('provisionEmergencyAddress not implemented');
  }

  createPortOrder(voiceProviderAccountExternalId, orderPayload) {
    throw new Error('createPortOrder not implemented');
  }

  handleWebhook(provider, rawBody, headers) {
    throw new Error('handleWebhook not implemented');
  }
}

class StubVoiceProviderAdapter extends VoiceProviderAdapter {
  provisionEmergencyAddress(voiceProviderAccountExternalId, serviceLocationPayload) {
    return {
      ok: true,
      stub: true,
      voiceProviderAccountExternalId,
      providerAddressId: 'stub-addr-1',
      validationStatus: 'pending'
    };
  }

  createPortOrder(voiceProviderAccountExternalId, orderPayload) {
    const tns = orderPayload.telephone_numbers_e164 || orderPayload.telephoneNumbersE164 || [];
    return {
      ok: true,
      stub: true,
      voiceProviderAccountExternalId,
      providerOrderId: 'stub-port-1',
      status: 'submitted',
      telephoneNumbersE164: tns
    };
  }

  handleWebhook(provider, rawBody, headers) {
    let parsed = {};
    try {
      parsed = rawBody && String(rawBody).trim() ? JSON.parse(rawBody) : {};
    } catch {
      parsed = { raw: String(rawBody || '').slice(0, 2000) };
    }
    return {
      ok: true,
      stub: true,
      provider: String(provider),
      parsed,
      headerKeys: Object.keys(headers || {}).sort()
    };
  }
}

function getDefaultAdapter() {
  return new StubVoiceProviderAdapter();
}

module.exports = {
  VoiceProviderAdapter,
  StubVoiceProviderAdapter,
  getDefaultAdapter
};
