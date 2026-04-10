/**
 * Extension points for restoring multitenant UX and behavior without forking blindly.
 *
 * In single-tenant deployments these are no-ops. A multitenant fork (or feature-flagged
 * build) can register real implementations — e.g. show tenant selector, billing per org.
 *
 * @see docs/multitenant-fork/MULTITENANT_RESTORATION.md
 */

export type TenantResolutionSource =
	| 'single-tenant-env'
	| 'load-user-tenants'
	| 'local-storage'
	| 'manual';

export interface AfterTenantResolvedPayload {
	tenantId: string;
	source: TenantResolutionSource;
}

let afterTenantResolvedHandler: ((payload: AfterTenantResolvedPayload) => void) | null = null;

/** Register a callback after the app resolves the active tenant (for analytics, auditing, etc.). */
export function registerAfterTenantResolved(
	handler: (payload: AfterTenantResolvedPayload) => void
): () => void {
	afterTenantResolvedHandler = handler;
	return () => {
		if (afterTenantResolvedHandler === handler) afterTenantResolvedHandler = null;
	};
}

export function notifyAfterTenantResolved(payload: AfterTenantResolvedPayload): void {
	try {
		afterTenantResolvedHandler?.(payload);
	} catch (e) {
		console.warn('[multitenantExtensionHooks] afterTenantResolved error:', e);
	}
}
