#!/usr/bin/env node
/**
 * EPC SNMP Monitoring Agent (remote probe)
 * Collects SNMP metrics from network devices and POSTs to backend for historic graphs.
 * Deployed to remote EPCs; run via: node epc-snmp-monitor.js cycle
 *
 * Same logic as IMPROVED_SNMP_MONITOR.js - this name is used by the check-in agent.
 */

const https = require('https');
const http = require('http');
const snmp = require('net-snmp');
const fs = require('fs').promises;

// Configuration
const CENTRAL_SERVER = process.env.CENTRAL_SERVER || 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = process.env.CONFIG_DIR || '/etc/wisptools';
const LOG_FILE = process.env.LOG_FILE || '/var/log/wisptools-snmp-monitor.log';

// SNMP OIDs for common metrics
const SNMP_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  cpuIdle: '1.3.6.1.4.1.2021.11.11.0',
  memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
  memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
  memBuffer: '1.3.6.1.4.1.2021.4.14.0',
  memCached: '1.3.6.1.4.1.2021.4.15.0',
  diskTotal: '1.3.6.1.4.1.2021.9.1.6.1',
  diskAvail: '1.3.6.1.4.1.2021.9.1.7.1',
  ifNumber: '1.3.6.1.2.1.2.1.0',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
  ifInErrors: '1.3.6.1.2.1.2.2.1.14',
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFile(LOG_FILE, logMessage + '\n').catch(() => {});
}

async function getDeviceCode() {
  try {
    try {
      const envContent = await fs.readFile(`${CONFIG_DIR}/device-code.env`, 'utf8');
      const match = envContent.match(/DEVICE_CODE=(.+)/);
      if (match) return match[1].trim();
    } catch (e) {}
    try {
      return (await fs.readFile(`${CONFIG_DIR}/device_code`, 'utf8')).trim();
    } catch (e) {}
    log('ERROR', 'Device code file not found');
    return null;
  } catch (error) {
    log('ERROR', `Error getting device code: ${error.message}`);
    return null;
  }
}

function querySNMPDevice(ipAddress, community, oids, options = {}) {
  return new Promise((resolve) => {
    const sessionOptions = {
      port: options.port || 161,
      retries: options.retries || 1,
      timeout: options.timeout || 3000,
      idBitsSize: 32,
      ...options.sessionOptions
    };
    const session = snmp.createSession(ipAddress, community, sessionOptions);
    const results = {};
    let completed = 0;
    const total = oids.length;
    let hasError = false;
    const oidArray = oids.map(oid =>
      typeof oid === 'string' ? oid.split('.').map(part => parseInt(part, 10)) : oid
    );
    oidArray.forEach((oid, index) => {
      session.get([oid], (error, varbinds) => {
        completed++;
        if (!error && varbinds && varbinds.length > 0 && !snmp.isVarbindError(varbinds[0])) {
          results[oids[index]] = varbinds[0].value;
        }
        if (completed >= total) {
          session.close();
          resolve({
            success: Object.keys(results).length > 0,
            error: hasError ? 'Some OIDs failed' : null,
            data: results
          });
        }
      });
    });
    setTimeout(() => {
      if (completed < total) {
        hasError = true;
        session.close();
        resolve({ success: Object.keys(results).length > 0, error: 'Timeout', data: results });
      }
    }, sessionOptions.timeout + 1000);
  });
}

async function getSystemMetrics(ipAddress, community, options = {}) {
  const oids = [SNMP_OIDS.sysDescr, SNMP_OIDS.sysName, SNMP_OIDS.sysUpTime, SNMP_OIDS.sysLocation];
  const result = await querySNMPDevice(ipAddress, community, oids, options);
  if (!result.success) return result;
  const data = result.data;
  return {
    success: true,
    error: null,
    system: {
      sys_descr: data[SNMP_OIDS.sysDescr] ? String(data[SNMP_OIDS.sysDescr]) : null,
      sys_name: data[SNMP_OIDS.sysName] ? String(data[SNMP_OIDS.sysName]) : null,
      uptime_seconds: data[SNMP_OIDS.sysUpTime] ? Math.floor(Number(data[SNMP_OIDS.sysUpTime]) / 100) : null,
      sys_location: data[SNMP_OIDS.sysLocation] ? String(data[SNMP_OIDS.sysLocation]) : null
    }
  };
}

async function getResourceMetrics(ipAddress, community, options = {}) {
  const oids = [
    SNMP_OIDS.cpuIdle, SNMP_OIDS.memTotalReal, SNMP_OIDS.memAvailReal,
    SNMP_OIDS.memBuffer, SNMP_OIDS.memCached, SNMP_OIDS.diskTotal, SNMP_OIDS.diskAvail
  ];
  const result = await querySNMPDevice(ipAddress, community, oids, options);
  if (!result.success) return result;
  const data = result.data;
  const memTotal = data[SNMP_OIDS.memTotalReal] ? Number(data[SNMP_OIDS.memTotalReal]) : null;
  const memAvail = data[SNMP_OIDS.memAvailReal] ? Number(data[SNMP_OIDS.memAvailReal]) : null;
  const memUsed = memTotal && memAvail ? memTotal - memAvail : null;
  const memUsedPercent = memTotal && memUsed ? ((memUsed / memTotal) * 100).toFixed(2) : null;
  const diskTotal = data[SNMP_OIDS.diskTotal] ? Number(data[SNMP_OIDS.diskTotal]) : null;
  const diskAvail = data[SNMP_OIDS.diskAvail] ? Number(data[SNMP_OIDS.diskAvail]) : null;
  const diskUsed = diskTotal && diskAvail ? diskTotal - diskAvail : null;
  const diskPercent = diskTotal && diskUsed ? ((diskUsed / diskTotal) * 100).toFixed(2) : null;
  const cpuIdle = data[SNMP_OIDS.cpuIdle] ? Number(data[SNMP_OIDS.cpuIdle]) : null;
  const cpuPercent = cpuIdle !== null ? (100 - cpuIdle).toFixed(2) : null;
  return {
    success: true,
    error: null,
    resources: {
      cpu_percent: cpuPercent ? parseFloat(cpuPercent) : null,
      memory_percent: memUsedPercent ? parseFloat(memUsedPercent) : null,
      memory_total_mb: memTotal ? Math.floor(memTotal / 1024) : null,
      memory_used_mb: memUsed ? Math.floor(memUsed / 1024) : null,
      memory_free_mb: memAvail ? Math.floor(memAvail / 1024) : null,
      disk_percent: diskPercent ? parseFloat(diskPercent) : null,
      disk_total_gb: diskTotal ? (diskTotal / (1024 * 1024)).toFixed(2) : null,
      disk_used_gb: diskUsed ? (diskUsed / (1024 * 1024)).toFixed(2) : null
    }
  };
}

async function getInterfaceMetrics(ipAddress, community, interfaceIndex, options = {}) {
  const ifNumberResult = await querySNMPDevice(ipAddress, community, [SNMP_OIDS.ifNumber], options);
  if (!ifNumberResult.success) return ifNumberResult;
  const idx = interfaceIndex === null ? 1 : interfaceIndex;
  const baseOids = [
    `${SNMP_OIDS.ifDescr}.${idx}`, `${SNMP_OIDS.ifSpeed}.${idx}`, `${SNMP_OIDS.ifOperStatus}.${idx}`,
    `${SNMP_OIDS.ifInOctets}.${idx}`, `${SNMP_OIDS.ifOutOctets}.${idx}`,
    `${SNMP_OIDS.ifInErrors}.${idx}`, `${SNMP_OIDS.ifOutErrors}.${idx}`
  ];
  const result = await querySNMPDevice(ipAddress, community, baseOids, options);
  if (!result.success) return result;
  const data = result.data;
  const operStatus = data[`${SNMP_OIDS.ifOperStatus}.${idx}`];
  return {
    success: true,
    error: null,
    network: {
      interface_name: data[`${SNMP_OIDS.ifDescr}.${idx}`] ? String(data[`${SNMP_OIDS.ifDescr}.${idx}`]) : null,
      interface_speed: data[`${SNMP_OIDS.ifSpeed}.${idx}`] ? Number(data[`${SNMP_OIDS.ifSpeed}.${idx}`]) : null,
      interface_status: operStatus !== undefined ? (Number(operStatus) === 1 ? 'up' : 'down') : 'unknown',
      interface_in_octets: data[`${SNMP_OIDS.ifInOctets}.${idx}`] ? Number(data[`${SNMP_OIDS.ifInOctets}.${idx}`]) : null,
      interface_out_octets: data[`${SNMP_OIDS.ifOutOctets}.${idx}`] ? Number(data[`${SNMP_OIDS.ifOutOctets}.${idx}`]) : null,
      interface_in_errors: data[`${SNMP_OIDS.ifInErrors}.${idx}`] ? Number(data[`${SNMP_OIDS.ifInErrors}.${idx}`]) : null,
      interface_out_errors: data[`${SNMP_OIDS.ifOutErrors}.${idx}`] ? Number(data[`${SNMP_OIDS.ifOutErrors}.${idx}`]) : null
    }
  };
}

async function getAllMetrics(ipAddress, community, options = {}) {
  const [systemResult, resourceResult, networkResult] = await Promise.all([
    getSystemMetrics(ipAddress, community, options),
    getResourceMetrics(ipAddress, community, options),
    getInterfaceMetrics(ipAddress, community, null, options)
  ]);
  return {
    success: systemResult.success || resourceResult.success || networkResult.success,
    error: systemResult.error || resourceResult.error || networkResult.error,
    system: systemResult.system || {},
    resources: resourceResult.resources || {},
    network: networkResult.network || {}
  };
}

function getMonitoringDevices(deviceCode) {
  return new Promise((resolve) => {
    const url = new URL(`${API_URL}/checkin/monitoring-devices`);
    url.searchParams.set('device_code', deviceCode);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: 'GET', timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data).devices || []);
          } catch (e) {
            resolve([]);
          }
        } else resolve([]);
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
}

function sendSNMPMetrics(deviceCode, snmpMetrics) {
  if (!snmpMetrics || snmpMetrics.length === 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    const url = new URL(`${API_URL}/checkin/snmp-metrics`);
    const payload = JSON.stringify({ device_code: deviceCode, snmp_metrics: snmpMetrics });
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(res.statusCode === 200 || res.statusCode === 201);
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

async function snmpCycle(deviceCode, devices) {
  if (!devices || devices.length === 0) {
    log('INFO', 'No devices to monitor');
    return 0;
  }
  log('INFO', `Starting SNMP cycle for ${devices.length} device(s)`);
  const snmpMetrics = [];
  for (const device of devices) {
    const { device_id, ip_address, snmp_community } = device;
    if (!device_id || !ip_address) continue;
    const community = snmp_community || 'public';
    const trimmedIP = ip_address.trim();
    if (trimmedIP === '0.0.0.0' || trimmedIP === '127.0.0.1' || trimmedIP === 'localhost') continue;
    try {
      const metrics = await getAllMetrics(trimmedIP, community, { timeout: 3000, retries: 1 });
      if (metrics.success) {
        snmpMetrics.push({
          device_id: device_id.toString(),
          system: metrics.system,
          resources: metrics.resources,
          network: metrics.network,
          raw_oids: {}
        });
        log('INFO', `  ✓ ${trimmedIP}: CPU=${metrics.resources?.cpu_percent ?? 'N/A'}%, Memory=${metrics.resources?.memory_percent ?? 'N/A'}%`);
      } else {
        log('WARN', `  ✗ ${trimmedIP}: ${metrics.error || 'SNMP query failed'}`);
      }
    } catch (error) {
      log('ERROR', `  ✗ ${trimmedIP}: ${error.message}`);
    }
  }
  log('INFO', `SNMP cycle completed: ${snmpMetrics.length} metrics collected`);
  if (snmpMetrics.length > 0) {
    const sent = await sendSNMPMetrics(deviceCode, snmpMetrics);
    if (!sent) log('ERROR', 'Failed to send SNMP metrics to backend');
  }
  return snmpMetrics.length;
}

async function main() {
  const command = process.argv[2];
  const deviceCode = await getDeviceCode();
  if (!deviceCode) {
    log('ERROR', 'Cannot proceed without device code');
    process.exit(1);
  }
  if (command === 'cycle') {
    const devices = await getMonitoringDevices(deviceCode);
    log('INFO', `Retrieved ${devices.length} device(s) to monitor`);
    const count = await snmpCycle(deviceCode, devices);
    log('INFO', `SNMP cycle completed: ${count} metrics sent`);
  } else {
    log('ERROR', 'Usage: node epc-snmp-monitor.js cycle');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    log('ERROR', `Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { snmpCycle, getMonitoringDevices, sendSNMPMetrics };
