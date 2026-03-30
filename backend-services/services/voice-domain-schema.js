/**
 * Voice / SIP / UC domain reference JSON (no secrets).
 * Bounded contexts: identity & tenancy, numbers, emergency, porting.
 */

function enumList(values) {
  return [...values];
}

function getDomainSchema() {
  return {
    bounded_contexts: [
      { id: 'identity_tenancy', label: 'Identity & tenancy', entities: ['Organization', 'VoiceProviderAccount'] },
      { id: 'numbers', label: 'Numbers & voice endpoints', entities: ['TelephoneNumber', 'SipTrunk', 'VoiceApplication', 'EndUser', 'SubscriberVoiceProfile'] },
      { id: 'emergency', label: 'E911', entities: ['ServiceLocation', 'EmergencyAddress', 'EmergencyEndpoint', 'EmergencyAddressHistory'] },
      { id: 'cnam', label: 'CNAM / display', entities: ['CnamProfile'] },
      { id: 'porting', label: 'LNP (porting)', entities: ['PortOrder', 'PortOrderEvent'] }
    ],
    entities: {
      Organization: 'Tenant; maps to your existing organization/tenant record.',
      VoiceProviderAccount: 'Provider enum, external account_id, credential_ref (KMS) — one boundary per tenant↔carrier.',
      TelephoneNumber: 'E.164, org, status, voice_provider_account_id, provider TN id, optional rate center/LATA.',
      SipTrunk: 'Optional origination/termination trunk id per tenant.',
      VoiceApplication: 'Optional voice app / connection id per tenant.',
      EndUser: 'Customer user in your IdP/CRM.',
      SubscriberVoiceProfile: 'Links user to default TN, 911 profile, device constraints.',
      ServiceLocation: 'Normalized address + geocode (lat/lon, accuracy, geocode_source).',
      EmergencyAddress: 'Carrier address record; validation_status; links ServiceLocation.',
      EmergencyEndpoint: 'Per registration 911 binding: TN + EmergencyAddress + optional PIDF-LO.',
      EmergencyAddressHistory: 'Append-only audit: who changed address, old→new, ticket id.',
      CnamProfile: 'Outbound CNAM / LIDB order id and status.',
      PortOrder: 'LNP order state machine + losing carrier + FOC + provider order id.',
      PortOrderEvent: 'Webhook events with payload ref and state transition.'
    },
    state_machines: {
      'PortOrder.status': enumList(['draft', 'submitted', 'pending', 'foc_confirmed', 'activated', 'failed']),
      'EmergencyAddress.validation_status': enumList(['pending', 'validated', 'rejected', 'needs_update']),
      'TelephoneNumber.status': enumList(['inventory', 'assigned', 'suspended']),
      notes: [
        'Do not conflate ported/active numbers with E911 complete — block go-live or warn if 911 not provisioned.'
      ]
    },
    carrier_comparison: [
      {
        dimension: 'Operator / wholesale',
        bandwidth: 'CLEC-style API; sites/subaccounts for tenant isolation.',
        telnyx: 'SIP + numbers + porting; strong for owned SIP infra.',
        twilio: 'CPaaS; Subaccounts standard for SaaS multi-tenant.'
      },
      {
        dimension: 'E911',
        bandwidth: 'Emergency APIs / structured provisioning.',
        telnyx: 'Dynamic E911; SIP headers — SIP-first.',
        twilio: 'Addresses + Emergency resources; familiar CPaaS model.'
      },
      {
        dimension: 'LNP',
        bandwidth: 'Port-in / number moves in numbers operations.',
        telnyx: 'Porting APIs and portability check first-class.',
        twilio: 'Porting APIs; common in tutorials.'
      },
      {
        dimension: 'CNAM / display',
        bandwidth: 'LIDB-style wholesale flows.',
        telnyx: 'Number / messaging profile style — verify current voice CNAM product.',
        twilio: 'Trust Hub / branded calling adjacent — verify current Voice CNAM vs SHAKEN.'
      },
      {
        dimension: 'Multi-tenant',
        bandwidth: 'Sites 1:1 with org (typical reseller).',
        telnyx: 'Often one account + your RBAC; separate orgs for large tenants.',
        twilio: 'Subaccounts per tenant — battle-tested.'
      }
    ],
    pragmatic_recommendation:
      'One primary carrier per environment for numbers + 911 + porting; stay provider-abstracted behind VoiceProviderAccount and adapters. Twilio: fastest subaccount-per-tenant. Bandwidth: wholesale/sites. Telnyx: SIP trunking + dynamic E911.',
    arcgis: {
      uses: [
        'Geocode ServiceLocation → lat/lon; store locator name and score.',
        'QA: flag low match score or wrong parcel before sending to carrier.',
        'Ops/NOC: map open 911 or port issues (internal dashboard).',
        'PSAP boundaries: often rely on carrier-validated address, not self-drawn polygons.'
      ],
      note: 'ArcGIS improves address UX/quality; PSAP routing on the voice path remains carrier/network.'
    },
    phased_rollout: [
      { phase: 0, scope: 'Read-only: inventory TNs from carrier; no 911/LNP yet.' },
      { phase: 1, scope: 'E911: ServiceLocation + carrier emergency address/endpoint; block production voice until validated or waiver.' },
      { phase: 2, scope: 'LNP: portability check + port orders + webhooks.' },
      { phase: 3, scope: 'CNAM + polish (notifications, audit exports).' }
    ],
    first_build_in_code: [
      'VoiceProviderAccount + adapter interface (provisionEmergencyAddress, createPortOrder, handleWebhook).',
      'Webhook endpoint with signature verification + idempotency keys.',
      'Tenant admin UI: TN list, 911 column (✓/⚠), port status.'
    ],
    enums: {
      VoiceProvider: ['bandwidth', 'telnyx', 'twilio'],
      PortOrderStatus: ['draft', 'submitted', 'pending', 'foc_confirmed', 'activated', 'failed'],
      EmergencyAddressValidationStatus: ['pending', 'validated', 'rejected', 'needs_update'],
      TelephoneNumberStatus: ['inventory', 'assigned', 'suspended'],
      GeocodeSource: ['arcgis', 'manual', 'carrier_validated'],
      CnamProfileStatus: ['pending', 'active', 'failed']
    }
  };
}

module.exports = { getDomainSchema };
