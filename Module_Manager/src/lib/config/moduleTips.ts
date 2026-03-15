/**
 * Module Tips Configuration
 * Extracts helpful tips from help documentation for each module
 */

export interface ModuleTip {
  id: string;
  title: string;
  content: string;
  icon?: string;
}

export interface ModuleTipsConfig {
  [moduleId: string]: ModuleTip[];
}

/** Placeholder replaced by dashboard when MOBILE_APP_DOWNLOAD_URL is set */
export const FIELD_APP_DOWNLOAD_PLACEHOLDER = '{{MOBILE_APP_DOWNLOAD_LINK}}';

export const moduleTips: ModuleTipsConfig = {
  'dashboard': [
    {
      id: 'dashboard-field-app',
      title: '📱 WISP Field App',
      icon: '📱',
      content: `
        <h4>Mobile app for field operations</h4>
        <p>Install the <strong>WISP Field App</strong> on your Android device for:</p>
        <ul>
          <li><strong>Plans & deployments</strong> – View and update plans in the field</li>
          <li><strong>Check-in/out</strong> – Equipment and site check-ins</li>
          <li><strong>Work orders</strong> – Create and complete work orders</li>
          <li><strong>Notifications</strong> – Stay updated on assignments and alerts</li>
        </ul>
        <p>${FIELD_APP_DOWNLOAD_PLACEHOLDER}</p>
        <p><strong>💡 Tip:</strong> Ask your administrator for the APK if the download link is not shown.</p>
      `
    },
    {
      id: 'dashboard-docs',
      title: '📖 Documentation & Help',
      icon: '📖',
      content: `
        <h4>Get help and documentation</h4>
        <p>Use the <strong>📖 Docs</strong> icon (top right) to open:</p>
        <ul>
          <li><strong>Getting Started</strong> – New users and administrators</li>
          <li><strong>Using WISP Management</strong> – Dashboard, wizards, and end-user help</li>
          <li><strong>Project Status</strong> – Current status and next steps</li>
        </ul>
        <p>Each module has a <strong>Help</strong> button for module-specific docs. The <strong>⚙️ Settings</strong> gear opens theme, branding, and tenant options.</p>
      `
    },
    {
      id: 'dashboard-quick-access',
      title: '⚡ Quick access',
      icon: '⚡',
      content: `
        <h4>Wizards and shortcuts</h4>
        <p>Use the <strong>Quick access</strong> dropdown in the header to:</p>
        <ul>
          <li>Open any wizard (Plan, Deploy, CBRS, Customers, HSS, Inventory, etc.)</li>
          <li>Jump to <strong>All wizards</strong> for the full list</li>
        </ul>
        <p>You can also go to <strong>Dashboard → module cards</strong> to open Plan, Deploy, Monitor, Customers, Hardware, and more.</p>
      `
    },
    {
      id: 'dashboard-overview',
      title: 'Overview',
      icon: '📚',
      content: `
        <h4>What is WISP Multitool?</h4>
        <p>All-in-one platform for WISPs: <strong>Network Planning</strong> (PCI, CBRS, coverage), <strong>Field Operations</strong> (mobile app, work orders, inventory), <strong>Customer Support</strong> (help desk, subscribers), <strong>Customers & Portal</strong> (records, billing, tickets), <strong>Device Management</strong> (ACS CPE, HSS), <strong>Team Management</strong> (roles, permissions), and <strong>Wizards & Quick Tips</strong>.</p>
      `
    },
    {
      id: 'dashboard-first-login',
      title: 'First login',
      icon: '🚀',
      content: `
        <h4>Getting started</h4>
        <ol>
          <li>Go to the platform URL and click <strong>Sign in with Google</strong></li>
          <li>Authorize with your Google account</li>
          <li>Select or create your organization (tenant)</li>
        </ol>
      `
    },
    {
      id: 'dashboard-header',
      title: 'Dashboard header',
      icon: '📌',
      content: `
        <h4>Header tools</h4>
        <p><strong>Docs</strong> – Opens full help. <strong>Settings</strong> – Theme, branding, module access. <strong>Notifications</strong> – In-app and browser (enable in panel). <strong>Quick access</strong> – Jump to wizards. First-time visitors see quick tips.</p>
      `
    },
    {
      id: 'dashboard-inviting',
      title: 'Inviting team members',
      icon: '👥',
      content: `
        <h4>Add users</h4>
        <p>Go to <strong>User Management</strong> → <strong>Invite User</strong>. Enter email, select role (Admin, Engineer, Installer, Help Desk, Viewer), then <strong>Send Invitation</strong>. User appears as Pending until they accept.</p>
      `
    },
    {
      id: 'dashboard-mobile-app',
      title: 'Mobile app setup',
      icon: '📱',
      content: `
        <h4>Field technicians</h4>
        <p>Install the WISP Field App APK, grant Camera/Location/Notifications, sign in with the same Google account, select your organization. Technicians then receive work orders and can check in equipment.</p>
      `
    },
    {
      id: 'dashboard-roles',
      title: 'User roles (summary)',
      icon: '🔐',
      content: `
        <h4>Who can do what</h4>
        <p><strong>Owner</strong> – Full control, cannot be changed. <strong>Admin</strong> – Manage users and modules. <strong>Engineer</strong> – PCI, CBRS, HSS, ACS. <strong>Field Technician</strong> – Mobile app, assigned work orders. <strong>Help Desk</strong> – Tickets, CPE troubleshooting. <strong>Viewer</strong> – Read-only. Configure in <strong>Settings → Module Access</strong>.</p>
      `
    },
    {
      id: 'dashboard-wizards',
      title: 'Wizards in small bites',
      icon: '🧙',
      content: `
        <h4>Guided flows</h4>
        <p><strong>Site Deployment</strong>, <strong>Subscriber Creation/Group/Bandwidth Plan</strong>, <strong>RMA Tracking</strong>, <strong>Customer Onboarding</strong>, <strong>Device Onboarding/Registration</strong> (ACS & CBRS), <strong>Conflict Resolution</strong> (PCI), <strong>Work Order Creation</strong>, <strong>Troubleshooting (ACS)</strong>, <strong>First-time/Organization/Initial Configuration</strong>. Open from Quick access or the Wizards page.</p>
      `
    },
    {
      id: 'dashboard-troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      content: `
        <h4>Common fixes</h4>
        <p><strong>Can't see a module</strong> – Ask admin to enable it in Settings → Module Access. <strong>403 Forbidden</strong> – Role or permissions need updating. <strong>Mobile notifications</strong> – Check app permissions and FCM. <strong>Browser notifications</strong> – Enable in the Notifications panel. <strong>Theme</strong> – Settings (gear) → choose light/dark.</p>
      `
    }
  ],
  'monitoring': [
    {
      id: 'monitoring-1',
      title: '📊 Getting Started with Monitoring',
      icon: '📊',
      content: `
        <h4>Before devices appear in Monitor:</h4>
        <p>Devices must be configured in the <strong>Deploy</strong> module first:</p>
        <ol>
          <li>Go to <strong>Deploy</strong> module</li>
          <li>Right-click on deployed equipment</li>
          <li>Select <strong>"Configure SNMP"</strong></li>
          <li>Enter SNMP credentials and test connection</li>
          <li>Device will then appear in Monitor module</li>
        </ol>
        <p><strong>💡 Tip:</strong> If no devices are showing, check that SNMP is configured in Deploy module.</p>
      `
    },
    {
      id: 'monitoring-2',
      title: '📈 Viewing Performance Metrics',
      icon: '📈',
      content: `
        <h4>Performance Graphs Tab</h4>
        <p>View detailed metrics for any device:</p>
        <ol>
          <li>Click <strong>"Graphs"</strong> tab</li>
          <li>Select device from dropdown</li>
          <li>View metrics:
            <ul>
              <li>CPU usage over time</li>
              <li>Memory utilization</li>
              <li>Network throughput</li>
              <li>Interface statistics</li>
            </ul>
          </li>
          <li>Adjust time range (1 hour, 24 hours, 7 days)</li>
        </ol>
        <p><strong>💡 Tip:</strong> Use graphs to identify performance issues and capacity planning.</p>
      `
    },
    {
      id: 'monitoring-3',
      title: '🚨 Understanding Alerts',
      icon: '🚨',
      content: `
        <h4>Network Dashboard</h4>
        <p>The dashboard shows:</p>
        <ul>
          <li><strong>System Health:</strong> Overall network status</li>
          <li><strong>Active Alerts:</strong> Critical warnings and errors</li>
          <li><strong>Service Status:</strong> SNMP, EPC, and other services</li>
          <li><strong>Key Metrics:</strong> Uptime, device counts, performance</li>
        </ul>
        <p><strong>💡 Tip:</strong> Check the dashboard regularly to catch issues early.</p>
      `
    },
    {
      id: 'monitoring-4',
      title: '📡 Monitoring SNMP Devices',
      icon: '📡',
      content: `
        <h4>SNMP Devices Tab</h4>
        <p>View all SNMP-enabled devices:</p>
        <ol>
          <li>Click <strong>"SNMP Devices"</strong> tab</li>
          <li>View device list with:
            <ul>
              <li>Device name and type</li>
              <li>Online/Offline status</li>
              <li>IP address</li>
              <li>Last seen timestamp</li>
              <li>Uptime percentage</li>
            </ul>
          </li>
          <li>Click device to view detailed information</li>
          <li>View performance graphs for specific devices</li>
        </ol>
        <p><strong>💡 Tip:</strong> Devices show as offline if they haven't checked in within 5 minutes.</p>
      `
    },
    {
      id: 'monitoring-5',
      title: '🖥️ Monitoring EPC Systems',
      icon: '🖥️',
      content: `
        <h4>EPC Devices Tab</h4>
        <p>Monitor Evolved Packet Core systems:</p>
        <ol>
          <li>Click <strong>"EPC Devices"</strong> tab</li>
          <li>View EPC systems:
            <ul>
              <li>MME connections</li>
              <li>HSS status</li>
              <li>Active subscribers</li>
              <li>System health metrics</li>
            </ul>
          </li>
          <li>Click device for detailed view</li>
          <li>Monitor CPU, memory, and uptime</li>
        </ol>
        <p><strong>💡 Tip:</strong> EPC devices must be deployed in Deploy module before they appear here.</p>
      `
    },
    {
      id: 'monitoring-6',
      title: '🗺️ Geographic Map View',
      icon: '🗺️',
      content: `
        <h4>Map Tab</h4>
        <p>Visualize device locations on map:</p>
        <ul>
          <li><strong>Green markers:</strong> Online devices</li>
          <li><strong>Red markers:</strong> Offline devices</li>
          <li><strong>Orange markers:</strong> Maintenance mode</li>
        </ul>
        <p>Actions:</p>
        <ol>
          <li>Click marker for device details</li>
          <li>Right-click for site details</li>
          <li>View all equipment at a site</li>
        </ol>
        <p><strong>💡 Tip:</strong> Use the map to quickly identify which sites need attention. Open <strong>Help</strong> in this module for more.</p>
      `
    }
  ],
  'deploy': [
    {
      id: 'deploy-1',
      title: '📋 Reviewing and Approving Plans',
      icon: '📋',
      content: `
        <h4>Step 1: Review Ready Plans</h4>
        <p>Plans come from the Plan module:</p>
        <ol>
          <li>Click <strong>"Projects"</strong> button in header</li>
          <li>View projects in <strong>"Ready"</strong> status</li>
          <li>Review each plan:
            <ul>
              <li>Project name and description</li>
              <li>Planned sites and sectors</li>
              <li>Hardware requirements</li>
              <li>Marketing addresses discovered</li>
            </ul>
          </li>
          <li>Select a plan to review details</li>
        </ol>
        <p><strong>💡 Tip:</strong> Only "Ready" plans can be approved for deployment.</p>
      `
    },
    {
      id: 'deploy-2',
      title: '✅ Approving or Rejecting Plans',
      icon: '✅',
      content: `
        <h4>Step 2: Make Approval Decision</h4>
        <p>After reviewing a plan:</p>
        <ol>
          <li>Select the ready plan</li>
          <li>Review all planned assets carefully</li>
          <li>Click <strong>"Approve"</strong> or <strong>"Reject"</strong></li>
          <li>If approved:
            <ul>
              <li>Plan status changes to <strong>"Approved"</strong></li>
              <li>Plan becomes available for deployment</li>
              <li>You can authorize deployment</li>
            </ul>
          </li>
          <li>If rejected:
            <ul>
              <li>Add rejection reason</li>
              <li>Plan returns to Plan module for revision</li>
            </ul>
          </li>
        </ol>
        <p><strong>💡 Tip:</strong> Verify inventory availability before approving.</p>
      `
    },
    {
      id: 'deploy-3',
      title: '🔐 Authorizing Deployment',
      icon: '🔐',
      content: `
        <h4>Step 3: Authorize Approved Plans</h4>
        <p>Before deployment can begin:</p>
        <ol>
          <li>Select an approved plan</li>
          <li>Verify inventory is available for all requirements</li>
          <li>Click <strong>"Authorize Deployment"</strong></li>
          <li>Plan status changes to <strong>"Authorized"</strong></li>
          <li>Deployment can now begin</li>
        </ol>
        <p><strong>💡 Tip:</strong> Authorization locks the plan and allows field deployment to start.</p>
      `
    },
    {
      id: 'deploy-4',
      title: '🔧 Deploying Hardware to Sites',
      icon: '🔧',
      content: `
        <h4>Step 4: Deploy Equipment</h4>
        <p>Deploy hardware from inventory to sites:</p>
        <ol>
          <li>Right-click on a tower site marker on the map</li>
          <li>Select <strong>"View Equipment"</strong> or <strong>"Deploy Hardware"</strong></li>
          <li>Choose equipment from inventory:
            <ul>
              <li>Filter by equipment type</li>
              <li>View available quantities</li>
              <li>Select items to deploy</li>
            </ul>
          </li>
          <li>Enter deployment details (date, installer, notes)</li>
          <li>Click <strong>"Deploy"</strong></li>
          <li>Equipment status changes to "Deployed"</li>
        </ol>
        <p><strong>💡 Tip:</strong> Equipment must be in inventory before it can be deployed.</p>
      `
    },
    {
      id: 'deploy-5',
      title: '📡 Deploying EPC Systems',
      icon: '📡',
      content: `
        <h4>Step 5: Deploy EPC/SNMP Agents</h4>
        <p>To deploy remote EPC/SNMP agents:</p>
        <ol>
          <li>Click the <strong>EPC Deployment</strong> button in header</li>
          <li>Select a <strong>site</strong> from the dropdown (required)</li>
          <li>Choose deployment type:
            <ul>
              <li><strong>EPC Core Only:</strong> Open5GS EPC components</li>
              <li><strong>SNMP Only:</strong> Monitoring agents</li>
              <li><strong>Both:</strong> EPC + SNMP together</li>
            </ul>
          </li>
          <li>Configure network and HSS settings</li>
          <li>Generate deployment script or ISO</li>
        </ol>
        <p><strong>💡 Tip:</strong> Site selection is required - create sites in Coverage Map first if needed.</p>
      `
    },
    {
      id: 'deploy-6',
      title: '🔍 Configuring SNMP Monitoring',
      icon: '🔍',
      content: `
        <h4>Step 6: Set Up SNMP Monitoring</h4>
        <p>Enable monitoring for deployed equipment:</p>
        <ol>
          <li>Right-click on deployed equipment on the map</li>
          <li>Select <strong>"Configure SNMP"</strong></li>
          <li>Enter SNMP credentials:
            <ul>
              <li>SNMP community string (v2c) or username (v3)</li>
              <li>Device IP address</li>
              <li>SNMP version</li>
            </ul>
          </li>
          <li>Test connection</li>
          <li>Save configuration</li>
          <li>Device appears in Monitor module</li>
        </ol>
        <p><strong>💡 Tip:</strong> SNMP must be configured before devices show up in Monitoring module.</p>
      `
    },
    {
      id: 'deploy-7',
      title: '📊 PCI and Frequency Planning',
      icon: '📊',
      content: `
        <h4>Planning Tools</h4>
        <p>Use built-in planning tools to optimize your network:</p>
        <ul>
          <li><strong>PCI Planner:</strong> Plan Physical Cell ID assignments for LTE sectors
            <ul>
              <li>Prevents PCI conflicts</li>
              <li>Optimizes cell identification</li>
            </ul>
          </li>
          <li><strong>Frequency Planner:</strong> Optimize frequency assignments across network
            <ul>
              <li>Prevents interference</li>
              <li>Maximizes spectrum efficiency</li>
            </ul>
          </li>
        </ul>
        <p><strong>💡 Tip:</strong> Run these planners before deploying to avoid conflicts.</p>
      `
    }
  ],
  'coverage-map': [
    {
      id: 'coverage-1',
      title: '🗺️ Getting Started with Coverage Map',
      icon: '🗺️',
      content: `
        <h4>Coverage Map is Your Central Hub</h4>
        <p>The Coverage Map consolidates all network equipment into a single interactive map:</p>
        <ul>
          <li><strong>Tower Sites:</strong> Add and manage tower locations</li>
          <li><strong>Sectors:</strong> Configure sectors per tower</li>
          <li><strong>CPE Devices:</strong> View customer equipment locations</li>
          <li><strong>Backhaul Links:</strong> Visualize network connections</li>
          <li><strong>Equipment Inventory:</strong> Track deployed equipment at sites</li>
        </ul>
        <p><strong>💡 Tip:</strong> This is the central hub for viewing your entire network infrastructure.</p>
      `
    },
    {
      id: 'coverage-2',
      title: '📡 Adding Tower Sites',
      icon: '📡',
      content: `
        <h4>Step 1: Add a Tower Site</h4>
        <ol>
          <li>Click <strong>"Add Site"</strong> button</li>
          <li>Enter site information:
            <ul>
              <li>Site name and address</li>
              <li>GPS coordinates (or click on map)</li>
              <li>Site type (Tower, Building, Pole, etc.)</li>
              <li>Tower height in meters</li>
            </ul>
          </li>
          <li>Click <strong>"Save"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> You can click directly on the map to set GPS coordinates automatically.</p>
      `
    },
    {
      id: 'coverage-3',
      title: '📶 Adding Sectors',
      icon: '📶',
      content: `
        <h4>Step 2: Add Sectors to Sites</h4>
        <ol>
          <li>Click on a tower site marker on the map</li>
          <li>Click <strong>"Add Sector"</strong> from site popup</li>
          <li>Enter sector details:
            <ul>
              <li><strong>Azimuth:</strong> Direction (0-360°)</li>
              <li><strong>Tilt:</strong> Antenna downtilt angle</li>
              <li><strong>Frequency:</strong> Operating frequency band</li>
              <li><strong>Technology:</strong> LTE, 5G, WiMAX, etc.</li>
              <li><strong>Power:</strong> Transmit power in dBm</li>
            </ul>
          </li>
          <li>Save sector</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plan 3-6 sectors per tower for 360° coverage.</p>
      `
    },
    {
      id: 'coverage-4',
      title: '📱 Managing CPE Devices',
      icon: '📱',
      content: `
        <h4>Step 3: Add CPE Devices</h4>
        <p>Customer Premise Equipment represents customer devices:</p>
        <ol>
          <li>Click <strong>"Add CPE"</strong> button</li>
          <li>Enter CPE information:
            <ul>
              <li>Serial number and model</li>
              <li>Associated customer</li>
              <li>Location (GPS or click map)</li>
              <li>Status (Active, Inactive, Maintenance)</li>
            </ul>
          </li>
          <li>Save CPE device</li>
        </ol>
        <p><strong>💡 Tip:</strong> CPE devices link to customer accounts and track installation locations.</p>
      `
    },
    {
      id: 'coverage-5',
      title: '🔗 Managing Backhaul Links',
      icon: '🔗',
      content: `
        <h4>Step 4: Add Backhaul Connections</h4>
        <p>Visualize point-to-point network connections:</p>
        <ol>
          <li>Click on a site marker</li>
          <li>Select <strong>"Add Backhaul"</strong></li>
          <li>Choose source and destination sites</li>
          <li>Enter link details:
            <ul>
              <li>Link type (Point-to-point, Point-to-multipoint)</li>
              <li>Frequency and bandwidth</li>
              <li>Status (Active, Planned, Maintenance)</li>
            </ul>
          </li>
          <li>Save backhaul link</li>
        </ol>
        <p><strong>💡 Tip:</strong> Backhaul links show how sites connect to your network backbone.</p>
      `
    },
    {
      id: 'coverage-6',
      title: '📦 Viewing Site Equipment',
      icon: '📦',
      content: `
        <h4>Step 5: Manage Equipment at Sites</h4>
        <p>View and manage equipment deployed at each site:</p>
        <ol>
          <li>Click on a site marker</li>
          <li>Click <strong>"View Equipment"</strong> or <strong>"Deploy Hardware"</strong></li>
          <li>See all equipment at that site:
            <ul>
              <li>Radios and antennas</li>
              <li>Routers and switches</li>
              <li>EPC systems</li>
              <li>SNMP monitoring devices</li>
            </ul>
          </li>
          <li>Add or remove equipment as needed</li>
        </ol>
        <p><strong>💡 Tip:</strong> Equipment must be in inventory before it can be deployed to sites.</p>
      `
    }
  ],
  'inventory': [
    {
      id: 'inventory-1',
      title: '📦 Adding Equipment to Inventory',
      icon: '📦',
      content: `
        <h4>Step 1: Add Equipment</h4>
        <ol>
          <li>Navigate to <strong>Inventory</strong> module</li>
          <li>Click <strong>"Add Equipment"</strong> button</li>
          <li>Enter equipment details:
            <ul>
              <li><strong>Serial Number</strong> (required, unique identifier)</li>
              <li><strong>Model/Type</strong> and Manufacturer</li>
              <li><strong>Category:</strong> Router, Radio, Antenna, CPE, etc.</li>
              <li><strong>Purchase Date</strong> and Warranty Expiration</li>
              <li><strong>Initial Location:</strong> Warehouse, vehicle, or site</li>
            </ul>
          </li>
          <li>Click <strong>"Save"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> Each item automatically gets a QR code for quick lookup.</p>
      `
    },
    {
      id: 'inventory-2',
      title: '📱 Using QR Codes',
      icon: '📱',
      content: `
        <h4>Step 2: QR Code Scanning</h4>
        <p>QR codes make equipment tracking easy:</p>
        <ul>
          <li>QR code appears on equipment detail page</li>
          <li>Print QR code labels for physical equipment</li>
          <li>Use mobile app scanner to quickly lookup equipment</li>
          <li>QR codes link directly to equipment records</li>
          <li>Scan QR code to check out, deploy, or update status</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use QR codes in the field to quickly check equipment status and location.</p>
      `
    },
    {
      id: 'inventory-3',
      title: '🚚 Checking Out Equipment',
      icon: '🚚',
      content: `
        <h4>Step 3: Check Out Equipment</h4>
        <p>When deploying equipment to field:</p>
        <ol>
          <li>Select equipment from inventory list</li>
          <li>Click <strong>"Check Out"</strong> button</li>
          <li>Select destination:
            <ul>
              <li><strong>Field Technician</strong> - Assign to specific tech</li>
              <li><strong>Vehicle</strong> - Assign to service vehicle</li>
              <li><strong>Site</strong> - Deploy to tower site</li>
            </ul>
          </li>
          <li>Add notes (optional)</li>
          <li>Click <strong>"Check Out"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> Track equipment location at all times for better inventory management.</p>
      `
    },
    {
      id: 'inventory-4',
      title: '🔧 Maintenance Tracking',
      icon: '🔧',
      content: `
        <h4>Step 4: Track Maintenance</h4>
        <p>Record maintenance history for equipment:</p>
        <ol>
          <li>Open equipment details</li>
          <li>Click <strong>"Add Maintenance Record"</strong></li>
          <li>Enter maintenance information:
            <ul>
              <li>Type (Repair, Firmware Update, Inspection)</li>
              <li>Date and technician</li>
              <li>Description and cost</li>
            </ul>
          </li>
          <li>Save maintenance record</li>
        </ol>
        <p><strong>💡 Tip:</strong> Track maintenance history to identify recurring issues and warranty status.</p>
      `
    },
    {
      id: 'inventory-5',
      title: '📊 Inventory Reports',
      icon: '📊',
      content: `
        <h4>Step 5: Generate Reports</h4>
        <p>Create reports for inventory management:</p>
        <ul>
          <li><strong>Inventory Summary:</strong> Total equipment by category and status</li>
          <li><strong>Location Report:</strong> Equipment distribution by location</li>
          <li><strong>Maintenance Report:</strong> Maintenance history and costs</li>
          <li><strong>Warranty Report:</strong> Equipment with expiring warranties</li>
          <li><strong>Deployment Report:</strong> Equipment deployed at customer sites</li>
        </ul>
        <p><strong>💡 Tip:</strong> Export reports to CSV for Excel analysis or schedule automated reports.</p>
      `
    },
    {
      id: 'inventory-6',
      title: 'RMA tracking',
      icon: '↩️',
      content: `
        <h4>Returns and tracking</h4>
        <p>Use the <strong>RMA Tracking</strong> wizard (Quick access or Wizards page) to log returns, track RMA status, and link equipment to RMA records.</p>
      `
    }
  ],
  'plan': [
    {
      id: 'plan-1',
      title: '📋 Creating a New Project',
      icon: '📋',
      content: `
        <h4>Step 1: Create a New Project</h4>
        <p>To start planning your network expansion:</p>
        <ol>
          <li>Click the <strong>"Projects"</strong> button in the header</li>
          <li>Click <strong>"New Project"</strong> button</li>
          <li>Enter project details:
            <ul>
              <li><strong>Project Name</strong> - Descriptive name (e.g., "Downtown Expansion")</li>
              <li><strong>Description</strong> - Project goals and scope</li>
              <li><strong>Location</strong> - Target area address or coordinates</li>
              <li><strong>Target Radius</strong> - Coverage area in miles (default: 5 miles)</li>
            </ul>
          </li>
          <li>Click <strong>"Create Project"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> Projects start in "Draft" status and can be edited until submitted.</p>
      `
    },
    {
      id: 'plan-2',
      title: '🔍 Discovering Marketing Addresses',
      icon: '🔍',
      content: `
        <h4>Step 2: Find Potential Customers</h4>
        <p>Discover addresses in your target area:</p>
        <ol>
          <li>With a project active, click <strong>"Find Addresses"</strong> button</li>
          <li>Draw a rectangle on the map to define the search area</li>
          <li>System discovers potential customer addresses automatically</li>
          <li>Review discovered addresses:
            <ul>
              <li>Address details and coordinates</li>
              <li>Estimated serviceability</li>
              <li>Distance from planned towers</li>
            </ul>
          </li>
          <li>Addresses are automatically saved to your project</li>
        </ol>
        <p><strong>💡 Tip:</strong> Use this to identify potential customers before deploying infrastructure.</p>
      `
    },
    {
      id: 'plan-3',
      title: '📡 Planning Tower Sites',
      icon: '📡',
      content: `
        <h4>Step 3: Add Tower Sites to Plan</h4>
        <p>Plan where to deploy towers:</p>
        <ol>
          <li>Right-click on the map where you want a tower</li>
          <li>Select <strong>"Add to Plan" → "Add Site"</strong></li>
          <li>Enter tower details:
            <ul>
              <li>Site name and type (Tower, Building, Pole)</li>
              <li>Height and location coordinates</li>
              <li>FCC ID (if applicable)</li>
            </ul>
          </li>
          <li>Tower is automatically linked to your active project</li>
          <li>Repeat for all planned tower locations</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plan towers strategically to maximize coverage of discovered addresses.</p>
      `
    },
    {
      id: 'plan-4',
      title: '📶 Planning Sectors',
      icon: '📶',
      content: `
        <h4>Step 4: Configure Sectors per Tower</h4>
        <p>Add sectors to each planned tower:</p>
        <ol>
          <li>Right-click on a planned tower marker</li>
          <li>Select <strong>"Add to Plan" → "Add Sector"</strong></li>
          <li>Configure sector parameters:
            <ul>
              <li><strong>Azimuth</strong> - Direction (0-360 degrees)</li>
              <li><strong>Beamwidth</strong> - Coverage angle</li>
              <li><strong>Tilt</strong> - Antenna tilt angle</li>
              <li><strong>Frequency Band</strong> - Operating frequency</li>
              <li><strong>Technology</strong> - LTE, CBRS, FWA, etc.</li>
            </ul>
          </li>
          <li>Sector is linked to your project</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plan 3-6 sectors per tower for 360° coverage.</p>
      `
    },
    {
      id: 'plan-5',
      title: '📦 Adding Hardware Requirements',
      icon: '📦',
      content: `
        <h4>Step 5: Plan Required Equipment</h4>
        <p>Track what equipment you'll need:</p>
        <ol>
          <li>Click <strong>"Hardware"</strong> button in the header</li>
          <li>Click <strong>"Add Requirement"</strong></li>
          <li>Enter equipment details:
            <ul>
              <li>Category (Radio, Antenna, Router, etc.)</li>
              <li>Equipment type and model</li>
              <li>Quantity needed</li>
              <li>Priority level</li>
            </ul>
          </li>
          <li>Requirements are tracked for inventory planning</li>
        </ol>
        <p><strong>💡 Tip:</strong> Add all hardware requirements before submitting for approval.</p>
      `
    },
    {
      id: 'plan-6',
      title: '✅ Submitting Plans for Approval',
      icon: '✅',
      content: `
        <h4>Step 6: Submit Plan for Review</h4>
        <p>When your plan is complete:</p>
        <ol>
          <li>Review all planned sites, sectors, and hardware</li>
          <li>Click <strong>"Projects"</strong> button</li>
          <li>Select your project</li>
          <li>Click <strong>"Submit for Approval"</strong> or change status to <strong>"Ready"</strong></li>
          <li>Plan moves to Deploy module for approval</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plans must be approved in Deploy module before hardware can be deployed. Use <strong>Quick access</strong> on the dashboard to jump to wizards.</p>
      `
    },
    {
      id: 'plan-7',
      title: '🗺️ Using the Plan Layer',
      icon: '🗺️',
      content: `
        <h4>Visualizing Your Plan</h4>
        <p>The plan layer shows all your planned infrastructure:</p>
        <ul>
          <li><strong>Planned Sites:</strong> Tower locations marked on map</li>
          <li><strong>Planned Sectors:</strong> Coverage areas for each sector</li>
          <li><strong>Equipment Requirements:</strong> Tracked in hardware view</li>
          <li><strong>Marketing Addresses:</strong> Discovered customer locations</li>
          <li><strong>Coverage Areas:</strong> Visualize planned coverage</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use the Layers button to toggle visibility of different plan elements.</p>
      `
    }
  ],
  'hss-management': [
    {
      id: 'hss-1',
      title: '🔐 Adding Subscribers',
      icon: '🔐',
      content: `
        <h4>Step 1: Add a Subscriber</h4>
        <p>Create subscriber profiles for LTE/5G networks:</p>
        <ol>
          <li>Click <strong>"Add Subscriber"</strong> button</li>
          <li>Enter subscriber information:
            <ul>
              <li><strong>IMSI:</strong> 15-digit identifier (MCC + MNC + MSIN)</li>
              <li><strong>MSISDN:</strong> Phone number (E.164 format, optional)</li>
              <li><strong>Ki:</strong> 128-bit authentication key (hex format, required)</li>
              <li><strong>OP/OPc:</strong> Operator variant key (optional)</li>
              <li><strong>APN:</strong> Access Point Name (default: internet)</li>
            </ul>
          </li>
          <li>Click <strong>"Create Subscriber"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> IMSI must be unique and Ki is required for authentication.</p>
      `
    },
    {
      id: 'hss-2',
      title: '📱 Managing Subscriber Groups',
      icon: '📱',
      content: `
        <h4>Step 2: Organize Subscribers</h4>
        <p>Group subscribers for bulk operations:</p>
        <ol>
          <li>Click <strong>"Groups"</strong> tab</li>
          <li>Create or select a group</li>
          <li>Assign subscribers to groups</li>
          <li>Use groups for:
            <ul>
              <li>Bulk operations (suspend, activate, delete)</li>
              <li>Service profile management</li>
              <li>Bandwidth plan assignments</li>
            </ul>
          </li>
        </ol>
        <p><strong>💡 Tip:</strong> Groups help organize subscribers by service tier or location.</p>
      `
    },
    {
      id: 'hss-3',
      title: '🌐 Deploying EPC Systems',
      icon: '🌐',
      content: `
        <h4>Step 3: Deploy EPC</h4>
        <p>Deploy Evolved Packet Core systems:</p>
        <ol>
          <li>Click <strong>"Deploy EPC"</strong> button</li>
          <li>Configure EPC parameters:
            <ul>
              <li>MME connection settings</li>
              <li>HSS integration</li>
              <li>Network configuration</li>
            </ul>
          </li>
          <li>Deploy EPC system</li>
          <li>Verify EPC connectivity</li>
        </ol>
        <p><strong>💡 Tip:</strong> EPC systems must be deployed before subscribers can connect.</p>
      `
    },
    {
      id: 'hss-4',
      title: '🔌 Connecting MME',
      icon: '🔌',
      content: `
        <h4>Step 4: Connect MME</h4>
        <p>Connect Mobile Management Entities to HSS:</p>
        <ol>
          <li>Click <strong>"MME Connections"</strong> tab</li>
          <li>Add MME connection</li>
          <li>Enter MME details:
            <ul>
              <li>MME hostname or IP</li>
              <li>Port number</li>
              <li>Authentication credentials</li>
            </ul>
          </li>
          <li>Test connection</li>
          <li>Save MME connection</li>
        </ol>
        <p><strong>💡 Tip:</strong> MME connections enable subscriber authentication and session management.</p>
      `
    },
    {
      id: 'hss-5',
      title: 'Bandwidth plans',
      icon: '📊',
      content: `
        <h4>Service tiers</h4>
        <p>Create bandwidth plans for subscriber tiers. Use the <strong>Bandwidth Plan</strong> wizard from Quick access. Assign plans to groups or individual subscribers for QoS and rate limiting.</p>
      `
    }
  ],
  'cbrs-management': [
    {
      id: 'cbrs-0',
      title: '📡 Get Started with CBRS',
      icon: '📡',
      content: `
        <h4>First-time setup</h4>
        <p>Configure Google SAS access for your tenant:</p>
        <ol>
          <li>Run the <strong>Setup Wizard</strong> (or use the banner link when config is incomplete)</li>
          <li>Sign in with Google and select your User ID / network</li>
          <li>Complete the connection test step</li>
          <li>Add your first CBSD device using <strong>"+ Add CBSD Device"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> CBRS Management uses Google SAS in shared-platform mode. Ensure your Google account is registered for SAS access. Use the module <strong>Help</strong> button for full docs.</p>
      `
    },
    {
      id: 'cbrs-1',
      title: '📡 Registering CBSD Devices',
      icon: '📡',
      content: `
        <h4>Step 1: Add CBSD Device</h4>
        <p>Register Citizens Broadband Service Devices:</p>
        <ol>
          <li>Click <strong>"+ Add CBSD Device"</strong></li>
          <li>Enter device information:
            <ul>
              <li><strong>CBSD Serial Number:</strong> Unique identifier</li>
              <li><strong>FCC ID:</strong> FCC equipment authorization</li>
              <li><strong>Category:</strong> A (indoor) or B (outdoor)</li>
              <li><strong>SAS Provider:</strong> Google SAS or Federated Wireless</li>
              <li><strong>Location:</strong> GPS coordinates</li>
            </ul>
          </li>
          <li>Save device</li>
        </ol>
        <p><strong>💡 Tip:</strong> Category B devices have higher power limits and require outdoor installation.</p>
      `
    },
    {
      id: 'cbrs-2',
      title: '📊 Requesting Spectrum Grants',
      icon: '📊',
      content: `
        <h4>Step 2: Request Spectrum</h4>
        <p>Get spectrum authorization from SAS:</p>
        <ol>
          <li>Select registered CBSD device</li>
          <li>Click <strong>"Request Grant"</strong></li>
          <li>SAS evaluates request:
            <ul>
              <li>Checks for incumbent protection</li>
              <li>Assigns available spectrum</li>
              <li>Returns grant with frequency and power</li>
            </ul>
          </li>
          <li>Monitor grant status</li>
        </ol>
        <p><strong>💡 Tip:</strong> Grants are automatically renewed via heartbeat messages.</p>
      `
    },
    {
      id: 'cbrs-3',
      title: '🗺️ Geographic Visualization',
      icon: '🗺️',
      content: `
        <h4>Step 3: View Device Map</h4>
        <p>Visualize CBSD locations on interactive map:</p>
        <ul>
          <li><strong>Color-coded status:</strong> Green (authorized), Yellow (pending), Red (error)</li>
          <li><strong>Click markers:</strong> View device details and grant status</li>
          <li><strong>Multi-site coordination:</strong> See all devices in your network</li>
          <li><strong>Coverage analysis:</strong> Visualize coverage areas</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use the map to coordinate multi-site deployments and avoid interference.</p>
      `
    }
  ],
  'pci-resolution': [
    {
      id: 'pci-1',
      title: '📊 Importing Cell Data',
      icon: '📊',
      content: `
        <h4>Step 1: Import Cell Data</h4>
        <p>Add cell sites to analyze:</p>
        <ol>
          <li>Click <strong>"📊 Manage Towers"</strong> button</li>
          <li>Choose import method:
            <ul>
              <li><strong>Manual Entry:</strong> Add sites one by one</li>
              <li><strong>CSV Import:</strong> Upload CSV file with cell data</li>
              <li><strong>KML Import:</strong> Import from Google Earth KML files</li>
            </ul>
          </li>
          <li>Required fields: eNodeB, Cell ID, PCI, Latitude, Longitude</li>
          <li>Save imported data</li>
        </ol>
        <p><strong>💡 Tip:</strong> CSV format: eNodeB,Cell ID,PCI,Latitude,Longitude,Azimuth,Height</p>
      `
    },
    {
      id: 'pci-2',
      title: '🔍 Analyzing Network',
      icon: '🔍',
      content: `
        <h4>Step 2: Detect PCI Conflicts</h4>
        <p>Analyze network for PCI conflicts:</p>
        <ol>
          <li>Click <strong>"🔍 Analyze Network"</strong></li>
          <li>System detects:
            <ul>
              <li><strong>High Severity:</strong> Same PCI in neighboring cells</li>
              <li><strong>Medium Severity:</strong> Mod3 conflicts (PCI % 3)</li>
              <li><strong>Low Severity:</strong> Mod6 conflicts (PCI % 6)</li>
            </ul>
          </li>
          <li>Review conflict table with affected cells</li>
          <li>See distance between conflicting cells</li>
        </ol>
        <p><strong>💡 Tip:</strong> High severity conflicts cause the most interference and should be resolved first.</p>
      `
    },
    {
      id: 'pci-3',
      title: '🤖 AI Recommendations',
      icon: '🤖',
      content: `
        <h4>Step 3: Get AI Optimization</h4>
        <p>Use Google Gemini AI for intelligent recommendations:</p>
        <ol>
          <li>Click <strong>"🤖 Get AI Recommendations"</strong></li>
          <li>AI analyzes:
            <ul>
              <li>Network topology</li>
              <li>Neighbor relationships</li>
              <li>Interference patterns</li>
            </ul>
          </li>
          <li>Receive prioritized PCI reallocation suggestions</li>
          <li>Review AI recommendations</li>
        </ol>
        <p><strong>💡 Tip:</strong> AI recommendations consider network-wide optimization, not just individual conflicts.</p>
      `
    },
    {
      id: 'pci-4',
      title: '✨ Optimizing Network',
      icon: '✨',
      content: `
        <h4>Step 4: Resolve Conflicts</h4>
        <p>Automatically resolve all PCI conflicts:</p>
        <ol>
          <li>Click <strong>"✨ Optimize Network"</strong></li>
          <li>System automatically:
            <ul>
              <li>Reassigns conflicting PCIs</li>
              <li>Maintains existing PCIs where possible</li>
              <li>Considers neighbor relationships</li>
            </ul>
          </li>
          <li>Review before/after comparison</li>
          <li>Export updated configuration</li>
        </ol>
        <p><strong>💡 Tip:</strong> Optimization maintains existing PCIs when possible to minimize changes.</p>
      `
    },
    {
      id: 'pci-5',
      title: '📤 Exporting Results',
      icon: '📤',
      content: `
        <h4>Step 5: Export Configuration</h4>
        <p>Export optimized PCI assignments:</p>
        <ul>
          <li><strong>Conflict Report (PDF):</strong> Detailed analysis and recommendations</li>
          <li><strong>CSV Export:</strong> Updated cell data with new PCIs</li>
          <li><strong>Nokia Configuration:</strong> Ready-to-use CLI commands for Nokia eNodeBs</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use Nokia configuration export to directly apply changes to your eNodeBs.</p>
      `
    }
  ],
  'sites': [
    {
      id: 'sites-1',
      title: '🏗️ Managing Sites',
      icon: '🏗️',
      content: `
        <h4>Site Management Overview</h4>
        <p>The Sites module lets you manage all your tower sites and locations:</p>
        <ul>
          <li><strong>View Sites:</strong> See all sites with filters for type and status</li>
          <li><strong>Edit Sites:</strong> Right-click or use the edit button to modify site details</li>
          <li><strong>Add Sectors:</strong> Add coverage sectors to sites</li>
          <li><strong>Add CPE:</strong> Add customer premises equipment</li>
          <li><strong>Add Backhauls:</strong> Create backhaul links between sites</li>
        </ul>
        <p><strong>💡 Tip:</strong> Sites are the foundation of your network - organize them well!</p>
      `
    },
    {
      id: 'sites-2',
      title: '📍 Site Location & Details',
      icon: '📍',
      content: `
        <h4>Site Information</h4>
        <p>Each site contains important information:</p>
        <ul>
          <li><strong>Location:</strong> GPS coordinates and address</li>
          <li><strong>Type:</strong> Tower, building, or other structure type</li>
          <li><strong>Status:</strong> Active, inactive, or maintenance</li>
          <li><strong>Contact:</strong> Site contact information</li>
          <li><strong>Equipment:</strong> Hardware deployed at the site</li>
        </ul>
        <p><strong>💡 Tip:</strong> Keep site information up-to-date for accurate network planning.</p>
      `
    },
    {
      id: 'sites-3',
      title: '📡 Adding Sectors & Equipment',
      icon: '📡',
      content: `
        <h4>Site Components</h4>
        <p>Enhance your sites with:</p>
        <ol>
          <li><strong>Sectors:</strong> Coverage areas with frequency bands</li>
          <li><strong>CPE Devices:</strong> Customer equipment at locations</li>
          <li><strong>Backhaul Links:</strong> Connections between sites</li>
        </ol>
        <p><strong>💡 Tip:</strong> Use the right-click menu on sites to quickly add components.</p>
      `
    }
  ],
  'customers': [
    {
      id: 'customers-1',
      title: '👥 Customers, Billing & Portal',
      icon: '👥',
      content: `
        <h4>Customers module</h4>
        <p>Manage customers, billing, and the <strong>Customer Portal</strong>:</p>
        <ul>
          <li><strong>Customers tab:</strong> Add and edit customers, view portal status</li>
          <li><strong>Billing tab:</strong> Service plans, billing, and usage</li>
          <li><strong>Portal tab:</strong> Enable the branded customer portal; set login, tickets, and help</li>
        </ul>
        <p><strong>Customer Portal</strong> – Customers can log in to view tickets, service info, and billing. Use <strong>Portal setup</strong> to configure branding and enable features.</p>
        <p><strong>💡 Tip:</strong> Use the <strong>📖 Docs</strong> icon on the dashboard for full documentation.</p>
      `
    },
    {
      id: 'customers-2',
      title: 'Customer records',
      icon: '📋',
      content: `
        <h4>Add/Edit customers</h4>
        <p>Customer records include <strong>service type</strong> (4G/5G, FWA, WiFi, Fiber), <strong>LTE auth</strong> (IMSI, Ki, OPc), <strong>MAC address</strong>, and <strong>QoS</strong>. Use the <strong>Customer Onboarding</strong> wizard from Quick access for guided setup.</p>
      `
    },
    {
      id: 'customers-3',
      title: 'Portal setup',
      icon: '🌐',
      content: `
        <h4>Branded customer portal</h4>
        <p>Enable in <strong>Customers → Portal setup</strong>. Configure logo and colors. Customers get <strong>Dashboard</strong>, <strong>Billing</strong>, <strong>Tickets</strong>, <strong>Knowledge base / FAQ</strong>. Use Settings for org-wide branding.</p>
      `
    },
    {
      id: 'customers-4',
      title: 'Billing',
      icon: '💰',
      content: `
        <h4>Customer billing</h4>
        <p>Billing modal per customer in Customers module; billing view in the customer portal. Billing cycles and invoicing can be extended when prioritized.</p>
      `
    }
  ],
  'user-management': [
    {
      id: 'user-mgmt-1',
      title: 'Inviting users',
      icon: '👥',
      content: `
        <h4>Add team members</h4>
        <p>Go to <strong>User Management</strong> → <strong>Invite User</strong>. Enter email, select role (Admin, Engineer, Installer, Help Desk, Viewer), click <strong>Send Invitation</strong>. User appears as Pending until they accept and login.</p>
      `
    },
    {
      id: 'user-mgmt-2',
      title: 'Editing user roles',
      icon: '✏️',
      content: `
        <h4>Change role</h4>
        <p>Click <strong>Edit</strong> next to the user → select new role → <strong>Update Role</strong>. Changes apply immediately. Owner role cannot be changed; only one owner per organization.</p>
      `
    },
    {
      id: 'user-mgmt-3',
      title: 'Suspending users',
      icon: '⏸️',
      content: `
        <h4>Temporarily disable access</h4>
        <p>Edit user → <strong>Suspend User</strong>. User can still login but API calls fail. To re-enable: <strong>Activate User</strong>.</p>
      `
    },
    {
      id: 'user-mgmt-4',
      title: 'Removing users',
      icon: '🗑️',
      content: `
        <h4>Remove from organization</h4>
        <p>Edit user → <strong>Remove from Organization</strong> → confirm. Cannot be undone. Cannot remove the owner; transfer ownership first.</p>
      `
    },
    {
      id: 'user-mgmt-5',
      title: 'Module access',
      icon: '🔐',
      content: `
        <h4>Configure per-role access</h4>
        <p><strong>Settings → Module Access</strong>. See roles vs. modules matrix; check/uncheck to enable or disable modules per role. Save Configuration. Use reset to restore default permissions for a role.</p>
      `
    }
  ],
  'maintain': [
    {
      id: 'maintain-1',
      title: '🎫 Help Desk & Tickets',
      icon: '🎫',
      content: `
        <h4>Managing Support Tickets</h4>
        <p>The Maintain module helps you manage customer support and maintenance:</p>
        <ul>
          <li><strong>Create Tickets:</strong> Click "Create Ticket" to open a new support request</li>
          <li><strong>View Tickets:</strong> See all tickets with filters for status and priority</li>
          <li><strong>Update Status:</strong> Change ticket status as you work on issues</li>
          <li><strong>Customer Lookup:</strong> Quickly find customer information</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use the filters to quickly find tickets by status, priority, or search term. Customer Portal users can submit tickets from their portal.</p>
      `
    },
    {
      id: 'maintain-create-ticket',
      title: 'Creating support tickets',
      icon: '📝',
      content: `
        <h4>New ticket</h4>
        <p>Click <strong>Create Ticket</strong>. Enter <strong>Title</strong>, <strong>Type</strong> (Troubleshoot, Repair, Installation, Other), <strong>Priority</strong>, <strong>Description</strong>, and optional <strong>Customer</strong>. Click Create Ticket.</p>
      `
    },
    {
      id: 'maintain-assign-ticket',
      title: 'Assigning tickets',
      icon: '👤',
      content: `
        <h4>Assign to technician</h4>
        <p>Open ticket details → <strong>Assign</strong> → select field technician. Technician receives a push notification on the mobile app.</p>
      `
    },
    {
      id: 'maintain-filters',
      title: 'Filtering tickets',
      icon: '🔍',
      content: `
        <h4>Find tickets</h4>
        <p>Filter by <strong>Status</strong> (Open, Assigned, In Progress, Resolved, Closed), <strong>Priority</strong> (Critical–Low), or <strong>Search</strong> by ticket number, title, or customer name.</p>
      `
    },
    {
      id: 'maintain-customer-lookup',
      title: 'Customer lookup',
      icon: '🔎',
      content: `
        <h4>Find customer</h4>
        <p>Click <strong>Customer Lookup</strong>. Search by phone, email, or IMSI. View customer info, service status, active equipment, and recent tickets.</p>
      `
    },
    {
      id: 'maintain-work-order-create',
      title: 'Creating work orders',
      icon: '📋',
      content: `
        <h4>New work order</h4>
        <p>From Work Orders or Help Desk → <strong>Create Work Order</strong>. Fill <strong>Title</strong>, <strong>Type</strong> (Installation, Repair, Maintenance), <strong>Priority</strong>, <strong>Site</strong>, <strong>Customer</strong>, <strong>Description</strong>. Click Create.</p>
      `
    },
    {
      id: 'maintain-work-order-assign',
      title: 'Assigning work orders',
      icon: '📲',
      content: `
        <h4>Send to field</h4>
        <p>Open work order → <strong>Assign</strong> → select field technician. Technician gets a push notification; status becomes Assigned.</p>
      `
    },
    {
      id: 'maintain-mobile-workflow',
      title: 'Mobile app workflow',
      icon: '📱',
      content: `
        <h4>Field technician flow</h4>
        <p>Technician gets push → opens app → views work order → navigates via GPS → completes work → sets status to Resolved → adds notes and photos.</p>
      `
    },
    {
      id: 'maintain-2',
      title: '👥 Customer Management',
      icon: '👥',
      content: `
        <h4>Customer Information</h4>
        <p>Manage customer data in the Customers tab:</p>
        <ul>
          <li><strong>View Customers:</strong> See all customers with contact information</li>
          <li><strong>Add Customers:</strong> Create new customer records</li>
          <li><strong>Edit Customers:</strong> Update customer information</li>
          <li><strong>Search:</strong> Find customers by name, email, or phone</li>
        </ul>
        <p><strong>💡 Tip:</strong> Keep customer information up-to-date for better support.</p>
      `
    },
    {
      id: 'maintain-3',
      title: '🔧 Maintenance Scheduling',
      icon: '🔧',
      content: `
        <h4>Scheduled Maintenance</h4>
        <p>Plan and track maintenance activities:</p>
        <ul>
          <li><strong>Schedule Maintenance:</strong> Plan regular maintenance tasks</li>
          <li><strong>Track Progress:</strong> Monitor maintenance completion</li>
          <li><strong>View History:</strong> See past maintenance activities</li>
        </ul>
        <p><strong>💡 Tip:</strong> Regular maintenance helps prevent issues before they occur.</p>
      `
    }
  ],
  'acs-cpe-management': [
    {
      id: 'acs-1',
      title: 'ACS CPE overview',
      icon: '📡',
      content: `
        <h4>TR-069 CPE management</h4>
        <p>Manage CPE devices via GenieACS: device discovery, GPS map, real-time status, parameter read/write, presets, and fault management. Check <strong>Administration → Service Status</strong> (CWMP 7547, NBI 7557, etc.).</p>
      `
    },
    {
      id: 'acs-2',
      title: 'Configuring CPE for ACS',
      icon: '⚙️',
      content: `
        <h4>Point CPE to ACS</h4>
        <p>Set CPE ACS URL to <code>https://your-app.web.app/cwmp</code>. Devices appear after initial inform. <code>/cwmp</code> proxies to GenieACS CWMP (port 7547).</p>
      `
    },
    {
      id: 'acs-3',
      title: 'Map view',
      icon: '🗺️',
      content: `
        <h4>GPS devices on map</h4>
        <p><strong>Green</strong> – online; <strong>Red</strong> – offline. Click marker for device details; performance icon opens full modal. Use zoom, pan, basemap switch, Auto-Fit.</p>
      `
    },
    {
      id: 'acs-4',
      title: 'Preset management',
      icon: '📋',
      content: `
        <h4>Configuration templates</h4>
        <p>Go to <strong>/modules/acs-cpe-management/presets</strong>. Create presets, use parameter editor, link/unlink customers. Apply presets to devices for consistent config.</p>
      `
    },
    {
      id: 'acs-5',
      title: 'Diagnostics & reboot',
      icon: '🔧',
      content: `
        <h4>Device actions</h4>
        <p>From device details: <strong>Diagnostics</strong>, <strong>Reboot</strong>, <strong>Refresh</strong>. Use for troubleshooting and remote management.</p>
      `
    },
    {
      id: 'acs-6',
      title: 'Fault management',
      icon: '🚨',
      content: `
        <h4>Device faults</h4>
        <p>Track and acknowledge device faults. View fault list and clear or acknowledge as needed.</p>
      `
    }
  ]
};

/**
 * Get tips for a specific module
 */
export function getModuleTips(moduleId: string): ModuleTip[] {
  return moduleTips[moduleId] || [];
}

/**
 * Get module ID from route path
 */
export function getModuleIdFromPath(path: string): string | null {
  const moduleMatch = path.match(/\/modules\/([^\/]+)/);
  if (moduleMatch) {
    return moduleMatch[1];
  }
  return null;
}
