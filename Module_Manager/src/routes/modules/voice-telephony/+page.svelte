<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import ModuleWizardMenu from '$lib/components/wizards/ModuleWizardMenu.svelte';
  import { getWizardsForPath } from '$lib/config/wizardCatalog';
  import TipsModal from '$lib/components/modals/TipsModal.svelte';
  import { getModuleTips } from '$lib/config/moduleTips';
  import {
    voiceService,
    type VoiceDomainSchema,
    type VoiceProviderAccount,
    type VoiceTelephoneNumber,
    type VoicePortOrder,
    type VoiceServiceLocation
  } from '$lib/services/voiceService';

  type Tab = 'overview' | 'accounts' | 'numbers' | 'ports' | 'locations';

  let activeTab: Tab = 'overview';
  let loading = true;
  let error = '';

  let schema: VoiceDomainSchema | null = null;
  let accounts: VoiceProviderAccount[] = [];
  let numbers: VoiceTelephoneNumber[] = [];
  let portOrders: VoicePortOrder[] = [];
  let locations: VoiceServiceLocation[] = [];

  let showAddAccount = false;
  let newAccount = { provider: 'twilio' as const, externalAccountId: '', displayName: '', credentialRef: '' };
  let savingAccount = false;

  let showAddTn = false;
  let savingTn = false;
  let newTn = {
    e164: '',
    status: 'inventory' as 'inventory' | 'assigned' | 'suspended',
    voiceProviderAccountId: '',
    providerTnId: '',
    rateCenter: '',
    lata: '',
    emergencyAddressId: '',
    customerId: ''
  };

  let showEditTn = false;
  let savingEditTn = false;
  let editTn: {
    _id: string;
    e164: string;
    status: string;
    customerId: string;
    rateCenter: string;
    lata: string;
    providerTnId: string;
  } | null = null;

  let showAddLocation = false;
  let savingLoc = false;
  let newLoc = {
    customerId: '',
    street: '',
    unit: '',
    city: '',
    state: '',
    postal: '',
    country: 'US',
    latitudeStr: '',
    longitudeStr: '',
    geocodeAccuracyMStr: '',
    geocodeSource: '',
    geocodeLocatorName: '',
    geocodeScoreStr: ''
  };

  let showTipsModal = false;
  const tips = getModuleTips('voice-telephony');

  $: tenantId = $currentTenant?.id || '';
  /** When set (e.g. from Customers module), filters TNs and service locations */
  $: filterCustomerId = $page.url.searchParams.get('customerId')?.trim() || '';

  async function loadAll() {
    if (!browser || !tenantId) return;
    loading = true;
    error = '';
    try {
      const cust = filterCustomerId ? { customerId: filterCustomerId } : undefined;
      const [s, a, n, p, locs] = await Promise.all([
        voiceService.fetchSchema(),
        voiceService.listProviderAccounts().catch(() => []),
        voiceService.listTelephoneNumbers(cust).catch(() => []),
        voiceService.listPortOrders().catch(() => []),
        voiceService.listServiceLocations(cust).catch(() => [])
      ]);
      schema = s;
      accounts = a;
      numbers = n;
      portOrders = p;
      locations = locs;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load voice data';
    } finally {
      loading = false;
    }
  }

  $: if (browser && tenantId) {
    filterCustomerId;
    void loadAll();
  }

  function openAddTn() {
    newTn = {
      e164: '',
      status: 'inventory',
      voiceProviderAccountId: accounts[0]?._id ?? '',
      providerTnId: '',
      rateCenter: '',
      lata: '',
      emergencyAddressId: '',
      customerId: filterCustomerId
    };
    showAddTn = true;
  }

  async function submitTn() {
    if (!newTn.voiceProviderAccountId || !newTn.e164.trim()) return;
    savingTn = true;
    error = '';
    try {
      await voiceService.createTelephoneNumber({
        e164: newTn.e164.trim(),
        status: newTn.status,
        voiceProviderAccountId: newTn.voiceProviderAccountId,
        providerTnId: newTn.providerTnId.trim() || undefined,
        rateCenter: newTn.rateCenter.trim() || undefined,
        lata: newTn.lata.trim() || undefined,
        emergencyAddressId: newTn.emergencyAddressId.trim() || undefined,
        customerId: newTn.customerId.trim() || undefined
      });
      showAddTn = false;
      await loadAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create number';
    } finally {
      savingTn = false;
    }
  }

  function openEditTn(n: VoiceTelephoneNumber) {
    editTn = {
      _id: n._id,
      e164: n.e164,
      status: n.status,
      customerId: n.customerId ?? '',
      rateCenter: n.rateCenter ?? '',
      lata: n.lata ?? '',
      providerTnId: n.providerTnId ?? ''
    };
    showEditTn = true;
  }

  async function submitEditTn() {
    if (!editTn) return;
    savingEditTn = true;
    error = '';
    try {
      await voiceService.patchTelephoneNumber(editTn._id, {
        status: editTn.status,
        customerId: editTn.customerId.trim() ? editTn.customerId.trim() : null,
        rateCenter: editTn.rateCenter.trim() || undefined,
        lata: editTn.lata.trim() || undefined,
        providerTnId: editTn.providerTnId.trim() || undefined
      });
      showEditTn = false;
      editTn = null;
      await loadAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update number';
    } finally {
      savingEditTn = false;
    }
  }

  function openAddLocation() {
    newLoc = {
      customerId: filterCustomerId,
      street: '',
      unit: '',
      city: '',
      state: '',
      postal: '',
      country: 'US',
      latitudeStr: '',
      longitudeStr: '',
      geocodeAccuracyMStr: '',
      geocodeSource: '',
      geocodeLocatorName: '',
      geocodeScoreStr: ''
    };
    showAddLocation = true;
  }

  function parseOptionalFloat(s: string): number | undefined {
    const t = s.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }

  async function submitLocation() {
    savingLoc = true;
    error = '';
    try {
      await voiceService.createServiceLocation({
        customerId: newLoc.customerId.trim() || undefined,
        street: newLoc.street.trim() || undefined,
        unit: newLoc.unit.trim() || undefined,
        city: newLoc.city.trim() || undefined,
        state: newLoc.state.trim() || undefined,
        postal: newLoc.postal.trim() || undefined,
        country: newLoc.country.trim() || undefined,
        latitude: parseOptionalFloat(newLoc.latitudeStr),
        longitude: parseOptionalFloat(newLoc.longitudeStr),
        geocodeAccuracyM: parseOptionalFloat(newLoc.geocodeAccuracyMStr),
        geocodeSource: newLoc.geocodeSource.trim() || undefined,
        geocodeLocatorName: newLoc.geocodeLocatorName.trim() || undefined,
        geocodeScore: parseOptionalFloat(newLoc.geocodeScoreStr)
      });
      showAddLocation = false;
      await loadAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create location';
    } finally {
      savingLoc = false;
    }
  }

  async function submitAccount() {
    savingAccount = true;
    error = '';
    try {
      await voiceService.createProviderAccount({
        provider: newAccount.provider,
        externalAccountId: newAccount.externalAccountId,
        displayName: newAccount.displayName || undefined,
        credentialRef: newAccount.credentialRef || undefined
      });
      showAddAccount = false;
      newAccount = { provider: 'twilio', externalAccountId: '', displayName: '', credentialRef: '' };
      await loadAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Save failed';
    } finally {
      savingAccount = false;
    }
  }

  function onWizardSelect(event: CustomEvent<{ id: string }>) {
    if (event.detail.id === 'voice-sip-overview') {
      showTipsModal = true;
    }
  }
</script>

<TenantGuard>
  <div class="voice-page">
    <header class="page-head">
      <div class="page-head-row">
        <h1>Voice / SIP & UC</h1>
        <div class="page-toolbar">
          <ModuleWizardMenu wizards={getWizardsForPath('/modules/voice-telephony')} on:select={onWizardSelect} />
          <button type="button" class="btn tips-btn" on:click={() => (showTipsModal = true)}>Tips</button>
        </div>
      </div>
      <p class="sub">
        Tenant-scoped numbers, carrier accounts, E911, and porting. Webhook ingress:
        <code>POST /api/voice/webhooks/:provider</code> (HMAC when <code>VOICE_WEBHOOK_SECRET</code> is set).
        Customer records link via <code>customerId</code> (same id as Customers module).
      </p>
    </header>

    <TipsModal bind:show={showTipsModal} moduleId="voice-telephony" {tips} on:close={() => (showTipsModal = false)} />

    {#if filterCustomerId}
      <div class="filter-banner" role="status">
        Filtered for customer <code>{filterCustomerId}</code> (from Customers or URL).
        <button type="button" class="linkish" on:click={() => goto('/modules/voice-telephony')}>Show all</button>
      </div>
    {/if}

    {#if error}
      <div class="alert err" role="alert">{error}</div>
    {/if}

    <nav class="tabs">
      <button type="button" class:active={activeTab === 'overview'} on:click={() => (activeTab = 'overview')}>Overview</button>
      <button type="button" class:active={activeTab === 'accounts'} on:click={() => (activeTab = 'accounts')}>Provider accounts</button>
      <button type="button" class:active={activeTab === 'numbers'} on:click={() => (activeTab = 'numbers')}>Numbers</button>
      <button type="button" class:active={activeTab === 'ports'} on:click={() => (activeTab = 'ports')}>Port orders</button>
      <button type="button" class:active={activeTab === 'locations'} on:click={() => (activeTab = 'locations')}>Service locations</button>
    </nav>

    {#if loading}
      <p class="muted">Loading…</p>
    {:else if activeTab === 'overview' && schema}
      <section class="panel">
        <h2>Bounded contexts</h2>
        <ul class="ctx-list">
          {#each schema.bounded_contexts as bc}
            <li>
              <strong>{bc.label}</strong>
              <span class="muted">({bc.id})</span> — {bc.entities.join(', ')}
            </li>
          {/each}
        </ul>

        <h2>State machines</h2>
        {#each Object.entries(schema.state_machines) as [k, v]}
          {#if k === 'notes'}
            <ul class="notes">
              {#each (Array.isArray(v) ? v : []) as n}<li>{n}</li>{/each}
            </ul>
          {:else}
            <p class="sm-key">{k}</p>
            <ul class="inline">
              {#each (Array.isArray(v) ? v : []) as x}<li><code>{x}</code></li>{/each}
            </ul>
          {/if}
        {/each}

        <h2>Carrier comparison</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Bandwidth</th>
                <th>Telnyx</th>
                <th>Twilio</th>
              </tr>
            </thead>
            <tbody>
              {#each schema.carrier_comparison as row}
                <tr>
                  <td>{row.dimension}</td>
                  <td>{row.bandwidth}</td>
                  <td>{row.telnyx}</td>
                  <td>{row.twilio}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="muted">{schema.pragmatic_recommendation}</p>

        <h2>ArcGIS</h2>
        <p class="muted">{schema.arcgis.note}</p>
        <ul>
          {#each schema.arcgis.uses as u}<li>{u}</li>{/each}
        </ul>

        <h2>Phased rollout</h2>
        <ol>
          {#each schema.phased_rollout as ph}<li><strong>Phase {ph.phase}</strong> — {ph.scope}</li>{/each}
        </ol>
      </section>
    {:else if activeTab === 'accounts'}
      <section class="panel">
        <div class="row">
          <h2>Voice provider accounts</h2>
          <button type="button" class="btn primary" on:click={() => (showAddAccount = true)}>Add account</button>
        </div>
        {#if accounts.length === 0}
          <p class="muted">No provider accounts yet. Add one to represent your Bandwidth site, Twilio subaccount, or Telnyx connection.</p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>External account ID</th>
                  <th>Display name</th>
                  <th>Credential ref</th>
                </tr>
              </thead>
              <tbody>
                {#each accounts as a}
                  <tr>
                    <td><code>{a.provider}</code></td>
                    <td>{a.externalAccountId}</td>
                    <td>{a.displayName || '—'}</td>
                    <td>{a.credentialRef ? '••••' : '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'numbers'}
      <section class="panel">
        <div class="row">
          <h2>Telephone numbers</h2>
          <button
            type="button"
            class="btn primary"
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Add a provider account first' : ''}
            on:click={openAddTn}
          >
            Add number
          </button>
        </div>
        {#if accounts.length === 0}
          <p class="muted">Add a voice provider account on the <strong>Provider accounts</strong> tab before creating numbers.</p>
        {:else if numbers.length === 0}
          <p class="muted">No numbers yet. Add one above or import from your carrier later.</p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>E.164</th>
                  <th>Status</th>
                  <th>911</th>
                  {#if !filterCustomerId}
                    <th>Customer</th>
                  {/if}
                  <th>Rate center</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each numbers as n}
                  <tr>
                    <td><code>{n.e164}</code></td>
                    <td>{n.status}</td>
                    <td title="From linked emergency address">{n.e911Display ?? '—'}</td>
                    {#if !filterCustomerId}
                      <td>
                        {#if n.customerId}
                          <a href="/modules/voice-telephony?customerId={encodeURIComponent(n.customerId)}" class="map-link">{n.customerId}</a>
                        {:else}
                          —
                        {/if}
                      </td>
                    {/if}
                    <td>{n.rateCenter || '—'}</td>
                    <td>
                      <button type="button" class="btn sm" on:click={() => openEditTn(n)}>Edit</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'ports'}
      <section class="panel">
        <h2>Port orders (LNP)</h2>
        {#if portOrders.length === 0}
          <p class="muted">No port orders yet.</p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>TNs</th>
                  <th>Losing carrier</th>
                  <th>FOC target</th>
                </tr>
              </thead>
              <tbody>
                {#each portOrders as o}
                  <tr>
                    <td><code>{o.status}</code></td>
                    <td>{(o.telephoneNumbersE164 || []).join(', ') || '—'}</td>
                    <td>{o.losingCarrierName || '—'}</td>
                    <td>{o.focTargetDate || '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'locations'}
      <section class="panel">
        <div class="row">
          <h2>Service locations (E911 / geocode)</h2>
          <button type="button" class="btn primary" on:click={openAddLocation}>Add location</button>
        </div>
        <p class="muted small">
          Use the same <code>customerId</code> as the Customers module to tie addresses together. Coverage Map opens centered on
          coordinates when available.
        </p>
        {#if locations.length === 0}
          <p class="muted">No service locations yet. Add one above.</p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Customer</th>
                  <th>Geocode</th>
                  <th>Map</th>
                </tr>
              </thead>
              <tbody>
                {#each locations as loc}
                  <tr>
                    <td>{[loc.street, loc.unit, loc.city, loc.state, loc.postal].filter(Boolean).join(', ') || '—'}</td>
                    <td>
                      {#if loc.customerId}
                        <a href="/modules/voice-telephony?customerId={encodeURIComponent(loc.customerId)}" class="map-link">{loc.customerId}</a>
                      {:else}
                        —
                      {/if}
                    </td>
                    <td>
                      {loc.geocodeSource || '—'}{#if loc.geocodeScore != null}
                        (score {loc.geocodeScore}){/if}
                    </td>
                    <td>
                      {#if loc.latitude != null && loc.longitude != null}
                        <a
                          class="map-link"
                          href="/modules/coverage-map?focusLat={loc.latitude}&focusLng={loc.longitude}"
                        >
                          Coverage map
                        </a>
                      {:else}
                        —
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}
  </div>

  {#if showAddAccount}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add provider account">
      <div class="modal card">
        <h3>Add voice provider account</h3>
        <label for="va-provider">Provider</label>
        <select id="va-provider" bind:value={newAccount.provider}>
          <option value="twilio">Twilio</option>
          <option value="telnyx">Telnyx</option>
          <option value="bandwidth">Bandwidth</option>
        </select>
        <label for="va-ext">External account ID</label>
        <input id="va-ext" type="text" bind:value={newAccount.externalAccountId} placeholder="Subaccount SID, site ID, etc." />
        <label for="va-name">Display name</label>
        <input id="va-name" type="text" bind:value={newAccount.displayName} />
        <label for="va-cred">Credential ref (KMS / secret name — never paste secrets)</label>
        <input id="va-cred" type="text" bind:value={newAccount.credentialRef} placeholder="Optional" />
        <div class="modal-actions">
          <button type="button" class="btn" on:click={() => (showAddAccount = false)}>Cancel</button>
          <button type="button" class="btn primary" disabled={savingAccount || !newAccount.externalAccountId.trim()} on:click={submitAccount}>
            {savingAccount ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showAddTn}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add telephone number">
      <div class="modal card wide">
        <h3>Add telephone number</h3>
        <label for="tn-e164">E.164</label>
        <input id="tn-e164" type="text" bind:value={newTn.e164} placeholder="+15551234567" autocomplete="tel" />
        <label for="tn-status">Status</label>
        <select id="tn-status" bind:value={newTn.status}>
          <option value="inventory">inventory</option>
          <option value="assigned">assigned</option>
          <option value="suspended">suspended</option>
        </select>
        <label for="tn-acct">Voice provider account</label>
        <select id="tn-acct" bind:value={newTn.voiceProviderAccountId}>
          {#each accounts as a}
            <option value={a._id}>{a.provider} — {a.displayName || a.externalAccountId}</option>
          {/each}
        </select>
        <label for="tn-prov">Provider TN ID (optional)</label>
        <input id="tn-prov" type="text" bind:value={newTn.providerTnId} placeholder="Carrier-side ID" />
        <label for="tn-rc">Rate center / LATA (optional)</label>
        <div class="grid-2">
          <input id="tn-rc" type="text" bind:value={newTn.rateCenter} placeholder="Rate center" />
          <input id="tn-lata" type="text" bind:value={newTn.lata} placeholder="LATA" />
        </div>
        <label for="tn-e911">Emergency address ID (optional)</label>
        <input id="tn-e911" type="text" bind:value={newTn.emergencyAddressId} placeholder="Mongo ObjectId after E911 is provisioned" />
        <label for="tn-cust">Customer ID (optional)</label>
        <input id="tn-cust" type="text" bind:value={newTn.customerId} placeholder="Same as Customers module, e.g. CUST-2025-001" />
        <div class="modal-actions">
          <button type="button" class="btn" on:click={() => (showAddTn = false)}>Cancel</button>
          <button
            type="button"
            class="btn primary"
            disabled={savingTn || !newTn.e164.trim() || !newTn.voiceProviderAccountId}
            on:click={submitTn}
          >
            {savingTn ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showEditTn && editTn}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit telephone number">
      <div class="modal card wide">
        <h3>Edit <code>{editTn.e164}</code></h3>
        <label for="etn-status">Status</label>
        <select id="etn-status" bind:value={editTn.status}>
          <option value="inventory">inventory</option>
          <option value="assigned">assigned</option>
          <option value="suspended">suspended</option>
        </select>
        <label for="etn-cust">Customer ID</label>
        <input id="etn-cust" type="text" bind:value={editTn.customerId} placeholder="Leave empty to clear" />
        <label for="etn-rc">Rate center / LATA</label>
        <div class="grid-2">
          <input id="etn-rc" type="text" bind:value={editTn.rateCenter} placeholder="Rate center" />
          <input id="etn-lata" type="text" bind:value={editTn.lata} placeholder="LATA" />
        </div>
        <label for="etn-prov">Provider TN ID</label>
        <input id="etn-prov" type="text" bind:value={editTn.providerTnId} />
        <div class="modal-actions">
          <button
            type="button"
            class="btn"
            on:click={() => {
              showEditTn = false;
              editTn = null;
            }}>Cancel</button>
          <button type="button" class="btn primary" disabled={savingEditTn} on:click={submitEditTn}>
            {savingEditTn ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showAddLocation}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add service location">
      <div class="modal card wide">
        <h3>Add service location</h3>
        <label for="sl-cust">Customer ID (optional)</label>
        <input id="sl-cust" type="text" bind:value={newLoc.customerId} placeholder="Same as Customers module" />
        <label for="sl-street">Street</label>
        <input id="sl-street" type="text" bind:value={newLoc.street} />
        <label for="sl-unit">Unit (optional)</label>
        <input id="sl-unit" type="text" bind:value={newLoc.unit} />
        <div class="grid-2">
          <div>
            <label for="sl-city">City</label>
            <input id="sl-city" type="text" bind:value={newLoc.city} />
          </div>
          <div>
            <label for="sl-state">State</label>
            <input id="sl-state" type="text" bind:value={newLoc.state} maxlength="2" placeholder="TX" />
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label for="sl-postal">Postal</label>
            <input id="sl-postal" type="text" bind:value={newLoc.postal} />
          </div>
          <div>
            <label for="sl-country">Country</label>
            <input id="sl-country" type="text" bind:value={newLoc.country} />
          </div>
        </div>
        <p class="muted small">Coordinates (optional — enables Coverage map link)</p>
        <div class="grid-2">
          <div>
            <label for="sl-lat">Latitude</label>
            <input id="sl-lat" type="text" bind:value={newLoc.latitudeStr} placeholder="e.g. 32.7767" />
          </div>
          <div>
            <label for="sl-lng">Longitude</label>
            <input id="sl-lng" type="text" bind:value={newLoc.longitudeStr} placeholder="e.g. -96.7970" />
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label for="sl-acc">Geocode accuracy (m)</label>
            <input id="sl-acc" type="text" bind:value={newLoc.geocodeAccuracyMStr} />
          </div>
          <div>
            <label for="sl-score">Geocode score</label>
            <input id="sl-score" type="text" bind:value={newLoc.geocodeScoreStr} />
          </div>
        </div>
        <label for="sl-src">Geocode source</label>
        <input id="sl-src" type="text" bind:value={newLoc.geocodeSource} placeholder="e.g. arcgis" />
        <label for="sl-locname">Locator name</label>
        <input id="sl-locname" type="text" bind:value={newLoc.geocodeLocatorName} />
        <div class="modal-actions">
          <button type="button" class="btn" on:click={() => (showAddLocation = false)}>Cancel</button>
          <button type="button" class="btn primary" disabled={savingLoc} on:click={submitLocation}>
            {savingLoc ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</TenantGuard>

<style>
  .voice-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem;
  }
  .page-head-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .page-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tips-btn {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-surface, #fff);
    cursor: pointer;
    font-size: 0.9rem;
  }
  .page-head h1 {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
  }
  .sub {
    color: var(--color-text-secondary, #64748b);
    font-size: 0.9rem;
    margin: 0 0 1rem;
  }
  .filter-banner {
    background: rgba(14, 165, 233, 0.12);
    border: 1px solid rgba(14, 165, 233, 0.35);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .linkish {
    margin-left: 0.75rem;
    background: none;
    border: none;
    color: var(--primary, #0ea5e9);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
  }
  .small {
    font-size: 0.85rem;
  }
  .map-link {
    color: var(--primary, #0ea5e9);
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .tabs button {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-surface, #fff);
    cursor: pointer;
  }
  .tabs button.active {
    border-color: var(--primary, #0ea5e9);
    background: rgba(14, 165, 233, 0.1);
  }
  .panel h2 {
    font-size: 1.1rem;
    margin-top: 1.25rem;
  }
  .panel h2:first-child {
    margin-top: 0;
  }
  .ctx-list {
    padding-left: 1.2rem;
  }
  .muted {
    color: var(--color-text-secondary, #64748b);
  }
  .notes {
    color: var(--color-warning-text, #92400e);
  }
  .sm-key {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  .inline {
    list-style: none;
    padding: 0;
    margin: 0 0 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th,
  td {
    border: 1px solid var(--color-border, #e2e8f0);
    padding: 0.5rem 0.65rem;
    text-align: left;
  }
  th {
    background: var(--color-background-secondary, #f8fafc);
  }
  .alert.err {
    background: #fef2f2;
    color: #991b1b;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .btn {
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-surface, #fff);
    cursor: pointer;
  }
  .btn.sm {
    padding: 0.3rem 0.55rem;
    font-size: 0.85rem;
  }
  .btn.primary {
    background: var(--primary, #0ea5e9);
    color: #fff;
    border-color: transparent;
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .modal.card {
    background: var(--color-surface, #fff);
    border-radius: 8px;
    padding: 1.25rem;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  }
  .modal.card.wide {
    max-width: 520px;
    max-height: min(90vh, 720px);
    overflow-y: auto;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 520px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
  .modal.card label {
    display: block;
    font-size: 0.85rem;
    margin-top: 0.75rem;
    margin-bottom: 0.25rem;
  }
  .modal.card input,
  .modal.card select {
    width: 100%;
    padding: 0.45rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--color-border, #e2e8f0);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
