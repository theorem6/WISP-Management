/**
 * Voice / SIP / UC — MongoDB models (tenant-scoped via tenantId).
 */

const mongoose = require('mongoose');

const VoiceProviderAccountSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    provider: { type: String, required: true, enum: ['bandwidth', 'telnyx', 'twilio'], index: true },
    externalAccountId: { type: String, required: true },
    displayName: String,
    credentialRef: { type: String }, // KMS / Secret Manager key id — never store raw secrets
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);
VoiceProviderAccountSchema.index({ tenantId: 1, provider: 1, externalAccountId: 1 }, { unique: true });

const TelephoneNumberSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    e164: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: ['inventory', 'assigned', 'suspended'], index: true },
    voiceProviderAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoiceProviderAccount', required: true },
    providerTnId: String,
    rateCenter: String,
    lata: String,
    /** Optional link for UI “911” column — do not conflate with TN.status */
    emergencyAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyAddress' },
    /** Customer.business id (e.g. CUST-2025-001) — links voice inventory to Customers module */
    customerId: { type: String, index: true }
  },
  { timestamps: true }
);
TelephoneNumberSchema.index({ tenantId: 1, e164: 1 }, { unique: true });
TelephoneNumberSchema.index({ tenantId: 1, customerId: 1 });

const ServiceLocationSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    /** Optional link to Customer.customerId for E911 / service address alignment */
    customerId: { type: String, index: true },
    street: String,
    unit: String,
    city: String,
    state: String,
    postal: String,
    country: { type: String, default: 'US' },
    latitude: Number,
    longitude: Number,
    geocodeAccuracyM: Number,
    geocodeSource: { type: String, enum: ['arcgis', 'manual', 'carrier_validated'] },
    geocodeLocatorName: String,
    geocodeScore: Number
  },
  { timestamps: true }
);

const EmergencyAddressSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    serviceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceLocation', required: true },
    voiceProviderAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoiceProviderAccount', required: true },
    providerAddressId: String,
    validationStatus: {
      type: String,
      required: true,
      enum: ['pending', 'validated', 'rejected', 'needs_update'],
      default: 'pending',
      index: true
    },
    lastVerifiedAt: Date
  },
  { timestamps: true }
);

const EmergencyEndpointSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    telephoneNumberE164: { type: String, required: true },
    emergencyAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyAddress', required: true },
    voiceProviderAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoiceProviderAccount', required: true },
    providerEndpointId: String,
    pidfLoPolicyRef: String
  },
  { timestamps: true }
);

const EmergencyAddressHistorySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    emergencyAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyAddress', required: true },
    changedAt: { type: Date, default: Date.now },
    changedByUserId: String,
    ticketId: String,
    previousSnapshot: mongoose.Schema.Types.Mixed,
    newSnapshot: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

const CnamProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    telephoneNumberE164: String,
    defaultName: String,
    presentationRules: String,
    providerLidbOrderId: String,
    status: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending' }
  },
  { timestamps: true }
);

const PortOrderSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'submitted', 'pending', 'foc_confirmed', 'activated', 'failed'],
      default: 'draft',
      index: true
    },
    telephoneNumbersE164: [{ type: String }],
    losingCarrierName: String,
    losingCarrierSpid: String,
    focTargetDate: String,
    providerOrderId: String,
    rejectReasonCodes: [{ type: String }],
    voiceProviderAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoiceProviderAccount' }
  },
  { timestamps: true }
);

const PortOrderEventSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    portOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PortOrder', required: true, index: true },
    receivedAt: { type: Date, default: Date.now },
    rawPayloadRef: String,
    transitionFrom: String,
    transitionTo: String,
    notes: String,
    rawPayloadSummary: String
  },
  { timestamps: true }
);

/** Webhook idempotency + audit (not tenant-scoped — carrier sends provider + event id). */
const VoiceWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    rawPayload: String,
    tenantId: String
  },
  { timestamps: true }
);
VoiceWebhookEventSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });

const VoiceProviderAccount = mongoose.models.VoiceProviderAccount || mongoose.model('VoiceProviderAccount', VoiceProviderAccountSchema);
const TelephoneNumber = mongoose.models.TelephoneNumber || mongoose.model('TelephoneNumber', TelephoneNumberSchema);
const ServiceLocation = mongoose.models.ServiceLocation || mongoose.model('ServiceLocation', ServiceLocationSchema);
const EmergencyAddress = mongoose.models.EmergencyAddress || mongoose.model('EmergencyAddress', EmergencyAddressSchema);
const EmergencyEndpoint = mongoose.models.EmergencyEndpoint || mongoose.model('EmergencyEndpoint', EmergencyEndpointSchema);
const EmergencyAddressHistory = mongoose.models.EmergencyAddressHistory || mongoose.model('EmergencyAddressHistory', EmergencyAddressHistorySchema);
const CnamProfile = mongoose.models.CnamProfile || mongoose.model('CnamProfile', CnamProfileSchema);
const PortOrder = mongoose.models.PortOrder || mongoose.model('PortOrder', PortOrderSchema);
const PortOrderEvent = mongoose.models.PortOrderEvent || mongoose.model('PortOrderEvent', PortOrderEventSchema);
const VoiceWebhookEvent = mongoose.models.VoiceWebhookEvent || mongoose.model('VoiceWebhookEvent', VoiceWebhookEventSchema);

module.exports = {
  VoiceProviderAccount,
  TelephoneNumber,
  ServiceLocation,
  EmergencyAddress,
  EmergencyEndpoint,
  EmergencyAddressHistory,
  CnamProfile,
  PortOrder,
  PortOrderEvent,
  VoiceWebhookEvent
};
