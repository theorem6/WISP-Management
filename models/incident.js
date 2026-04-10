// Incident Schema
// Auto-reported incidents from monitoring, app events, or employee reports
// These can be converted to tickets for resolution

const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  // Tenant
  tenantId: { type: String, required: true, index: true },
  demoVisitorKey: { type: String, index: true, sparse: true },
  
  // Identification
  incidentNumber: { type: String, required: true, unique: true }, // INC-2025-001
  incidentId: { type: String, unique: true, sparse: true }, // External incident ID
  
  // Source of incident
  source: {
    type: String,
    required: true,
    enum: [
      'monitoring',      // Auto-detected from monitoring systems
      'mobile-app',      // Reported from mobile app
      'employee-report', // Manual report from employee
      'customer-report', // Customer-reported (converted from ticket)
      'system',          // System-generated
      'other'
    ]
  },
  
  // Source details
  sourceDetails: {
    ruleId: String,           // Monitoring rule ID
    ruleName: String,         // Monitoring rule name
    deviceId: String,         // Device that triggered
    siteId: String,           // Site where incident occurred
    appUserId: String,        // User who reported via app
    appUserName: String,
    reportedBy: String,       // User ID who reported
    reportedByName: String
  },
  
  // Incident Type
  incidentType: {
    type: String,
    required: true,
    enum: [
      'cpe-offline',           // CPE device offline
      'sector-down',           // Radio sector down
      'backhaul-failure',      // Backhaul link failure
      'network-outage',        // Network-wide outage
      'equipment-failure',     // Equipment failure
      'power-outage',          // Power failure
      'performance-degradation', // Performance issues
      'configuration-error',   // Configuration problem
      'security-breach',       // Security incident
      'fiber-cut',            // Fiber cut
      'tower-issue',          // Tower site problem
      'environmental',        // Environmental issue
      'other'
    ]
  },
  
  // Severity
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: [
      'new',              // Newly created
      'investigating',    // Under investigation
      'acknowledged',     // Acknowledged by team
      'mitigated',        // Temporarily mitigated
      'resolved',         // Resolved
      'converted',        // Converted to ticket
      'closed',           // Closed
      'false-positive'    // False alarm
    ],
    default: 'new'
  },
  
  // Affected Resources
  affectedEquipment: [{
    equipmentId: String,
    serialNumber: String,
    description: String,
    status: String // 'offline', 'degraded', 'failed'
  }],
  
  affectedSites: [{
    siteId: String,
    siteName: String,
    siteType: String,
    impact: String // 'down', 'degraded', 'affected'
  }],
  
  affectedCustomers: [{
    customerId: String,
    customerName: String,
    phoneNumber: String,
    serviceAddress: String,
    impact: String // 'outage', 'degraded', 'affected'
  }],
  
  // Description
  title: { type: String, required: true },
  description: String,
  initialObservations: String,
  
  // Location
  location: {
    type: {
      type: String,
      enum: ['tower', 'customer', 'warehouse', 'noc', 'backhaul', 'other']
    },
    siteId: String,
    siteName: String,
    address: String,
    gpsCoordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Metrics/Data at time of incident
  incidentMetrics: {
    timestamp: Date,
    values: mongoose.Schema.Types.Mixed, // Store metric values
    snapshot: mongoose.Schema.Types.Mixed // System state snapshot
  },
  
  // Related Ticket (if converted)
  relatedTicketId: String,
  relatedTicketNumber: String,
  convertedAt: Date,
  convertedBy: String,
  
  // Investigation
  investigationNotes: [{
    timestamp: { type: Date, default: Date.now },
    note: String,
    addedBy: String,
    addedByName: String
  }],
  
  rootCause: String,
  resolution: String,
  
  // Timestamps
  detectedAt: { type: Date, default: Date.now },
  acknowledgedAt: Date,
  acknowledgedBy: String,
  acknowledgedByName: String,
  resolvedAt: Date,
  resolvedBy: String,
  closedAt: Date,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String
});

// ============================================================================
// INDEXES
// ============================================================================

IncidentSchema.index({ tenantId: 1, incidentNumber: 1 }, { unique: true });
IncidentSchema.index({ tenantId: 1, status: 1 });
IncidentSchema.index({ tenantId: 1, severity: 1 });
IncidentSchema.index({ tenantId: 1, incidentType: 1 });
IncidentSchema.index({ tenantId: 1, source: 1 });
IncidentSchema.index({ tenantId: 1, relatedTicketId: 1 });
IncidentSchema.index({ tenantId: 1, 'affectedSites.siteId': 1 });
IncidentSchema.index({ detectedAt: -1 });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update timestamp on save
IncidentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Auto-generate incident number
IncidentSchema.pre('save', async function(next) {
  if (this.isNew && !this.incidentNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const count = await this.constructor.countDocuments({ tenantId: this.tenantId });
    this.incidentNumber = `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// ============================================================================
// METHODS
// ============================================================================

// Acknowledge incident
IncidentSchema.methods.acknowledge = function(userId, userName) {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = userId;
  this.acknowledgedByName = userName;
  return this.save();
};

// Convert to ticket
IncidentSchema.methods.convertToTicket = function(ticketId, ticketNumber, userId) {
  this.status = 'converted';
  this.relatedTicketId = ticketId;
  this.relatedTicketNumber = ticketNumber;
  this.convertedAt = new Date();
  this.convertedBy = userId;
  return this.save();
};

// Resolve incident
IncidentSchema.methods.resolve = function(resolution, userId) {
  this.status = 'resolved';
  this.resolution = resolution;
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  return this.save();
};

// Close incident
IncidentSchema.methods.close = function() {
  this.status = 'closed';
  this.closedAt = new Date();
  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

// Get active incidents
IncidentSchema.statics.getActiveIncidents = function(tenantId) {
  return this.find({
    tenantId,
    status: { $in: ['new', 'investigating', 'acknowledged', 'mitigated'] }
  }).sort({ severity: -1, detectedAt: -1 });
};

// Get incidents by severity
IncidentSchema.statics.getBySeverity = function(tenantId, severity) {
  return this.find({
    tenantId,
    severity,
    status: { $nin: ['resolved', 'closed', 'false-positive'] }
  }).sort({ detectedAt: -1 });
};

// Get incidents by site
IncidentSchema.statics.getBySite = function(tenantId, siteId) {
  return this.find({
    tenantId,
    'affectedSites.siteId': siteId,
    status: { $nin: ['resolved', 'closed'] }
  }).sort({ detectedAt: -1 });
};

// ============================================================================
// MODEL
// ============================================================================

const Incident = mongoose.model('Incident', IncidentSchema);

module.exports = {
  Incident,
  IncidentSchema
};
