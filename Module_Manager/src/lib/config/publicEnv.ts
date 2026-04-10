/**
 * Public flags from Vite (`import.meta.env.PUBLIC_*`).
 * Prefer this over `$env/dynamic/public` for UI that runs with `ssr = false`, where
 * dynamic public env can be empty in the browser bundle.
 */
const envAll = import.meta.env as Record<string, string | boolean | undefined>;

export function getPublicEnv(key: string): string | undefined {
	const v = envAll[key];
	if (typeof v !== 'string' || v.length === 0) return undefined;
	return v;
}

export function isPublicFlagTrue(key: string): boolean {
	const v = getPublicEnv(key);
	return v === 'true' || v === '1' || v === 'yes';
}
