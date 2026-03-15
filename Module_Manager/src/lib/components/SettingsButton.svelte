<script lang="ts">
  import GlobalSettings from './GlobalSettings.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  let showSettings = false;
  
  // Check if we're on the dashboard
  $: isDashboard = $page.url.pathname === '/dashboard' || $page.url.pathname === '/';
  
  // Check if we're in a module (hide settings button in modules)
  $: isModule = (() => {
    const path = $page.url.pathname;
    return path.includes('/modules/') && path !== '/modules';
  })();
  
  // Only show on dashboard
  $: shouldShow = isDashboard && !isModule;
  
  function openSettings() {
    showSettings = true;
  }
  
  function closeSettings() {
    showSettings = false;
  }
  
  function openDocs() {
    goto('/help');
  }
</script>

{#if shouldShow}
  <div class="header-buttons">
    <button 
      class="docs-button"
      class:dashboard-mode={isDashboard}
      onclick={openDocs}
      title="Documentation"
      aria-label="Open documentation"
      type="button"
    >
      📖
    </button>
    <button 
      class="settings-button" 
      class:dashboard-mode={isDashboard}
      onclick={openSettings} 
      title="Settings"
      aria-label="Open settings"
      type="button"
    >
      ⚙️
    </button>
  </div>
{/if}

<GlobalSettings 
  bind:show={showSettings}
  on:close={closeSettings}
/>

<style>
  .header-buttons {
    position: fixed;
    top: 1.5rem;
    right: 2rem;
    bottom: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 10002;
  }
  
  .docs-button,
  .settings-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .docs-button {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .docs-button:hover {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  .settings-button {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    box-shadow: none;
  }
  
  .settings-button:hover {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
    transform: translateY(-1px);
  }
  
  .settings-button:active {
    transform: translateY(0);
  }
</style>

