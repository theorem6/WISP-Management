/**
 * Centralized Backend Configuration
 * All backend server URLs, ports, endpoints, and external service URLs should be defined here
 */

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  
  // MongoDB Configuration (set MONGODB_URI in .env; never commit credentials)
  mongodb: {
    uri: process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://localhost:27017/wisptools_dev'),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // CORS Configuration - Allowed Origins
  cors: {
    origins: [
      'https://wisptools.io',
      'https://wisptools-production.web.app',
      'https://wisptools-production.firebaseapp.com',
      'https://wisptools-io.web.app',
      'https://wisptools-io.firebaseapp.com',
      'https://lte-pci-mapper-65450042-bbf71.web.app',
      'https://lte-pci-mapper-65450042-bbf71.firebaseapp.com',
      'https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app',
      'https://pci-mapper--lte-pci-mapper-65450042-bbf71.us-central1.hosted.app',
      'http://localhost:5173', // Development
      'http://localhost:3000', // Development
      'http://localhost:3001'  // Development
    ],
    credentials: true
  },
  
  // External Service URLs
  externalServices: {
    // GenieACS
    genieacs: {
      baseUrl: process.env.GENIEACS_URL || 'http://localhost:7557',
      nbiUrl: process.env.GENIEACS_NBI_URL || 'http://localhost:7557',
      apiKey: process.env.GENIEACS_API_KEY || ''
    },
    
    // ArcGIS Geocoding
    arcgis: {
      geocodeUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
      reverseGeocodeUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
      apiKey: process.env.ARCGIS_API_KEY || '',
      // ArcGIS Building Footprints Feature Service (if you have access)
      // Example: 'https://services.arcgis.com/your_organization_id/arcgis/rest/services/YourBuildingFootprints/FeatureServer'
      // Or state/local government services like:
      // - 'https://gisservices.its.ny.gov/arcgis/rest/services/BuildingFootprints/FeatureServer' (NY only)
      // - 'https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/Building_Footprint/MapServer' (TX only)
      buildingFootprintsServiceUrl: process.env.ARCGIS_BUILDING_FOOTPRINTS_SERVICE_URL || ''
    },
    
      // Microsoft Building Footprints
      // Official Esri Feature Service: https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/MSBFP2/FeatureServer
      // Layer 0: MSBFP - Microsoft Building Footprints (covers entire US)
      // Max Record Count: 2000 per query
      microsoftFootprints: {
        url: process.env.MICROSOFT_FOOTPRINTS_URL || '',
        featureService: process.env.MICROSOFT_FOOTPRINTS_FEATURE_SERVICE || 
          'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/MSBFP2/FeatureServer',
        enabled: process.env.MICROSOFT_FOOTPRINTS_ENABLED !== 'false' // Enabled by default
      },
    
    // HSS Management (GCE VM)
    hss: {
      baseUrl: process.env.HSS_API_URL || 'https://136.112.111.167:3001',
      apiUrl: process.env.HSS_API_URL || 'https://136.112.111.167:3001/api/hss',
      ipAddress: process.env.GCE_PUBLIC_IP || '136.112.111.167',
      port: process.env.HSS_PORT || 3001
    },
    
    // Google Cloud Functions
    cloudFunctions: {
      apiProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/apiProxy',
      isoProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/isoProxy',
      coverageMapProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/coverageMapProxy'
    },
    
    // Firebase Configuration
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'wisptools-production',
      region: process.env.FIREBASE_REGION || 'us-central1'
    },
    
    // GitHub Configuration (for private repository access)
    github: {
      // SSH key authentication (preferred for private repositories)
      sshKeyFingerprint: 'SHA256:evjwW3FJ1wGL/y2JM6daCrcQA1OYVlV4BAyXiM5gdZ0',
      repoUrl: 'git@github.com:theorem6/WISP-Management.git',
      // HTTPS token (fallback, if needed)
      token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '',
      httpsRepoUrl: 'https://github.com/theorem6/WISP-Management.git'
    }
  },
  
  // API Route Paths
  routes: {
    base: '/api',
    plans: '/api/plans',
    network: '/api/network',
    customers: '/api/customers',
    inventory: '/api/inventory',
    deploy: '/api/deploy',
    hss: '/api/hss',
    monitoring: '/api/monitoring',
    maintain: '/api/maintain',
    tenants: '/api/tenants',
    admin: '/admin',
    workOrders: '/api/work-orders'
  },
  
  // Request Limits
  limits: {
    jsonBodySize: '10mb',
    urlEncodedBodySize: '10mb',
    requestTimeout: 30000 // 30 seconds
  }
};

