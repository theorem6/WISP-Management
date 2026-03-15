/**
 * SNMP Metrics Time-Series Schema
 * Stores SNMP metrics collected from network devices
 * Similar pattern to EPCServiceStatus for consistency
 */

const mongoose = require('mongoose');

/**
 * SNMP Metrics Schema
 * Stores individual metric snapshots with timestamp
 */
const SNMPMetricsSchema = new mongoose.Schema({
  device_id: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // System Metrics
  system: {
    uptime_seconds: Number,
    hostname: String,
    sys_descr: String,
    sys_contact: String,
    sys_location: String
  },
  
  // Resource Metrics
  resources: {
    cpu_percent: Number,
    memory_percent: Number,
    memory_total_mb: Number,
    memory_used_mb: Number,
    memory_free_mb: Number,
    disk_percent: Number,
    disk_total_gb: Number,
    disk_used_gb: Number,
    load_average: [Number]
  },
  
  // Network Interface Metrics (most common interface or primary)
  network: {
    interface_name: String,
    interface_in_octets: Number,  // Cumulative counter
    interface_out_octets: Number, // Cumulative counter
    interface_in_errors: Number,
    interface_out_errors: Number,
    interface_speed: Number,
    interface_status: String // up/down
  },
  
  // Temperature (if available)
  temperature: Number,
  
  // Raw SNMP OID values (for extensibility)
  // NOTE: Only store raw_oids for recent metrics (< 24 hours) to save space
  // Older metrics should have raw_oids removed by optimization script
  raw_oids: mongoose.Schema.Types.Mixed,
  
  // Collection metadata
  collection_method: { type: String, enum: ['poll', 'trap', 'remote_epc_agent'], default: 'poll' },
  poll_duration_ms: Number, // How long the SNMP poll took
  error: String, // Error message if collection failed
  epc_id: String
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

// Indexes for efficient time-range queries
SNMPMetricsSchema.index({ device_id: 1, timestamp: -1 });
SNMPMetricsSchema.index({ tenant_id: 1, timestamp: -1 });
SNMPMetricsSchema.index({ timestamp: 1 }); // For general time queries

// TTL Index - Keep metrics for 7 days (reduced from 90 to save space on free tier)
SNMPMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days

// Compound index for common queries
SNMPMetricsSchema.index({ tenant_id: 1, device_id: 1, timestamp: -1 });

const SNMPMetrics = mongoose.model('SNMPMetrics', SNMPMetricsSchema);

module.exports = {
  SNMPMetrics
};

