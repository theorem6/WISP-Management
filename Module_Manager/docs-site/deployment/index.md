---
title: "Deployment Overview"
description: "Overview of deployment options and processes for WISP Management"
---

# Deployment Overview

This section covers deployment of the WISP Management platform, including backend services, frontend application, and infrastructure setup.

## Deployment Options

### Full Stack Deployment

The WISP Management platform consists of:

1. **Frontend** - SvelteKit application (Firebase Hosting)
2. **Backend** - Node.js/Express API (Google Compute Engine)
3. **Database** - MongoDB (MongoDB Atlas or self-hosted)
4. **Authentication** - Firebase Authentication
5. **Functions** - Firebase Cloud Functions (API proxy)

## Quick Links

- [Backend Deployment](/deployment/backend) - Deploy backend services
- [Infrastructure Setup](/deployment/infrastructure) - Google Cloud infrastructure
- [Frontend Deployment](/deployment/frontend) - Frontend build and deploy

## Deployment Process

### 1. Infrastructure Setup

First, set up the infrastructure:
- Google Cloud Project
- Compute Engine instance
- Firebase project
- MongoDB cluster

See [Infrastructure Setup](/deployment/infrastructure) for details.

### 2. Backend Deployment

Deploy the backend services:
- API server
- Monitoring services
- Background jobs

See [Backend Deployment](/deployment/backend) for step-by-step instructions.

### 3. Frontend Deployment

Build and deploy the frontend:
- Build SvelteKit application
- Deploy to Firebase Hosting
- Configure environment variables

## Environment Variables

Ensure all required environment variables are configured:
- Firebase configuration
- MongoDB connection string
- API keys
- OAuth credentials

## Next Steps

After deployment:
- Verify all services are running
- Test authentication
- Create initial admin user
- Configure tenants

