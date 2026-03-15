<script lang="ts">
  import { projectStatusTitle, projectStatusContent } from '$lib/docs/project-status-docs';
</script>

<svelte:head>
  <title>{projectStatusTitle} – WISP Management Docs</title>
</svelte:head>

<article class="doc-article">
  <h1>{projectStatusTitle}</h1>
  <p class="intro">This page summarizes where the project stands and what to work on next. For the full lists, see the markdown files in the repository <code>docs/</code> folder.</p>
  <div class="doc-body">
    {@html projectStatusContent}
  </div>
</article>
