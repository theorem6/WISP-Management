import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// App served at root on management.wisptools.io (no base path)
		// Use adapter-static for Firebase Hosting static deployment
		adapter: adapter({
			pages: 'build/client',
			assets: 'build/client',
			fallback: 'index.html',
			precompress: false,
			strict: false // Allow dynamic routes to work with fallback
		})
	},

	// Suppress non-critical accessibility warnings
	onwarn: (warning, handler) => {
		// Suppress accessibility warnings for modals (these are intentional)
		if (warning.code === 'a11y_click_events_have_key_events') return;
		if (warning.code === 'a11y_no_static_element_interactions') return;
		if (warning.code === 'a11y_interactive_supports_focus') return;
		if (warning.code === 'a11y_no_noninteractive_element_interactions') return;
		
		// Suppress label association warnings (forms work correctly)
		if (warning.code === 'a11y_label_has_associated_control') return;
		
		// Suppress unused CSS warnings (keeping styles for consistency)
		if (warning.code === 'css_unused_selector') return;
		
		// Handle all other warnings normally
		handler(warning);
	}
};

export default config;
