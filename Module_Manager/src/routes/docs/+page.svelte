<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Documentation – WISP Management</title>
</svelte:head>

<h1>WISP Management Documentation</h1>
<p class="lead">Documentation is integrated into the app. Use the sidebar or the links below.</p>

<section class="doc-section">
  <h2>Quick links</h2>
  <ul>
    <li><a href="/help">Getting Started</a> – New users and administrators.</li>
    <li><a href="/help">Using WISP Management</a> – For end users: dashboard, wizards, help.</li>
    <li><a href="/help">Project Status & Next Steps</a> – Current status and what to work on next.</li>
    <li><a href="/help">Help by topic</a> – Module-specific help (Inventory, ACS, Deploy, Plan, etc.).</li>
    <li><a href="/wizards">Wizards</a> – Guided flows (sites, subscribers, customers, RMA, plans, groups, troubleshooting).</li>
  </ul>
</section>

<section class="doc-section">
  <h2>What is WISP Management?</h2>
  <p>WISP Management is the main app on wisptools.io for LTE WISP operations:</p>
  <ul>
    <li><strong>Multi-tenant</strong> – Manage multiple organizations</li>
    <li><strong>HSS</strong> – Home Subscriber Server for Open5GS</li>
    <li><strong>Device management</strong> – TR-069/CWMP via GenieACS</li>
    <li><strong>Network planning</strong> – Coverage mapping, PCI resolution</li>
    <li><strong>Monitoring</strong> – SNMP and performance graphs</li>
    <li><strong>CBRS/SAS</strong> – Spectrum Access System integration</li>
  </ul>
</section>

<section class="doc-section">
  <h2>In-app help</h2>
  <p>Each module (Inventory, Deploy, ACS CPE, HSS, Plan, Coverage Map, CBRS, PCI Resolution, Monitoring) has a <strong>Help</strong> button that opens module-specific documentation. The <a href="/help">Help by topic</a> page lists all topics in one place. For reference and project status, use the sidebar or <a href="/docs/reference/project-status">Project Status &amp; Next Steps</a>.</p>
</section>
