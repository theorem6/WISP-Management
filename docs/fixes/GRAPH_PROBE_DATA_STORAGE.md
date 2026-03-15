# Graph Data: Remote Probe Storage for Historic Use

## Problem

Graphs (Monitoring > Graphs) were empty because data gathered by remote probes was not being stored in the database for historic use. The backend had endpoints to **receive** ping and SNMP metrics, but:

1. **Ping**: Remote agents run `epc-ping-monitor.js` and POST to `/api/epc/checkin/ping-metrics`; data was stored in `PingMetrics` but schema did not persist `source`/`epc_id`.
2. **SNMP**: Backend accepted POST to `/api/epc/checkin/snmp-metrics` and stored in `SNMPMetrics`, but **remote agents were not running any SNMP metrics collection** — only the ping monitor ran. So SNMP time-series for network devices was never populated by probes.

## Fixes Applied

### 1. Schemas (persist probe metadata)

- **PingMetrics** (`models/ping-metrics-schema.js`, `backend-services/models/ping-metrics-schema.js`):
  - Added optional `source` (e.g. `'remote_epc_agent'`) and `epc_id`.
  - Added index `{ epc_id: 1, timestamp: -1 }` for querying by probe.

- **SNMPMetrics** (`models/snmp-metrics-schema.js`, `backend-services/models/snmp-metrics-schema.js`):
  - Added `'remote_epc_agent'` to `collection_method` enum.
  - Added optional `epc_id` for probe-sourced metrics.

### 2. Monitoring devices API (SNMP credentials for probes)

- **GET /api/epc/checkin/monitoring-devices** (in `routes/epc-checkin.js` and `backend-services/routes/epc-checkin.js`):
  - Each device now includes `snmp_community` and `snmp_version` from `notes` (defaults: `'public'`, `'2c'`).
  - Allows the SNMP monitor script on probes to poll devices and send metrics to the backend.

### 3. SNMP monitor on remote agents

- **New script**: `backend-services/scripts/epc-snmp-monitor.js`
  - Fetches device list from `/api/epc/checkin/monitoring-devices` (with SNMP credentials).
  - Polls each device via SNMP (system, resources, interfaces).
  - POSTs results to `/api/epc/checkin/snmp-metrics` so they are stored in `SNMPMetrics` for graphs.

- **Check-in agent** (`backend-services/scripts/epc-checkin-agent.sh`):
  - Ensures `epc-snmp-monitor.js` is present (copy from repo or download from server).
  - Runs **SNMP metrics cycle every 10 minutes** (separate from the 5‑minute ping cycle): `node /opt/wisptools/epc-snmp-monitor.js cycle`.
  - Install path and download URL include `epc-snmp-monitor.js`; auto-update list in `backend-services/utils/epc-auto-update.js` includes it.

### 4. Data flow (unchanged, now fully used)

- **Ping**: Probe runs `epc-ping-monitor.js cycle` → GET monitoring-devices → ping devices → POST `/checkin/ping-metrics` → stored in **PingMetrics** (with `source`/`epc_id`).
- **SNMP**: Probe runs `epc-snmp-monitor.js cycle` → GET monitoring-devices (with `snmp_community`/`snmp_version`) → SNMP poll devices → POST `/checkin/snmp-metrics` → stored in **SNMPMetrics** (with `epc_id` when sent by backend).
- **Graphs**: Monitoring UI reads from **PingMetrics** (ping/uptime) and **SNMPMetrics** (CPU, memory, throughput, etc.); EPC system metrics continue to come from **EPCServiceStatus** (check-in payload).

## Verification

1. **Backend**: Deploy backend so `/checkin/monitoring-devices` returns `snmp_community`/`snmp_version` and both check-in routes persist data with the updated schemas.
2. **Probes**: Update agents (reinstall or pull updated `epc-checkin-agent.sh` and ensure `epc-snmp-monitor.js` is deployed to `/opt/wisptools/` and served at `.../downloads/scripts/epc-snmp-monitor.js`).
3. **Graphs**: After 10+ minutes, check Monitoring > Graphs for a device that has an IP and (for SNMP) SNMP configured in notes; ping and SNMP history should populate.

## Files touched

- `backend-services/models/ping-metrics-schema.js`, `models/ping-metrics-schema.js`
- `backend-services/models/snmp-metrics-schema.js`, `models/snmp-metrics-schema.js`
- `backend-services/routes/epc-checkin.js`, `routes/epc-checkin.js` (monitoring-devices response)
- `backend-services/scripts/epc-snmp-monitor.js` (new)
- `backend-services/scripts/epc-checkin-agent.sh` (SNMP cycle + install)
- `backend-services/utils/epc-auto-update.js` (script list)
