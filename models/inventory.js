// Comprehensive Inventory Management Schema
// Centralized asset tracking for all network equipment

const mongoose = require('mongoose');

// ============================================================================
// LOCATION SCHEMA (embedded)
// ============================================================================
const LocationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['warehouse', 'tower', 'noc', 'vehicle', 'customer', 'rma', 'vendor', 'other'],
    required: true
  },
  // Link to tower site (if type is 'tower' or 'noc')
  siteId: String,
  siteName: String,
  
  // Specific location details
  warehouse: {
    name: String,
    section: String,
    aisle: String,
    shelf: String,
    bin: String
  },
  
  // Tower/NOC location details
  tower: {
    rack: String,
    rackUnit: String, // e.g., "10-15" for RU 10 through 15
    cabinet: String,
    position: String // "indoor", "outdoor", "rooftop"
  },
  
  // Vehicle details
  vehicle: {
    vehicleId: String,
    vehicleName: String,
    driver: String
  },
  
  // Customer details
  customer: {
    customerId: String,
    customerName: String,
    serviceAddress: String
  },
  
  // General address (for any location type)
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    latitude: Number,
    longitude: Number
  },
  
  notes: String
}, { _id: false });

// ============================================================================
// PURCHASE INFO SCHEMA (embedded)
// ============================================================================
const PurchaseInfoSchema = new mongoose.Schema({
  vendor: String,
  vendorContact: String,
  purchaseDate: Date,
  purchasePrice: Number,
  currency: { type: String, default: 'USD' },
  purchaseOrderNumber: String,
  invoiceNumber: String,
  paymentMethod: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'refunded'],
    default: 'paid'
  },
  notes: String
}, { _id: false });

// ============================================================================
// WARRANTY INFO SCHEMA (embedded)
// ============================================================================
const WarrantyInfoSchema = new mongoose.Schema({
  provider: String, // Manufacturer, vendor, or third-party
  startDate: Date,
  endDate: Date,
  type: {
    type: String,
    enum: ['manufacturer', 'extended', 'third-party', 'none'],
    default: 'manufacturer'
  },
  coverageLevel: String, // "basic", "advanced", "next-business-day", etc.
  warrantyNumber: String,
  contactInfo: String,
  notes: String
}, { _id: false });

// ============================================================================
// MAINTENANCE RECORD SCHEMA (embedded)
// ============================================================================
const MaintenanceRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: {
    type: String,
    enum: ['preventive', 'repair', 'upgrade', 'inspection', 'calibration', 'other'],
    required: true
  },
  description: String,
  technician: String,
  technicianId: String,
  partsReplaced: [String],
  laborHours: Number,
  cost: Number,
  nextMaintenanceDate: Date,
  notes: String
}, { _id: false });

// ============================================================================
// LOCATION HISTORY SCHEMA (embedded)
// ============================================================================
const LocationHistorySchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  fromLocation: LocationSchema,
  toLocation: LocationSchema,
  reason: {
    type: String,
    enum: ['deployment', 'transfer', 'return', 'maintenance', 'rma', 'sale', 'disposal', 'other']
  },
  movedBy: String,
  movedById: String,
  workOrderId: String,
  notes: String
}, { _id: false });

// ============================================================================
// MAIN INVENTORY ITEM SCHEMA
// ============================================================================
const InventoryItemSchema = new mongoose.Schema({
  // Tenant
  tenantId: { type: String, required: true, index: true },
  demoVisitorKey: { type: String, index: true, sparse: true },
  
  // Basic Identity
  assetTag: { type: String, unique: true, sparse: true }, // Organization's internal asset tag
  barcode: String,
  qrCode: String,
  
  // Equipment Classification
  category: {
    type: String,
    required: true,
    enum: [
      'EPC Equipment',
      'Radio Equipment',
      'Antennas',
      'Power Systems',
      'Networking Equipment',
      'Transmission Equipment',
      'Environmental Control',
      'Monitoring & Control',
      'Structural & Housing',
      'Test Equipment',
      'CPE Devices',
      'SIM Cards',
      'Cables & Accessories',
      'Tools',
      'Spare Parts',
      'Other'
    ],
    validate: {
      validator: function(v) {
        // Allow existing EPC Equipment values even if enum doesn't match exactly
        return this.constructor.schema.path('category').enumValues.includes(v) || v === 'EPC Equipment';
      },
      message: 'Invalid category'
    }
  },
  
  subcategory: String, // e.g., "Base Station", "Sector Antenna", etc.
  equipmentType: { type: String, required: true },
  
  // Manufacturer Details
  manufacturer: String,
  model: String,
  partNumber: String,
  serialNumber: { type: String, required: true, index: true },
  macAddress: String,
  imei: String, // For devices with cellular
  
  // Network IP Address (accessible top-level field for ping monitoring)
  ipAddress: { type: String, index: true }, // Top-level IP address for ping monitoring
  
  // Software/Firmware
  firmwareVersion: String,
  softwareVersion: String,
  hardwareVersion: String,
  
  // Physical Characteristics
  physicalDescription: String,
  weight: Number, // in kg
  dimensions: {
    length: Number, // in cm
    width: Number,
    height: Number
  },
  color: String,
  
  // Current Status
  status: {
    type: String,
    required: true,
    enum: ['available', 'deployed', 'reserved', 'in-transit', 'maintenance', 'rma', 'retired', 'lost', 'sold'],
    default: 'available',
    index: true
  },
  
  condition: {
    type: String,
    enum: ['new', 'excellent', 'good', 'fair', 'poor', 'damaged', 'refurbished'],
    default: 'new'
  },
  
  // Current Location
  currentLocation: { type: LocationSchema, required: true },
  
  // Ownership
  ownership: {
    type: String,
    enum: ['owned', 'leased', 'rented', 'customer-owned', 'vendor-owned'],
    default: 'owned'
  },
  
  // Purchase Information
  purchaseInfo: PurchaseInfoSchema,
  
  // Warranty Information
  warranty: WarrantyInfoSchema,
  
  // Financial
  bookValue: Number, // Current book value
  depreciationRate: Number, // Annual depreciation rate (%)
  monthlyLeaseRate: Number, // If leased
  
  // Technical Specifications
  technicalSpecs: {
    powerRequirements: String, // "48V DC", "100-240V AC", etc.
    powerConsumption: Number, // in Watts
    operatingTemperature: String, // "-40°C to 60°C"
    ipRating: String, // "IP65", "IP67", etc.
    
    // Network specifications (if applicable)
    ipAddress: String,
    subnetMask: String,
    gateway: String,
    vlan: String,
    managementUrl: String,
    
    // RF specifications (if applicable)
    frequency: String,
    bandwidth: String,
    txPower: String,
    sensitivity: String
  },
  
  // Deployment Information
  deploymentInfo: {
    deployedDate: Date,
    deployedBy: String,
    deployedById: String,
    workOrderId: String,
    installationNotes: String,
    configurationBackup: String, // URL or path to config backup
    commissionedDate: Date
  },
  
  // Maintenance
  maintenanceSchedule: {
    frequency: String, // "monthly", "quarterly", "annually"
    nextMaintenanceDate: Date,
    lastMaintenanceDate: Date
  },
  maintenanceRecords: [MaintenanceRecordSchema],
  
  // History
  locationHistory: [LocationHistorySchema],
  
  // Module Integrations
  linkedModules: {
    // Link to Coverage Map site
    coverageMap: {
      siteId: String,
      siteName: String,
      addedToSiteDate: Date
    },
    
    // Link to ACS CPE device
    acs: {
      deviceId: String,
      serialNumber: String,
      connectionRequestUrl: String,
      lastInform: Date
    },
    
    // Link to HSS subscriber
    hss: {
      subscriberId: String,
      imsi: String,
      msisdn: String
    },
    
    // Link to PCI planning
    pci: {
      eNodeBId: Number,
      cellId: Number,
      pci: Number
    },
    
    // Link to CBRS
    cbrs: {
      cbsdId: String,
      fccId: String,
      serialNumber: String
    }
  },
  
  // Alerts & Notifications
  alerts: [{
    type: {
      type: String,
      enum: ['low-stock', 'warranty-expiring', 'maintenance-due', 'license-expiring', 'custom']
    },
    message: String,
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical']
    },
    createdAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: String,
    acknowledgedAt: Date
  }],
  
  // Attachments & Documentation
  attachments: [{
    name: String,
    type: String, // "manual", "datasheet", "certificate", "photo", "other"
    url: String,
    uploadedAt: Date,
    uploadedBy: String
  }],
  
  // Additional Notes
  notes: String,
  internalNotes: String, // Private notes not visible to all users
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  createdById: String,
  updatedBy: String,
  updatedById: String,
  
  // Custom Fields (for extensibility)
  customFields: mongoose.Schema.Types.Mixed
});

// ============================================================================
// INDEXES
// ============================================================================
InventoryItemSchema.index({ tenantId: 1, category: 1 });
InventoryItemSchema.index({ tenantId: 1, status: 1 });
InventoryItemSchema.index({ tenantId: 1, serialNumber: 1 });
InventoryItemSchema.index({ tenantId: 1, 'currentLocation.type': 1 });
InventoryItemSchema.index({ tenantId: 1, 'currentLocation.siteId': 1 });
InventoryItemSchema.index({ tenantId: 1, manufacturer: 1, model: 1 });
InventoryItemSchema.index({ 'warranty.endDate': 1 }); // For warranty expiration alerts
InventoryItemSchema.index({ 'maintenanceSchedule.nextMaintenanceDate': 1 }); // For maintenance alerts

// Text index for search
InventoryItemSchema.index({
  equipmentType: 'text',
  manufacturer: 'text',
  model: 'text',
  serialNumber: 'text',
  notes: 'text'
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update timestamp on save
InventoryItemSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================================================
// METHODS
// ============================================================================

// Transfer item to new location
InventoryItemSchema.methods.transferTo = function(newLocation, reason, movedBy, notes) {
  const historyEntry = {
    date: new Date(),
    fromLocation: this.currentLocation,
    toLocation: newLocation,
    reason: reason || 'transfer',
    movedBy,
    notes
  };
  
  this.locationHistory.push(historyEntry);
  this.currentLocation = newLocation;
  
  return this.save();
};

// Add maintenance record
InventoryItemSchema.methods.addMaintenance = function(maintenanceData) {
  this.maintenanceRecords.push(maintenanceData);
  this.maintenanceSchedule.lastMaintenanceDate = maintenanceData.date;
  
  if (maintenanceData.nextMaintenanceDate) {
    this.maintenanceSchedule.nextMaintenanceDate = maintenanceData.nextMaintenanceDate;
  }
  
  return this.save();
};

// Deploy equipment
InventoryItemSchema.methods.deploy = function(deploymentInfo) {
  this.status = 'deployed';
  this.deploymentInfo = {
    ...deploymentInfo,
    deployedDate: new Date()
  };
  
  return this.save();
};

// Return equipment to inventory
InventoryItemSchema.methods.returnToInventory = function(returnLocation, reason, notes) {
  this.status = 'available';
  
  return this.transferTo(returnLocation, reason || 'return', notes);
};

// ============================================================================
// STATICS
// ============================================================================

// Get low stock items
InventoryItemSchema.statics.getLowStockItems = function(tenantId, threshold = 5) {
  return this.aggregate([
    { $match: { tenantId, status: 'available' } },
    {
      $group: {
        _id: { manufacturer: '$manufacturer', model: '$model' },
        count: { $sum: 1 },
        items: { $push: '$$ROOT' }
      }
    },
    { $match: { count: { $lte: threshold } } },
    { $sort: { count: 1 } }
  ]);
};

// Get warranty expiring soon
InventoryItemSchema.statics.getExpiringWarranties = function(tenantId, daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    tenantId,
    'warranty.endDate': {
      $gte: new Date(),
      $lte: futureDate
    }
  }).sort({ 'warranty.endDate': 1 });
};

// Get maintenance due
InventoryItemSchema.statics.getMaintenanceDue = function(tenantId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    tenantId,
    status: 'deployed',
    'maintenanceSchedule.nextMaintenanceDate': {
      $lte: futureDate
    }
  }).sort({ 'maintenanceSchedule.nextMaintenanceDate': 1 });
};

// Get equipment at location
InventoryItemSchema.statics.getByLocation = function(tenantId, locationType, locationId) {
  const query = { tenantId, 'currentLocation.type': locationType };
  
  if (locationId) {
    query['currentLocation.siteId'] = locationId;
  }
  
  return this.find(query).sort({ category: 1, equipmentType: 1 });
};

// ============================================================================
// MODEL
// ============================================================================
const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);

module.exports = {
  InventoryItem,
  InventoryItemSchema
};

