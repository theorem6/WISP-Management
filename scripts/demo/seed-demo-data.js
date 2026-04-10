/**
 * Seed MongoDB with interactive demo data for WISPTools test / demo sites.
 *
 * Usage (from repo root, with MONGODB_URI in .env):
 *   node scripts/demo/seed-demo-data.js
 *   node scripts/demo/seed-demo-data.js --reset
 *
 * Env:
 *   MONGODB_URI           — required
 *   DEMO_TENANT_SUBDOMAIN — default wisptools-demo
 *   DEMO_FIREBASE_USER_UID — optional; if set, creates UserTenant (owner) for this Firebase uid
 */

'use strict';

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');

const { Tenant } = require('../../models/tenant');
const { UserTenant } = require('../../models/user');
const { Customer } = require('../../models/customer');
const { WorkOrder } = require('../../models/work-order');
const { Incident: IncidentModel } = require('../../models/incident');
const { InventoryItem } = require('../../models/inventory');

const SUBDOMAIN = process.env.DEMO_TENANT_SUBDOMAIN || 'wisptools-demo';
const DEMO_UID = process.env.DEMO_FIREBASE_USER_UID || '';

const DEMO_TAG = 'demo-seed-v1';

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required (set in .env or environment).');
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30_000
  });
  console.log('[demo-seed] Connected to MongoDB');
}

async function resetDemoTenant(tenantId) {
  await Customer.deleteMany({ tenantId, customerId: /^CUST-DEMO-/ });
  await WorkOrder.deleteMany({ tenantId, ticketNumber: /^TKT-DEMO-/ });
  await IncidentModel.deleteMany({ tenantId, incidentNumber: /^INC-DEMO-/ });
  await InventoryItem.deleteMany({ tenantId, serialNumber: /^DEMO-SN-/ });
  await UserTenant.deleteMany({ tenantId });
  await Tenant.deleteOne({ _id: tenantId });
  console.log('[demo-seed] Removed previous demo tenant and related documents');
}

async function ensureTenant() {
  let tenant = await Tenant.findOne({ subdomain: SUBDOMAIN });
  if (tenant) {
    console.log('[demo-seed] Using existing tenant:', tenant._id.toString(), tenant.displayName);
    return tenant;
  }

  tenant = await Tenant.create({
    name: 'Demo WISP',
    displayName: 'WISPTools Demo ISP',
    subdomain: SUBDOMAIN,
    contactEmail: 'demo@wisptools.io',
    cwmpUrl: `https://${SUBDOMAIN}.wisptools.io/cwmp`,
    createdBy: 'demo-seed-script',
    status: 'active',
    settings: {
      allowSelfRegistration: false,
      requireEmailVerification: false,
      maxUsers: 100,
      maxDevices: 5000,
      features: {
        acs: true,
        hss: true,
        pci: true,
        helpDesk: true,
        userManagement: true,
        customerManagement: true
      }
    }
  });
  console.log('[demo-seed] Created tenant:', tenant._id.toString());
  return tenant;
}

async function ensureUserTenantLink(tenantId) {
  if (!DEMO_UID) {
    console.log('[demo-seed] DEMO_FIREBASE_USER_UID not set — skip UserTenant link.');
    console.log('[demo-seed] After creating a test user, run again with DEMO_FIREBASE_USER_UID=<uid>');
    return;
  }
  await UserTenant.findOneAndUpdate(
    { userId: DEMO_UID, tenantId },
    {
      userId: DEMO_UID,
      tenantId,
      role: 'owner',
      status: 'active',
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
  console.log('[demo-seed] Linked Firebase uid to tenant (owner):', DEMO_UID);
}

async function seedCustomers(tenantId) {
  const n = await Customer.countDocuments({ tenantId, customerId: /^CUST-DEMO-/ });
  if (n > 0) {
    console.log('[demo-seed] Demo customers already present (' + n + '), skipping');
    return;
  }

  const rows = [
    {
      tenantId,
      customerId: 'CUST-DEMO-001',
      firstName: 'Alex',
      lastName: 'Rivera',
      fullName: 'Alex Rivera',
      primaryPhone: '555-0101',
      email: 'alex.rivera@example.com',
      serviceStatus: 'active',
      serviceType: 'FWA',
      serviceAddress: {
        street: '100 Demo Lane',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        latitude: 30.2672,
        longitude: -97.7431
      },
      notes: `Seeded by ${DEMO_TAG} — edit or delete freely.`,
      isActive: true
    },
    {
      tenantId,
      customerId: 'CUST-DEMO-002',
      firstName: 'Jordan',
      lastName: 'Chen',
      fullName: 'Jordan Chen',
      primaryPhone: '555-0102',
      email: 'jordan.chen@example.com',
      serviceStatus: 'active',
      serviceType: '4G/5G',
      serviceAddress: {
        street: '250 Sample Rd',
        city: 'Denver',
        state: 'CO',
        zipCode: '80202',
        latitude: 39.7392,
        longitude: -104.9903
      },
      notes: `Seeded by ${DEMO_TAG}`,
      isActive: true
    },
    {
      tenantId,
      customerId: 'CUST-DEMO-003',
      isLead: true,
      leadHash: 'DEMO-LEAD-HASH-003',
      firstName: 'Prospect',
      lastName: 'Lead',
      fullName: 'Prospect Lead',
      primaryPhone: '555-0199',
      email: 'lead@example.com',
      leadStatus: 'qualified',
      serviceStatus: 'trial',
      notes: 'Sample sales lead',
      isActive: true
    }
  ];

  await Customer.insertMany(rows);
  console.log('[demo-seed] Inserted', rows.length, 'customers');
}

async function seedWorkOrders(tenantId) {
  const n = await WorkOrder.countDocuments({ tenantId, ticketNumber: /^TKT-DEMO-/ });
  if (n > 0) {
    console.log('[demo-seed] Demo work orders already present, skipping');
    return;
  }

  const now = new Date();
  await WorkOrder.insertMany([
    {
      tenantId,
      ticketNumber: 'TKT-DEMO-001',
      type: 'installation',
      ticketCategory: 'customer-facing',
      priority: 'high',
      status: 'in-progress',
      title: 'Install CPE — Alex Rivera',
      description: 'Standard rooftop install; ladder on site.',
      assignedToName: 'Demo Tech',
      affectedCustomers: [
        {
          customerId: 'CUST-DEMO-001',
          customerName: 'Alex Rivera',
          phoneNumber: '555-0101',
          serviceAddress: '100 Demo Lane, Austin, TX'
        }
      ],
      location: {
        type: 'customer',
        address: '100 Demo Lane, Austin, TX',
        gpsCoordinates: { latitude: 30.2672, longitude: -97.7431 }
      },
      createdAt: now,
      createdByName: 'demo-seed'
    },
    {
      tenantId,
      ticketNumber: 'TKT-DEMO-002',
      type: 'troubleshoot',
      issueCategory: 'poor-performance',
      ticketCategory: 'customer-facing',
      priority: 'medium',
      status: 'open',
      title: 'Throughput lower than plan — Jordan Chen',
      description: 'Speed test shows ~40% of package during peak hours.',
      affectedCustomers: [
        {
          customerId: 'CUST-DEMO-002',
          customerName: 'Jordan Chen',
          phoneNumber: '555-0102',
          serviceAddress: '250 Sample Rd, Denver, CO'
        }
      ],
      createdAt: now,
      createdByName: 'demo-seed'
    }
  ]);
  console.log('[demo-seed] Inserted demo work orders');
}

async function seedIncidents(tenantId) {
  const n = await IncidentModel.countDocuments({ tenantId, incidentNumber: /^INC-DEMO-/ });
  if (n > 0) {
    console.log('[demo-seed] Demo incidents already present, skipping');
    return;
  }

  await IncidentModel.insertMany([
    {
      tenantId,
      incidentNumber: 'INC-DEMO-001',
      source: 'monitoring',
      incidentType: 'performance-degradation',
      severity: 'medium',
      status: 'investigating',
      title: 'Backhaul latency elevated — Demo Tower East',
      description: 'Synthetic probe RTT increased vs baseline (demo data).',
      location: {
        type: 'tower',
        siteId: 'SITE-DEMO-EAST',
        siteName: 'Demo Tower East'
      },
      affectedSites: [
        { siteId: 'SITE-DEMO-EAST', siteName: 'Demo Tower East', siteType: 'tower', impact: 'degraded' }
      ],
      detectedAt: new Date(),
      createdBy: 'demo-seed'
    },
    {
      tenantId,
      incidentNumber: 'INC-DEMO-002',
      source: 'employee-report',
      incidentType: 'power-outage',
      severity: 'high',
      status: 'new',
      title: 'Generator test window — NOC',
      description: 'Planned generator exercise; monitoring for transfer events.',
      location: { type: 'noc', siteName: 'Demo NOC' },
      detectedAt: new Date(),
      createdBy: 'demo-seed'
    }
  ]);
  console.log('[demo-seed] Inserted demo incidents');
}

async function seedInventory(tenantId) {
  const n = await InventoryItem.countDocuments({ tenantId, serialNumber: /^DEMO-SN-/ });
  if (n > 0) {
    console.log('[demo-seed] Demo inventory already present, skipping');
    return;
  }

  await InventoryItem.insertMany([
    {
      tenantId,
      category: 'Radio Equipment',
      equipmentType: 'Sector radio',
      manufacturer: 'DemoRadio',
      model: 'DR-5000',
      serialNumber: 'DEMO-SN-0001',
      status: 'available',
      condition: 'new',
      currentLocation: {
        type: 'warehouse',
        siteName: 'Demo Warehouse',
        warehouse: { name: 'Main', section: 'A', aisle: '1', shelf: '3', bin: 'B' }
      },
      notes: 'Demo spare — assign to a work order or deploy flow.'
    },
    {
      tenantId,
      category: 'CPE Devices',
      equipmentType: 'Fixed wireless CPE',
      manufacturer: 'DemoCPE',
      model: 'DC-200',
      serialNumber: 'DEMO-SN-0002',
      status: 'deployed',
      condition: 'good',
      ipAddress: '10.66.0.42',
      currentLocation: {
        type: 'customer',
        siteName: 'Alex Rivera',
        customer: {
          customerId: 'CUST-DEMO-001',
          customerName: 'Alex Rivera',
          serviceAddress: '100 Demo Lane, Austin, TX'
        }
      },
      notes: 'Linked conceptually to CUST-DEMO-001 (demo).'
    }
  ]);
  console.log('[demo-seed] Inserted demo inventory items');
}

async function main() {
  const reset = process.argv.includes('--reset');
  await connect();

  try {
    let tenant = await Tenant.findOne({ subdomain: SUBDOMAIN });

    if (reset) {
      if (tenant) {
        await resetDemoTenant(tenant._id.toString());
        tenant = null;
      } else {
        console.log('[demo-seed] No existing demo tenant to reset');
      }
    }

    tenant = await ensureTenant();
    const tenantId = tenant._id.toString();

    await ensureUserTenantLink(tenantId);
    await seedCustomers(tenantId);
    await seedWorkOrders(tenantId);
    await seedIncidents(tenantId);
    await seedInventory(tenantId);

    console.log('');
    console.log('========== DEMO SEED COMPLETE ==========');
    console.log('Tenant ID (use for X-Tenant-ID / PUBLIC_SINGLE_TENANT_ID):');
    console.log(tenantId);
    console.log('');
    console.log('Next steps:');
    console.log('1) Set Module_Manager .env: PUBLIC_SINGLE_TENANT_MODE=true PUBLIC_SINGLE_TENANT_ID=' + tenantId);
    console.log('2) Set API .env: SINGLE_TENANT_ID=' + tenantId);
    console.log('3) Set PUBLIC_DEMO_SITE=true to show demo banner in the web app');
    console.log('4) Link your test Firebase user: DEMO_FIREBASE_USER_UID=<uid> node scripts/demo/seed-demo-data.js');
    console.log('========================================');
  } finally {
    await mongoose.disconnect();
    console.log('[demo-seed] Disconnected');
  }
}

main().catch((err) => {
  console.error('[demo-seed] FAILED:', err);
  process.exit(1);
});
