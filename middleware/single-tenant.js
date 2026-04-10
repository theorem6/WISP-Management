/**
 * When SINGLE_TENANT_ID is set, inject X-Tenant-ID for requests that omit it
 * (single-business deployment). Multitenant / SaaS deployments leave this unset.
 *
 * @see docs/guides/SINGLE_TENANT_MODE.md
 */

function singleTenantFallback(req, res, next) {
  const singleId = process.env.SINGLE_TENANT_ID;
  if (!singleId || String(singleId).trim() === '') {
    return next();
  }

  const trimmed = String(singleId).trim();
  const fromHeader = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
  if (!fromHeader || String(fromHeader).trim() === '') {
    req.headers['x-tenant-id'] = trimmed;
  }
  if (!req.tenantId && req.headers['x-tenant-id']) {
    req.tenantId = req.headers['x-tenant-id'];
  }
  next();
}

module.exports = singleTenantFallback;
