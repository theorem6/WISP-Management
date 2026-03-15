<script lang="ts">
  export let status = 500;
  export let message = 'Something went wrong';
</script>

<svelte:head>
  <title>{status === 404 ? 'Page not found' : 'Error'} – WISP Management</title>
</svelte:head>

<div class="error-page">
  <div class="error-card">
    <h1>{status === 404 ? 'Page not found' : 'Error'}</h1>
    <p class="status">{status}</p>
    <p class="message">{message}</p>
    <div class="actions">
      <a href="/dashboard" class="btn-primary">← Back to App</a>
      <a href="/help" class="btn-secondary">Help & Documentation</a>
    </div>
  </div>
</div>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    padding: 2rem;
  }
  .error-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 2.5rem;
    max-width: 420px;
    text-align: center;
  }
  .error-card h1 {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    color: var(--text-primary);
  }
  .status {
    font-size: 3rem;
    font-weight: 700;
    color: var(--text-secondary);
    margin: 0.5rem 0;
  }
  .message {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }
  .btn-primary,
  .btn-secondary {
    display: inline-block;
    padding: 0.6rem 1.25rem;
    border-radius: var(--radius-md);
    text-decoration: none;
    font-weight: 500;
    transition: opacity 0.2s;
  }
  .btn-primary {
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .btn-primary:hover,
  .btn-secondary:hover {
    opacity: 0.9;
  }
</style>
