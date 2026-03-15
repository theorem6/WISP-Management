/**
 * Ping Metrics Time-Series Schema
 * Stores ping response data for uptime monitoring and graphing
 */

const mongoose = require('mongoose');

/**
 * Ping Metrics Schema
 * Stores individual ping snapshot with timestamp
 */
const PingMetricsSchema = new mongoose.Schema({
  device_id: { type: String, required: true, index: true }, // Inventory item _id or NetworkEquipment _id
  tenant_id: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Ping Results
  ip_address: { type: String, required: true },
  success: { type: Boolean, required: true },
  response_time_ms: Number, // Response time in milliseconds (null if failed)
  packet_loss: { type: Number, default: 0 }, // Percentage (0-100)
  
  // Uptime tracking
  consecutive_failures: { type: Number, default: 0 }, // Count of consecutive ping failures
  last_success: Date, // Last successful ping timestamp
  last_failure: Date, // Last failed ping timestamp
  
  // Collection metadata
  error: String, // Error message if ping failed
  ping_method: { type: String, enum: ['icmp', 'tcp', 'http'], default: 'icmp' },
  source: String,
  epc_id: String
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

// Indexes for efficient time-range queries
PingMetricsSchema.index({ device_id: 1, timestamp: -1 });
PingMetricsSchema.index({ tenant_id: 1, timestamp: -1 });
PingMetricsSchema.index({ ip_address: 1, timestamp: -1 });
PingMetricsSchema.index({ timestamp: 1 }); // For general time queries
PingMetricsSchema.index({ success: 1, timestamp: -1 }); // For failure analysis

// TTL Index - Keep metrics for 7 days (reduced from 90 to save space on free tier)
PingMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days

// Compound index for common queries
PingMetricsSchema.index({ tenant_id: 1, device_id: 1, timestamp: -1 });
PingMetricsSchema.index({ tenant_id: 1, ip_address: 1, timestamp: -1 });
PingMetricsSchema.index({ epc_id: 1, timestamp: -1 });

const PingMetrics = mongoose.model('PingMetrics', PingMetricsSchema);

module.exports = {
  PingMetrics
};

