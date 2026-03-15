---
title: "API Reference"
description: "Complete API reference for WISP Management"
---

# API Reference

Welcome to the WISP Management API reference. This documentation provides detailed information about all API endpoints, request/response formats, and authentication.

## Authentication

All API requests require authentication using Firebase ID tokens:

```bash
Authorization: Bearer <firebase-id-token>
X-Tenant-ID: <tenant-id>
X-User-Email: <user-email>
```

## Base URL

Production: `https://hss.wisptools.io/api`  
Development: `http://localhost:3001/api`

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `POST /auth/reset-password` - Password reset

### Tenants
- `GET /tenants` - List tenants
- `POST /tenants` - Create tenant
- `GET /tenants/:id` - Get tenant details
- `PUT /tenants/:id` - Update tenant
- `DELETE /tenants/:id` - Delete tenant

### Users
- `GET /users` - List users
- `POST /users` - Create user
- `GET /users/:id` - Get user details
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Monitoring
- `GET /monitoring/devices` - List devices
- `GET /monitoring/graphs/devices` - Device metrics
- `GET /monitoring/graphs/ping/:deviceId` - Ping metrics
- `GET /monitoring/graphs/snmp/:deviceId` - SNMP metrics

### CBRS/SAS
- `GET /cbrs/devices` - List CBRS devices
- `POST /cbrs/devices` - Register device
- `GET /cbrs/grants` - List grants

## Response Format

All API responses follow a standard format:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Or on error:

```json
{
  "success": false,
  "data": null,
  "error": "Error message"
}
```

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API requests are rate-limited to prevent abuse. Current limits:
- 100 requests per minute per user
- 1000 requests per hour per tenant

## Examples

See [API Examples](/api/examples) for code examples in various languages.

