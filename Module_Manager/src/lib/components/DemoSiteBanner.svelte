<script lang="ts">
  /**
   * Shown when PUBLIC_DEMO_SITE=true — test / demo deployments only.
   */
</script>

<div class="demo-banner" role="status">
  <span class="demo-banner__badge">Demo</span>
  <span class="demo-banner__text">
    Test data only. Changes persist to the demo database — use the
    <a href="/demo">demo hub</a> for quick links.
  </span>
</div>

<style>
  .demo-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
    background: linear-gradient(90deg, #7c2d12 0%, #c2410c 50%, #ea580c 100%);
    color: #fffbeb;
    font-size: 0.875rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  }
  .demo-banner__badge {
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 4px;
  }
  .demo-banner__text a {
    color: #fff;
    font-weight: 600;
    text-decoration: underline;
  }
  .demo-banner__text a:hover {
    text-decoration: none;
  }
</style>
