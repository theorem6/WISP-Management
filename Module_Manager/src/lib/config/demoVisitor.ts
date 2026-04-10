/**
 * Ephemeral IP-derived demo login (Firebase custom token from API).
 * @see docs/deployment/DEMO_VISITOR.md
 */

import { env } from '$env/dynamic/public';

export function isDemoVisitorLoginEnabled(): boolean {
	const v = env.PUBLIC_DEMO_VISITOR_LOGIN;
	return v === 'true' || v === '1' || v === 'yes';
}

/** Show "Demo site" chrome on login when demo visitor or general demo banner is enabled */
export function isLoginDemoChromeEnabled(): boolean {
	const site = env.PUBLIC_DEMO_SITE;
	const siteOn = site === 'true' || site === '1' || site === 'yes';
	return siteOn || isDemoVisitorLoginEnabled();
}
