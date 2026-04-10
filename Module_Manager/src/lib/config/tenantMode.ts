/**
 * Single-tenant vs multitenant deployment mode.
 *
 * Default: multitenant behavior (tenant list, selector, setup flows).
 * Set PUBLIC_SINGLE_TENANT_MODE=true and PUBLIC_SINGLE_TENANT_ID to pin one organization.
 *
 * @see docs/guides/SINGLE_TENANT_MODE.md
 * @see docs/multitenant-fork/README.md
 */

import { env } from '$env/dynamic/public';

export function isSingleTenantMode(): boolean {
	const v = env.PUBLIC_SINGLE_TENANT_MODE;
	return v === 'true' || v === '1' || v === 'yes';
}

/** Firestore/Mongo tenant document id for the sole organization (required when single-tenant mode is on). */
export function getConfiguredSingleTenantId(): string | null {
	const id = env.PUBLIC_SINGLE_TENANT_ID;
	if (id == null || String(id).trim() === '') return null;
	return String(id).trim();
}

/** Optional label for UI when you do not want to load display name from the API yet. */
export function getConfiguredSingleTenantDisplayName(): string | null {
	const n = env.PUBLIC_SINGLE_TENANT_DISPLAY_NAME;
	if (n == null || String(n).trim() === '') return null;
	return String(n).trim();
}

export function assertSingleTenantConfigured(): void {
	if (isSingleTenantMode() && !getConfiguredSingleTenantId()) {
		console.error(
			'[tenantMode] PUBLIC_SINGLE_TENANT_MODE is enabled but PUBLIC_SINGLE_TENANT_ID is missing.'
		);
	}
}
