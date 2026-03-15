/**
 * EPC Check-in Routes
 * Handles check-in requests from remote EPC devices
 * MUST be defined BEFORE /api/epc routes (no tenant ID required)
 */

const express = require('express');
const router = express.Router();
const checkinService = require('../services/epc-checkin-service');
const { PingMetrics } = require('../models/ping-metrics-schema');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');
const { RemoteEPC, EPCCommand } = require('../models/distributed-epc-schema');
const { NetworkEquipment } = require('../models/network');
const { InventoryItem } = require('../models/inventory');
const { checkForUpdates, generateUpdateCommand } = require('../utils/epc-auto-update');

/**
 * POST /api/epc/checkin
 * Main check-in endpoint for remote EPC devices
 */
router.post('/checkin', async (req, res) => {
  try {
    const { device_code, hardware_id, ip_address, services, system, network, versions, logs } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    console.log(`[EPC Check-in] Device ${device_code} checking in from ${ip_address}`);
    console.log(`[EPC Check-in] Payload received:`, {
      hasServices: !!services,
      hasSystem: !!system,
      hasNetwork: !!network,
      hasVersions: !!versions,
      hasLogs: !!(logs && Array.isArray(logs) && logs.length > 0),
      systemKeys: system ? Object.keys(system) : [],
      systemUptime: system?.uptime_seconds,
      systemCPU: system?.cpu_percent,
      systemMemory: system?.memory_percent
    });

    if (versions?.scripts) {
      console.log(`[EPC Check-in] Script versions reported:`, JSON.stringify(versions.scripts));
    } else {
      console.log(`[EPC Check-in] No script versions reported (old agent version?)`);
    }

    // Find EPC by device code
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(202).json({
        status: 'unregistered',
        message: `Device ${device_code} is not registered. Enter this code in the management portal.`,
        device_code: device_code.toUpperCase()
      });
    }

    // Update EPC with latest status and uptime
    const updateData = {
      status: 'online',
      last_seen: new Date(),
      last_heartbeat: new Date(),
      ip_address,
      hardware_id: hardware_id || epc.hardware_id,
      'version.os': versions?.os,
      'version.open5gs': versions?.open5gs
    };

    // Update system uptime if provided
    if (system?.uptime_seconds !== undefined && system?.uptime_seconds !== null) {
      updateData['metrics.system_uptime_seconds'] = system.uptime_seconds;
    }

    await checkinService.updateEPCStatus(epc, updateData);

    // Store logs if provided
    await checkinService.storeLogs(epc, logs, ip_address, device_code);

    // Save service status and check health
    await checkinService.saveServiceStatus(epc, services, system, network, versions);
    await checkinService.checkServiceHealth(epc, services);

    // Check for agent script updates automatically
    try {
      const scriptVersions = versions?.scripts || {};
      console.log(`[EPC Check-in] Checking for script updates for ${epc.epc_id}...`);
      console.log(`[EPC Check-in] Script versions received:`, JSON.stringify(scriptVersions, null, 2));
      console.log(`[EPC Check-in] Has epc-ping-monitor.js hash:`, !!scriptVersions['epc-ping-monitor.js']?.hash);
      if (scriptVersions['epc-ping-monitor.js']) {
        console.log(`[EPC Check-in] epc-ping-monitor.js hash from agent:`, scriptVersions['epc-ping-monitor.js'].hash);
      }
      
      // CRITICAL: Check for VERY recent completed commands (last 2 minutes) to prevent immediate duplicates
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const veryRecentCompleted = await EPCCommand.findOne({
        epc_id: epc.epc_id,
        action: 'update_scripts',
        status: { $in: ['completed', 'failed'] },
        completed_at: { $gte: twoMinutesAgo }
      }).sort({ completed_at: -1 });
      
      if (veryRecentCompleted) {
        console.log(`[EPC Check-in] ⚠️ Very recent update command completed (${Math.round((Date.now() - new Date(veryRecentCompleted.completed_at).getTime()) / 1000)}s ago, ID: ${veryRecentCompleted._id}), skipping update check to prevent immediate duplicate`);
        // Skip update check entirely if a command just completed
      } else {
        const updateInfo = await checkForUpdates(epc.epc_id, scriptVersions);
        
        if (updateInfo.has_updates) {
        console.log(`[EPC Check-in] Updates available: ${Object.keys(updateInfo.scripts).join(', ')} (version: ${updateInfo.version})`);
        
        // Version-based duplicate prevention: Only create command if this version is newer
        // Check for existing update command with same version (active OR recently completed)
        // IMPORTANT: Check ALL update_scripts commands first, then filter by version
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        // First, get ALL active update commands (regardless of version)
        const activeUpdate = await EPCCommand.findOne({
          epc_id: epc.epc_id,
          action: 'update_scripts',
          status: { $in: ['pending', 'sent'] }
        }).sort({ created_at: -1 });
        
        // Then check for recently completed with same version
        const recentCompleted = await EPCCommand.findOne({
          epc_id: epc.epc_id,
          action: 'update_scripts',
          status: { $in: ['completed', 'failed'] },
          version: updateInfo.version, // Must match version
          completed_at: { $gte: tenMinutesAgo }
        }).sort({ created_at: -1 });
        
        const existingUpdate = activeUpdate || recentCompleted;
        
        let shouldCreateNew = false;
        
        if (!existingUpdate) {
          // No existing command - safe to create
          shouldCreateNew = true;
          console.log(`[EPC Check-in] No existing update command, creating new one (version: ${updateInfo.version})`);
        } else if (activeUpdate) {
          // Active command exists - check version
          console.log(`[EPC Check-in] Found active update command: ID=${activeUpdate._id}, status=${activeUpdate.status}, version=${activeUpdate.version || 'none'}, new version=${updateInfo.version}`);
          
          if (activeUpdate.version && activeUpdate.version === updateInfo.version) {
            shouldCreateNew = false;
            console.log(`[EPC Check-in] ✅ Active update command exists with same version (${updateInfo.version}, status: ${activeUpdate.status}, ID: ${activeUpdate._id}), skipping duplicate`);
          } else if (!activeUpdate.version) {
            // Old format command - check age
            const commandAge = Date.now() - new Date(activeUpdate.created_at).getTime();
            const tenMinutesMs = 10 * 60 * 1000;
            if (commandAge < tenMinutesMs) {
              shouldCreateNew = false;
              console.log(`[EPC Check-in] ✅ Old-format active update command exists (age: ${Math.round(commandAge / 1000)}s, ID: ${activeUpdate._id}), skipping duplicate`);
            } else {
              shouldCreateNew = true;
              console.log(`[EPC Check-in] Old-format active command is old (${Math.round(commandAge / 1000)}s), creating new versioned command`);
            }
          } else {
            // Version mismatch - different scripts need updating
            shouldCreateNew = true;
            console.log(`[EPC Check-in] ⚠️ Active command version mismatch: existing=${activeUpdate.version}, new=${updateInfo.version}, creating new command`);
          }
        } else if (recentCompleted) {
          // Recently completed with same version - don't create
          shouldCreateNew = false;
          console.log(`[EPC Check-in] Recently completed update command exists with same version (${updateInfo.version}, completed: ${recentCompleted.completed_at}), skipping duplicate`);
        } else {
          // Should not reach here, but safety check
          shouldCreateNew = true;
          console.log(`[EPC Check-in] No matching command found, creating new one (version: ${updateInfo.version})`);
        }
        
        if (shouldCreateNew) {
          // Generate and queue update command (with optional apt packages)
          // TODO: Add apt_packages from config if needed
          const updateCommand = generateUpdateCommand(updateInfo, {
            apt_packages: [] // Can be populated from EPC config in future
          });
          
          if (updateCommand) {
            const cmd = new EPCCommand({
              ...updateCommand,
              epc_id: epc.epc_id,
              tenant_id: epc.tenant_id,
              status: 'pending',
              created_at: new Date(),
              version: updateInfo.version, // CRITICAL: Ensure version is saved for duplicate prevention
              description: `Automatic script update: ${Object.keys(updateInfo.scripts).join(', ')} (v${updateInfo.version})`
            });
            
            await cmd.save();
            console.log(`[EPC Check-in] ✅ Auto-update command queued for ${epc.epc_id}: ${Object.keys(updateInfo.scripts).join(', ')} (version: ${updateInfo.version}, ID: ${cmd._id})`);
          }
        }
        } else {
          console.log(`[EPC Check-in] All scripts are up to date for ${epc.epc_id}`);
        }
      }
    } catch (updateError) {
      console.error(`[EPC Check-in] Error checking for updates:`, updateError.message);
      // Continue with check-in even if update check fails
    }

    // Fetch pending commands
    const commands = await checkinService.getPendingCommands(epc.epc_id);

    // Filter out any commands that are already sent/completed (safety check)
    const trulyPending = commands.filter(c => c.status === 'pending');
    
    if (trulyPending.length !== commands.length) {
      console.warn(`[EPC Check-in] Filtered out ${commands.length - trulyPending.length} non-pending commands for ${epc.epc_id}`);
    }

    console.log(`[EPC Check-in] Found ${trulyPending.length} pending command(s) for ${epc.epc_id}:`,
      trulyPending.map(c => `${c.command_type}/${c.action || 'N/A'} (ID: ${c._id}, ${c.notes || 'no notes'})`).join(', '));

    // Mark commands as sent BEFORE returning them (prevents race condition)
    if (trulyPending.length > 0) {
      await checkinService.markCommandsAsSent(trulyPending.map(c => c._id));
      console.log(`[EPC Check-in] Marked ${trulyPending.length} command(s) as sent for ${epc.epc_id}`);
    }

    // Build and return response (use filtered commands)
    const config = checkinService.buildCheckinConfig(epc);
    const response = checkinService.buildCheckinResponse(epc, trulyPending, config);

    res.json(response);
  } catch (error) {
    console.error('[EPC Check-in] Error:', error);
    res.status(500).json({ error: 'Check-in failed', message: error.message });
  }
});

/**
 * POST /api/epc/checkin/commands/:command_id/result
 * Record command execution result
 */
router.post('/checkin/commands/:command_id/result', async (req, res) => {
  try {
    const { command_id } = req.params;
    const { success, output, error, exit_code } = req.body;
    const device_code = req.headers['x-device-code'];

    const { EPCCommand, RemoteEPC } = require('../models/distributed-epc-schema');

    // First, find the command to verify it exists and get epc_id
    const command = await EPCCommand.findById(command_id);
    
    if (!command) {
      console.error(`[EPC Command Result] Command ${command_id} not found`);
      return res.status(404).json({ error: 'Command not found' });
    }

    // Verify device_code matches if provided
    if (device_code) {
      const epc = await RemoteEPC.findOne({ device_code: device_code.toUpperCase() });
      if (!epc || epc.epc_id !== command.epc_id) {
        console.error(`[EPC Command Result] Device code mismatch for command ${command_id}`);
        return res.status(403).json({ error: 'Device code does not match command EPC' });
      }
    }

    // Check if command is already completed
    if (command.status === 'completed' || command.status === 'failed') {
      console.log(`[EPC Command Result] Command ${command_id} already ${command.status}, updating result anyway`);
    }

    // Update command status
    const updated = await EPCCommand.findByIdAndUpdate(
      command_id,
      {
        status: success ? 'completed' : 'failed',
        completed_at: new Date(),
        result: { success, output, error, exit_code }
      },
      { new: true }
    );

    if (!updated) {
      console.error(`[EPC Command Result] Failed to update command ${command_id}`);
      return res.status(500).json({ error: 'Failed to update command status' });
    }

    console.log(`[EPC Command] Command ${command_id} (EPC: ${command.epc_id}) completed: ${success ? 'SUCCESS' : 'FAILED'}, status changed from ${command.status} to ${updated.status}`);
    res.json({ success: true, message: 'Command result recorded', command_id, previous_status: command.status, new_status: updated.status });
  } catch (error) {
    console.error('[EPC Command Result] Error:', error);
    res.status(500).json({ error: 'Failed to record result', message: error.message });
  }
});

/**
 * POST /api/epc/checkin/ping-metrics
 * Receive ping metrics from remote EPC agents
 * Remote agents ping devices on their local network and send results here
 */
router.post('/checkin/ping-metrics', async (req, res) => {
  try {
    const { device_code, ping_metrics } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    if (!Array.isArray(ping_metrics)) {
      return res.status(400).json({ error: 'ping_metrics must be an array' });
    }

    // Find EPC by device code to get tenant_id
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found for device_code' });
    }

    const tenantId = epc.tenant_id;
    let storedCount = 0;

    // Store each ping metric
    for (const metric of ping_metrics) {
      try {
        const { device_id, ip_address, success, response_time_ms, error } = metric;

        if (!device_id || !ip_address) {
          console.warn(`[Ping Metrics] Skipping invalid metric: missing device_id or ip_address`);
          continue;
        }

        // Store the actual values received (don't convert 0 to null, but handle undefined)
        const storedSuccess = success !== undefined ? success : true; // Default to true only if undefined
        const storedResponseTime = response_time_ms !== undefined ? response_time_ms : null;
        
        const pingMetric = new PingMetrics({
          device_id,
          tenant_id: tenantId,
          timestamp: new Date(),
          ip_address,
          success: storedSuccess,
          response_time_ms: storedResponseTime,
          packet_loss: storedSuccess === false ? 100 : 0,
          error: error || null,
          ping_method: 'icmp',
          source: 'remote_epc_agent',
          epc_id: epc.epc_id
        });

        await pingMetric.save();
        
        // Debug log first few metrics to verify storage
        if (storedCount < 3) {
          console.log(`[Ping Metrics] Stored metric ${storedCount + 1}: device_id=${device_id}, success=${storedSuccess} (type: ${typeof storedSuccess}), response_time_ms=${storedResponseTime} (type: ${typeof storedResponseTime})`);
        }
        storedCount++;
      } catch (metricError) {
        console.error(`[Ping Metrics] Error storing metric:`, metricError);
        // Continue with next metric
      }
    }

    console.log(`[Ping Metrics] Received ${ping_metrics.length} metrics from ${device_code}, stored ${storedCount}`);

    res.json({
      success: true,
      received: ping_metrics.length,
      stored: storedCount
    });
  } catch (error) {
    console.error('[Ping Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to process ping metrics', message: error.message });
  }
});

/**
 * POST /api/epc/checkin/snmp-metrics
 * Receive SNMP metrics from remote EPC agents
 * Remote agents collect SNMP metrics from devices on their local network and send results here
 */
router.post('/checkin/snmp-metrics', async (req, res) => {
  try {
    const { device_code, snmp_metrics } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    if (!Array.isArray(snmp_metrics)) {
      return res.status(400).json({ error: 'snmp_metrics must be an array' });
    }

    // Find EPC by device code to get tenant_id
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found for device_code' });
    }

    const tenantId = epc.tenant_id;
    let storedCount = 0;

    // Store each SNMP metric
    for (const metric of snmp_metrics) {
      try {
        const { device_id, system, resources, network, temperature, raw_oids } = metric;

        if (!device_id) {
          console.warn(`[SNMP Metrics] Skipping invalid metric: missing device_id`);
          continue;
        }

        const snmpMetric = new SNMPMetrics({
          device_id: device_id.toString(),
          tenant_id: tenantId,
          timestamp: new Date(),
          system: system || {},
          resources: resources || {},
          network: network || {},
          temperature: temperature || null,
          raw_oids: raw_oids || {},
          collection_method: 'remote_epc_agent',
          epc_id: epc.epc_id
        });

        await snmpMetric.save();
        storedCount++;
      } catch (metricError) {
        console.error(`[SNMP Metrics] Error storing metric:`, metricError);
        // Continue with next metric
      }
    }

    console.log(`[SNMP Metrics] Received ${snmp_metrics.length} metrics from ${device_code}, stored ${storedCount}`);

    res.json({
      success: true,
      received: snmp_metrics.length,
      stored: storedCount
    });
  } catch (error) {
    console.error('[SNMP Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to process SNMP metrics', message: error.message });
  }
});

/**
 * GET /api/epc/checkin/monitoring-devices
 * Get list of devices this EPC should ping/monitor
 * Returns devices on the EPC's network (discovered via SNMP or configured)
 */
router.get('/checkin/monitoring-devices', async (req, res) => {
  try {
    const device_code = req.query.device_code || req.headers['x-device-code'];

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    // Find EPC by device code
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found for device_code' });
    }

    const tenantId = epc.tenant_id;
    const epcId = epc.epc_id;
    const devices = [];

    // Get network equipment discovered by this EPC or associated with it
    const networkEquipment = await NetworkEquipment.find({
      tenantId,
      status: 'active',
      $or: [
        { 'notes.discovered_by_epc': epcId },
        { 'notes.epc_id': epcId }
      ]
    })
    .select('_id name type notes status')
    .lean();

    for (const equipment of networkEquipment) {
      try {
        const notes = equipment.notes ? (typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes) : {};
        const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
        
        if (ipAddress && ipAddress.trim()) {
          devices.push({
            device_id: equipment._id.toString(),
            name: equipment.name || 'Unknown Device',
            type: equipment.type || 'other',
            ip_address: ipAddress.trim(),
            source: 'network_equipment',
            snmp_community: notes.snmp_community || notes.snmp_community_string || 'public',
            snmp_version: notes.snmp_version || '2c'
          });
        }
      } catch (e) {
        continue;
      }
    }

    // Also get ALL network equipment with IPs for this tenant (not just discovered by this EPC)
    // This ensures manually added devices or devices discovered by other means are also monitored
    // Include all statuses: active, deployed, planned - any device with an IP should be monitored
    const allNetworkEquipment = await NetworkEquipment.find({
      tenantId,
      $or: [
        { status: 'active' },
        { status: 'deployed' },
        { status: 'planned' },
        { status: { $exists: false } } // Also include devices without status field
      ]
    })
    .select('_id name type notes status')
    .lean();

    // Track devices we've already added to avoid duplicates
    const addedDeviceIds = new Set(devices.map(d => d.device_id));

    for (const equipment of allNetworkEquipment) {
      // Skip if already added
      if (addedDeviceIds.has(equipment._id.toString())) {
        continue;
      }

      try {
        const notes = equipment.notes ? (typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes) : {};
        const ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
        
        // Only add devices with valid IP addresses
        if (ipAddress && ipAddress.trim()) {
          devices.push({
            device_id: equipment._id.toString(),
            name: equipment.name || 'Unknown Device',
            type: equipment.type || 'other',
            ip_address: ipAddress.trim(),
            source: 'network_equipment',
            snmp_community: notes.snmp_community || notes.snmp_community_string || 'public',
            snmp_version: notes.snmp_version || '2c'
          });
          addedDeviceIds.add(equipment._id.toString());
        }
      } catch (e) {
        continue;
      }
    }

    // Get inventory items with IP addresses that are deployed
    const inventoryItems = await InventoryItem.find({
      tenantId,
      status: 'deployed',
      $or: [
        { ipAddress: { $exists: true, $ne: null, $ne: '' } },
        { 'technicalSpecs.ipAddress': { $exists: true, $ne: null, $ne: '' } }
      ]
    })
    .select('_id name type ipAddress technicalSpecs.ipAddress status')
    .lean();

    for (const item of inventoryItems) {
      const ipAddress = item.ipAddress || item.technicalSpecs?.ipAddress;
      if (ipAddress && ipAddress.trim()) {
        devices.push({
          device_id: item._id.toString(),
          name: item.name || 'Unknown Device',
          type: item.type || 'other',
          ip_address: ipAddress.trim(),
          source: 'inventory_item'
        });
      }
    }

    console.log(`[Monitoring Devices] Returning ${devices.length} devices for EPC ${epcId} to monitor`);

    res.json({
      success: true,
      epc_id: epcId,
      devices,
      count: devices.length
    });
  } catch (error) {
    console.error('[Monitoring Devices] Error:', error);
    res.status(500).json({ error: 'Failed to get monitoring devices', message: error.message });
  }
});

/**
 * GET /api/epc/checkin/snmp-subnets
 * Get list of SNMP subnets this EPC should ping sweep (hourly)
 * Returns subnets configured in the EPC's SNMP settings
 */
router.get('/checkin/snmp-subnets', async (req, res) => {
  try {
    const device_code = req.query.device_code || req.headers['x-device-code'];

    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }

    // Find EPC by device code
    const epc = await checkinService.findEPCByDeviceCode(device_code);

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found for device_code' });
    }

    const subnets = [];
    
    // Get subnets from EPC's SNMP configuration
    if (epc.snmp_config && epc.snmp_config.targets && Array.isArray(epc.snmp_config.targets)) {
      for (const target of epc.snmp_config.targets) {
        if (target && typeof target === 'string' && target.trim()) {
          // Check if it's a subnet (contains /) or just an IP
          const trimmed = target.trim();
          if (trimmed.includes('/')) {
            // It's a subnet
            subnets.push(trimmed);
          } else if (/^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
            // It's a single IP, convert to /32 subnet
            subnets.push(`${trimmed}/32`);
          }
        }
      }
    }
    
    // Also check if EPC has network_config with subnet info
    if (epc.network_config) {
      // Add management network if available
      if (epc.network_config.managementNetwork) {
        subnets.push(epc.network_config.managementNetwork);
      }
    }

    console.log(`[SNMP Subnets] Returning ${subnets.length} subnet(s) for EPC ${epc.epc_id} to ping sweep`);

    res.json({
      success: true,
      epc_id: epc.epc_id,
      subnets: [...new Set(subnets)], // Remove duplicates
      count: subnets.length
    });
  } catch (error) {
    console.error('[SNMP Subnets] Error:', error);
    res.status(500).json({ error: 'Failed to get SNMP subnets', message: error.message });
  }
});

module.exports = router;

