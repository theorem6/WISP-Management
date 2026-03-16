# Tenant Setup: Only for First-Time Users + Exit Option

## Summary

- Tenant setup runs only when the user has **no tenant associations**; once a tenant exists, login does not route to tenant signup.
- The initial signup/tenant-setup page has an **Exit setup** control so users can leave the wizard and go to the dashboard.

## Changes

### 1. TenantGuard (no forced tenant-setup when setup already done)

**File:** `Module_Manager/src/lib/components/admin/TenantGuard.svelte`

- When `loadUserTenants()` returns 0 tenants, the guard no longer always redirects to `/tenant-setup`.
- It now checks `localStorage.tenantSetupCompleted === 'true'`:
  - If **not** completed → redirect to `/tenant-setup` (first-time flow).
  - If **completed** → do **not** redirect; allow user to continue (e.g. dashboard). Log: "No tenants from API but setupCompleted=true - skipping tenant setup redirect".

So once a user has completed setup once, future logins are not forced back into tenant signup even if the API returns 0 tenants (e.g. 404 or empty list).

### 2. Tenant-setup page: only when user has no tenants

**File:** `Module_Manager/src/routes/tenant-setup/+page.svelte`

- On mount, after loading `existingTenants` via `tenantStore.loadUserTenants()`:
  - If `existingTenants.length > 0` → user already has at least one tenant:
    - Show message: "You already have an organization. Tenant setup is only for first-time users."
    - Redirect to `/tenant-selector` (no wizard).
  - Only users with **zero** tenants (or platform admin with no tenants yet) can stay and create a tenant.

### 3. Exit setup on initial signup page

**File:** `Module_Manager/src/routes/tenant-setup/+page.svelte`

- Added a header at the top of the tenant-setup wizard with:
  - Title/description.
  - **"Exit setup"** button that calls `goto('/dashboard', { replaceState: true })`.
- Users can leave the wizard at any time and go to the dashboard without completing setup.

## Flow Summary

| Scenario | Behavior |
|--------|----------|
| User has 0 tenants, never completed setup | TenantGuard redirects to `/tenant-setup`. User can create tenant or click "Exit setup" → dashboard. |
| User has 0 tenants, already completed setup (`tenantSetupCompleted` in localStorage) | TenantGuard does **not** redirect to tenant-setup; user proceeds (e.g. dashboard). |
| User has ≥1 tenant | TenantGuard uses tenant(s); if they open `/tenant-setup` directly, page redirects to `/tenant-selector`. |
| User on tenant-setup and clicks "Exit setup" | Navigate to `/dashboard`. |

## Related

- User-tenants API: `GET /api/user-tenants/:userId` (Cloud Function → backend internal). See `docs/fixes/USER_TENANTS_404_MANAGEMENT_SITE.md` if 404s occur.
- `tenantSetupCompleted` is set when a tenant is selected/created (e.g. in tenantStore and after create in tenant-setup).
