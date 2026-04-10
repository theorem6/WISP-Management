// Work Order & Ticketing Schema
// Track installations, repairs, and trouble tickets

const mongoose = require('mongoose');

// ============================================================================
// WORK ORDER SCHEMA
// ============================================================================

const WorkOrderSchema = new mongoose.Schema({
  // Tenant
  tenantId: { type: String, required: true, index: true },
  demoVisitorKey: { type: String, index: true, sparse: true },
  
  // Identification
  ticketNumber: { type: String, required: true, unique: true }, // TKT-2025-001
  type: {
    type: String,
    required: true,
    enum: [
      'installation',      // New installation
      'repair',           // Fix existing equipment
      'maintenance',      // Scheduled maintenance
      'upgrade',          // Equipment upgrade
      'removal',          // Decommission
      'troubleshoot',     // Diagnose issue
      'inspection',       // Site inspection
      'other'
    ]
  },
  
  // Ticket Category (customer-facing vs infrastructure)
  ticketCategory: {
    type: String,
    enum: ['customer-facing', 'infrastructure'],
    default: 'customer-facing'
  },
  
  // Issue Category (for troubleshooting)
  issueCategory: {
    type: String,
    enum: [
      'cpe-offline',
      'sector-down',
      'backhaul-failure',
      'network-outage',
      'poor-performance',
      'equipment-failure',
      'power-issue',
      'configuration-error',
      'other'
    ]
  },
  
  // Priority
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['open', 'assigned', 'in-progress', 'waiting-parts', 'waiting-approval', 'resolved', 'closed', 'cancelled'],
    default: 'open'
  },
  
  // Approval Workflow (for installations)
  requiresApproval: { type: Boolean, default: false },
  approvalStatus: {
    type: String,
    enum: ['not-required', 'pending', 'under-review', 'approved', 'rejected'],
    default: 'not-required'
  },
  approvedAt: Date,
  approvedBy: String, // User ID (management)
  approvedByName: String,
  approvalNotes: String,
  
  // Assignment
  assignedTo: String,      // User ID
  assignedToName: String,  // User display name
  assignedAt: Date,
  
  // Affected Resources
  affectedEquipment: [{
    equipmentId: String,
    serialNumber: String,
    description: String
  }],
  
  affectedSites: [{
    siteId: String,
    siteName: String,
    siteType: String
  }],
  
  affectedCustomers: [{
    customerId: String,
    customerName: String,
    phoneNumber: String,
    serviceAddress: String
  }],
  
  // Description
  title: { type: String, required: true },
  description: String,
  symptoms: String,
  
  // Customer Info (if applicable)
  customerReported: Boolean,
  customerContact: {
    name: String,
    phone: String,
    email: String
  },
  
  // Location
  location: {
    type: {
      type: String,
      enum: ['tower', 'customer', 'warehouse', 'noc', 'other']
    },
    siteId: String,
    siteName: String,
    address: String,
    gpsCoordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Scheduling
  scheduledDate: Date,
  scheduledTimeWindow: String, // "9:00 AM - 12:00 PM"
  estimatedDuration: Number,   // minutes
  
  // Actual Times
  startedAt: Date,
  arrivedAt: Date,
  completedAt: Date,
  closedAt: Date,
  
  // SLA
  sla: {
    responseTimeHours: Number,   // Must respond within X hours
    resolutionTimeHours: Number, // Must resolve within X hours
    responseDeadline: Date,
    resolutionDeadline: Date,
    breached: Boolean
  },
  
  // Work Performed
  workPerformed: [{
    timestamp: { type: Date, default: Date.now },
    action: String,
    performedBy: String,
    performedByName: String,
    notes: String,
    photos: [String], // URLs to photos
    equipmentUsed: [{
      equipmentId: String,
      serialNumber: String,
      action: String // "deployed", "removed", "replaced"
    }]
  }],
  
  // Parts Used
  partsUsed: [{
    inventoryItemId: String,
    serialNumber: String,
    description: String,
    quantity: Number,
    action: String // "installed", "removed", "consumed"
  }],
  
  // Resolution
  resolution: String,
  rootCause: String,
  preventiveMeasures: String,
  
  // Follow-up
  requiresFollowUp: Boolean,
  followUpDate: Date,
  followUpNotes: String,
  
  // Documentation
  photos: [String], // URLs
  attachments: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: Date,
    uploadedBy: String
  }],
  
  // Customer Signature
  customerSignature: {
    signatureUrl: String,
    signedAt: Date,
    customerName: String
  },
  
  // Internal Notes
  internalNotes: String,
  customerVisibleNotes: String,
  
  // Billing (if applicable)
  billable: Boolean,
  laborHours: Number,
  laborRate: Number,
  totalCost: Number,
  invoiced: Boolean,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  createdBy: String,
  createdByName: String,
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String
});

// ============================================================================
// INDEXES
// ============================================================================

WorkOrderSchema.index({ tenantId: 1, ticketNumber: 1 }, { unique: true });
WorkOrderSchema.index({ tenantId: 1, status: 1 });
WorkOrderSchema.index({ tenantId: 1, priority: 1 });
WorkOrderSchema.index({ tenantId: 1, assignedTo: 1 });
WorkOrderSchema.index({ tenantId: 1, type: 1 });
WorkOrderSchema.index({ tenantId: 1, 'location.siteId': 1 });
WorkOrderSchema.index({ 'sla.resolutionDeadline': 1 });
WorkOrderSchema.index({ createdAt: -1 });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update timestamp on save
WorkOrderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Auto-generate ticket number
WorkOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const count = await this.constructor.countDocuments({ tenantId: this.tenantId });
    this.ticketNumber = `TKT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Calculate SLA deadlines
WorkOrderSchema.pre('save', function(next) {
  if (this.isNew && this.sla && !this.sla.responseDeadline) {
    if (this.sla.responseTimeHours) {
      this.sla.responseDeadline = new Date(this.createdAt.getTime() + this.sla.responseTimeHours * 60 * 60 * 1000);
    }
    if (this.sla.resolutionTimeHours) {
      this.sla.resolutionDeadline = new Date(this.createdAt.getTime() + this.sla.resolutionTimeHours * 60 * 60 * 1000);
    }
  }
  next();
});

// ============================================================================
// METHODS
// ============================================================================

// Assign work order to technician
WorkOrderSchema.methods.assignTo = function(userId, userName) {
  this.assignedTo = userId;
  this.assignedToName = userName;
  this.assignedAt = new Date();
  this.status = 'assigned';
  return this.save();
};

// Start work
WorkOrderSchema.methods.startWork = function(userId) {
  this.status = 'in-progress';
  this.startedAt = new Date();
  return this.save();
};

// Add work log entry
WorkOrderSchema.methods.addWorkLog = function(logEntry) {
  this.workPerformed.push(logEntry);
  return this.save();
};

// Complete work order
WorkOrderSchema.methods.complete = function(resolution) {
  this.status = 'resolved';
  this.completedAt = new Date();
  this.resolution = resolution;
  return this.save();
};

// Close work order
WorkOrderSchema.methods.close = function() {
  this.status = 'closed';
  this.closedAt = new Date();
  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

// Get open tickets for a technician
WorkOrderSchema.statics.getAssignedTickets = function(tenantId, userId) {
  return this.find({
    tenantId,
    assignedTo: userId,
    status: { $in: ['assigned', 'in-progress'] }
  }).sort({ priority: -1, createdAt: 1 });
};

// Get tickets by site
WorkOrderSchema.statics.getBySite = function(tenantId, siteId) {
  return this.find({
    tenantId,
    'affectedSites.siteId': siteId
  }).sort({ createdAt: -1 });
};

// Get SLA breached tickets
WorkOrderSchema.statics.getSLABreached = function(tenantId) {
  const now = new Date();
  return this.find({
    tenantId,
    status: { $nin: ['resolved', 'closed'] },
    $or: [
      { 'sla.responseDeadline': { $lt: now }, startedAt: null },
      { 'sla.resolutionDeadline': { $lt: now }, completedAt: null }
    ]
  }).sort({ 'sla.resolutionDeadline': 1 });
};

// ============================================================================
// MODEL
// ============================================================================

const WorkOrder = mongoose.model('WorkOrder', WorkOrderSchema);

module.exports = {
  WorkOrder,
  WorkOrderSchema
};

