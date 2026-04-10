/**
 * Customer Management Schema
 * Track customer information, service installations, complaints, and service history
 */

const mongoose = require('mongoose');

// ============================================================================
// CUSTOMER SCHEMA
// ============================================================================

const CustomerSchema = new mongoose.Schema({
  // Tenant
  tenantId: { type: String, required: true, index: true },
  /** Ephemeral demo visitors (IP-derived); purged on demo logout — see docs/deployment/DEMO_VISITOR.md */
  demoVisitorKey: { type: String, index: true, sparse: true },
  
  // Identification
  customerId: { type: String, required: true, unique: true }, // CUST-2025-001
  isLead: { type: Boolean, default: false, index: true },
  leadSource: { type: String },
  associatedPlanId: { type: String, index: true },
  leadStatus: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'disqualified'],
    default: 'new'
  },
  leadMetadata: mongoose.Schema.Types.Mixed,
  leadHash: { type: String, index: true },
  
  // Personal Information
  firstName: { 
    type: String, 
    required: function() {
      return !this.isLead;
    } 
  },
  lastName: { 
    type: String, 
    required: function() {
      return !this.isLead;
    } 
  },
  fullName: { type: String }, // Auto-generated from first + last
  
  // Contact Information
  primaryPhone: { 
    type: String, 
    required: function() {
      return !this.isLead;
    }, 
    index: true 
  },
  alternatePhone: String,
  email: { type: String, index: true },
  
  // Service Address (Installation Location)
  serviceAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' },
    
    // GPS coordinates for map display
    latitude: Number,
    longitude: Number,
    
    // Additional location details
    directions: String,          // "Turn left at red barn"
    gateCode: String,            // Access code
    parkingInstructions: String
  },
  
  // Billing Address (if different)
  billingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' },
    sameAsService: { type: Boolean, default: true }
  },
  
  // Service Information
  serviceStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'cancelled', 'trial'],
    default: 'pending'
  },
  
  // Customer Service Type
  serviceType: {
    type: String,
    enum: ['4G/5G', 'FWA', 'WiFi', 'Fiber'],
    index: true
  },
  
  // Customer Group (for HSS/bandwidth plan assignment)
  groupId: {
    type: String,
    index: true,
    sparse: true
  },
  
  servicePlan: {
    planName: String,           // "50/10 Mbps"
    downloadMbps: Number,
    uploadMbps: Number,
    monthlyFee: Number,
    currency: { type: String, default: 'USD' },
    // Speed package details for QoS
    qci: { type: Number, default: 9 }, // Quality Class Identifier (LTE/5G)
    maxBandwidthDl: Number,    // Max downlink bandwidth (bps)
    maxBandwidthUl: Number,    // Max uplink bandwidth (bps)
    dataQuota: Number,         // Monthly data quota in bytes (0 = unlimited)
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'premium'], default: 'medium' }
  },
  
  // LTE/5G Authentication Credentials (encrypted in cloud HSS, stored here for sync)
  lteAuth: {
    ki: String,                 // Authentication key (128-bit or 256-bit hex)
    op: String,                 // Operator variant (OP) - alternative to OPc
    opc: String,                // Operator variant (OPc) - computed from OP and Ki
    sqn: { type: Number, default: 0 }, // Sequence number for AKA
    // Note: Ki, OP, OPc should be encrypted when stored in database
    // These are required for 4G/5G service types
  },
  
  // MAC Address (optional, for ACS integration)
  macAddress: {
    type: String,
    index: true,
    sparse: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // Validate MAC address format (xx:xx:xx:xx:xx:xx or xx-xx-xx-xx-xx-xx)
        return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(v);
      },
      message: 'MAC address must be in format xx:xx:xx:xx:xx:xx or xx-xx-xx-xx-xx-xx'
    }
  },
  
  // Installation Details
  installation: {
    status: { 
      type: String, 
      enum: ['not-scheduled', 'scheduled', 'in-progress', 'completed', 'failed'],
      default: 'not-scheduled'
    },
    scheduledDate: Date,
    completedDate: Date,
    installedBy: String,        // User ID
    installerName: String,
    workOrderId: String,        // Reference to work order
    
    // Equipment installed
    cpeSerialNumber: String,
    cpeModel: String,
    otherEquipment: [String]
  },
  
  // Network Information (linked from HSS/ACS)
  networkInfo: {
    imsi: String,               // IMSI from HSS
    msisdn: String,             // Phone number
    ipAddress: String,          // Assigned IP
    cpeSerialNumber: String,    // From ACS
    signalStrength: Number,     // dBm
    lastOnline: Date
  },
  
  // Service History
  serviceHistory: [{
    date: { type: Date, default: Date.now },
    type: { 
      type: String, 
      enum: ['installation', 'repair', 'upgrade', 'maintenance', 'support-call', 'billing', 'other']
    },
    description: String,
    technician: String,
    workOrderId: String,
    notes: String
  }],
  
  // Complaints & Issues
  complaints: [{
    date: { type: Date, default: Date.now },
    category: {
      type: String,
      enum: ['slow-speed', 'no-connection', 'intermittent', 'equipment-failure', 'billing-issue', 'other']
    },
    description: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'] },
    assignedTo: String,
    workOrderId: String,        // Created work order
    resolution: String,
    resolvedDate: Date
  }],
  
  // Notes & Tags
  notes: String,
  tags: [String],               // ["vip", "business", "problematic"]
  
  // Account Status
  accountStatus: {
    type: String,
    enum: ['good-standing', 'payment-overdue', 'suspended', 'cancelled'],
    default: 'good-standing'
  },
  
  // Billing
  billingInfo: {
    accountBalance: { type: Number, default: 0 },
    lastPaymentDate: Date,
    lastPaymentAmount: Number,
    nextBillingDate: Date,
    autopay: { type: Boolean, default: false }
  },
  
  // Referral & Marketing
  referredBy: String,           // Customer ID who referred
  acquisitionChannel: String,   // "website", "referral", "door-to-door"
  
  // Customer Portal Access
  portalAccess: {
    enabled: { type: Boolean, default: true },
    firebaseUid: { 
      type: String, 
      unique: true, 
      sparse: true, 
      index: true 
    },
    accountCreatedAt: Date,
    lastLoginAt: Date,
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'locked'],
      default: 'pending'
    },
    accessCode: String,        // For account linking
    accessCodeExpires: Date
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  createdBy: String,            // User ID
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String,
  
  isActive: { type: Boolean, default: true }
});

// Indexes for performance
CustomerSchema.index({ tenantId: 1, customerId: 1 });
CustomerSchema.index({ tenantId: 1, primaryPhone: 1 });
CustomerSchema.index({ tenantId: 1, email: 1 });
CustomerSchema.index({ tenantId: 1, serviceStatus: 1 });
CustomerSchema.index({ tenantId: 1, serviceType: 1 });
CustomerSchema.index({ 'serviceAddress.latitude': 1, 'serviceAddress.longitude': 1 });
CustomerSchema.index({ 'networkInfo.imsi': 1 });
CustomerSchema.index({ tenantId: 1, leadHash: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ macAddress: 1 }, { sparse: true });

// Pre-save middleware - generate fullName
CustomerSchema.pre('save', function(next) {
  if (this.isLead) {
    if (!this.firstName) {
      this.firstName = 'Prospect';
    }
    if (!this.lastName) {
      this.lastName = 'Lead';
    }
  }

  if (this.firstName && this.lastName) {
    this.fullName = `${this.firstName} ${this.lastName}`.trim();
  } else if (!this.fullName && this.firstName) {
    this.fullName = this.firstName;
  }

  this.updatedAt = new Date();
  next();
});

// Virtual for display
CustomerSchema.virtual('displayName').get(function() {
  return this.fullName || `${this.firstName} ${this.lastName}`;
});

const Customer = mongoose.model('Customer', CustomerSchema);

module.exports = { Customer, CustomerSchema };

