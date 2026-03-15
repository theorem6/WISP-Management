<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import FirstTimeSetupWizard from '$lib/components/wizards/FirstTimeSetupWizard.svelte';

  let showWizard = false;

  onMount(() => {
    if (!browser) {
      return;
    }

    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    const tenantSetupCompleted = localStorage.getItem('tenantSetupCompleted');

    if (onboardingCompleted === 'true') {
      goto('/dashboard', { replaceState: true });
      return;
    }

    if (tenantSetupCompleted !== 'true') {
      goto('/tenant-setup', { replaceState: true });
      return;
    }

    showWizard = true;
  });

  function handleWizardAction(event: CustomEvent) {
    const { type } = event.detail;
    switch (type) {
      case 'add-tower':
        goto('/modules/coverage-map');
        showWizard = false;
        break;
      case 'setup-cbrs':
        goto('/modules/cbrs-management');
        showWizard = false;
        break;
      case 'setup-acs':
        goto('/modules/acs-cpe-management');
        showWizard = false;
        break;
      case 'setup-monitoring':
        goto('/modules/monitoring');
        showWizard = false;
        break;
      default:
        break;
    }
  }

  function handleWizardClose() {
    showWizard = false;
  }
</script>

<svelte:head>
  <title>Onboarding - WISP Management</title>
  <meta name="description" content="Complete the first-time setup wizard for your WISP." />
</svelte:head>

<TenantGuard>
  {#if showWizard}
    <FirstTimeSetupWizard
      show={showWizard}
      autoStart={true}
      on:close={handleWizardClose}
      on:action={handleWizardAction}
    />
  {:else}
    <div class="onboarding-message">
      <p>Redirecting to the appropriate setup step...</p>
    </div>
  {/if}
</TenantGuard>

<style>
  .onboarding-message {
    padding: 4rem 2rem;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
