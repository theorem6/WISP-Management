<script lang="ts">
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  interface LinkCard {
    title: string;
    description: string;
    href: string;
    hint: string;
  }

  const links: LinkCard[] = [
    {
      title: 'Customers',
      description: 'Browse Alex Rivera, Jordan Chen, and the sample lead.',
      href: '/modules/customers',
      hint: 'Try edit / search — data is real MongoDB.'
    },
    {
      title: 'Work orders',
      description: 'Open TKT-DEMO-001 and TKT-DEMO-002.',
      href: '/modules/work-orders',
      hint: 'Status and assignment update through the API.'
    },
    {
      title: 'Maintain (incidents)',
      description: 'INC-DEMO-001 and INC-DEMO-002 under Incidents.',
      href: '/modules/maintain',
      hint: 'Switch to the Incidents tab after opening.'
    },
    {
      title: 'Inventory',
      description: 'Warehouse spare and deployed CPE demo rows.',
      href: '/modules/inventory',
      hint: 'Filter by serial DEMO-SN-*'
    },
    {
      title: 'Monitoring',
      description: 'Dashboard shell (live metrics may be empty on demo).',
      href: '/modules/monitoring',
      hint: 'Use after SNMP/ping agents if configured.'
    },
    {
      title: 'Dashboard',
      description: 'Return to the main module grid.',
      href: '/dashboard',
      hint: ''
    }
  ];
</script>

<svelte:head>
  <title>Demo hub — WISPTools</title>
</svelte:head>

<TenantGuard requireTenant={true}>
  <div class="wrap">
    <header class="hero">
      <h1>Demo walkthrough</h1>
      <p class="lead">
        Seeded records use prefixes <code>CUST-DEMO-*</code>, <code>TKT-DEMO-*</code>,
        <code>INC-DEMO-*</code>, <code>DEMO-SN-*</code>. Explore and edit — data is stored in your demo
        MongoDB.
      </p>
      {#if $currentTenant}
        <p class="tenant">
          Organization: <strong>{$currentTenant.displayName}</strong>
          <span class="muted">({$currentTenant.id})</span>
        </p>
      {/if}
    </header>

    <div class="grid">
      {#each links as item}
        <a class="card" href={item.href}>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          {#if item.hint}
            <span class="hint">{item.hint}</span>
          {/if}
        </a>
      {/each}
    </div>

    <section class="doc">
      <h2>Documentation</h2>
      <ul>
        <li>
          Seed &amp; env:
          <code>scripts/demo/README.md</code>
        </li>
        <li>
          Deploy:
          <code>docs/deployment/DEMO_SITE.md</code>
        </li>
      </ul>
    </section>
  </div>
</TenantGuard>

<style>
  .wrap {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
  }
  .hero h1 {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    color: var(--text-primary, #0f172a);
  }
  .lead {
    margin: 0 0 1rem;
    line-height: 1.55;
    color: var(--text-secondary, #475569);
    font-size: 0.95rem;
  }
  .lead code {
    font-size: 0.85em;
    padding: 0.1em 0.35em;
    background: var(--bg-secondary, #f1f5f9);
    border-radius: 4px;
  }
  .tenant {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary, #475569);
  }
  .tenant .muted {
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .card {
    display: block;
    padding: 1.1rem 1.15rem;
    border-radius: 10px;
    border: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-primary, #fff);
    text-decoration: none;
    color: inherit;
    transition:
      box-shadow 0.15s ease,
      border-color 0.15s ease;
  }
  .card:hover {
    border-color: var(--brand-primary, #2563eb);
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
  }
  .card h2 {
    margin: 0 0 0.4rem;
    font-size: 1.05rem;
    color: var(--text-primary, #0f172a);
  }
  .card p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--text-secondary, #64748b);
  }
  .hint {
    display: block;
    margin-top: 0.65rem;
    font-size: 0.75rem;
    color: var(--text-tertiary, #94a3b8);
  }
  .doc {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color, #e2e8f0);
  }
  .doc h2 {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  .doc ul {
    margin: 0;
    padding-left: 1.2rem;
    color: var(--text-secondary, #475569);
    font-size: 0.9rem;
  }
  .doc code {
    font-size: 0.85em;
  }
</style>
