/**
 * Ephemeral IP-derived demo login (Firebase custom token from API).
 * @see docs/deployment/DEMO_VISITOR.md
 */

import { isPublicFlagTrue } from './publicEnv';

export function isDemoVisitorLoginEnabled(): boolean {
	return isPublicFlagTrue('PUBLIC_DEMO_VISITOR_LOGIN');
}

/** Show "Demo site" chrome on login when demo visitor or general demo banner is enabled */
export function isLoginDemoChromeEnabled(): boolean {
	return isPublicFlagTrue('PUBLIC_DEMO_SITE') || isDemoVisitorLoginEnabled();
}
