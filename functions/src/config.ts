/**
 * Centralized Cloud Functions Configuration
 * All Firebase Functions URLs, regions, project IDs, and endpoints should be defined here
 */

export const FUNCTIONS_CONFIG = {
  // Firebase Project Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'wisptools-production',
    region: process.env.FIREBASE_REGION || 'us-central1',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
                       process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                       'wisptools-production-firebase-adminsdk.json'
  },
  
  // Cloud Function Base URLs
  cloudFunctions: {
    apiProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/apiProxy',
    isoProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/isoProxy',
    coverageMapProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/coverageMapProxy',
    hssProxy: 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy'
  },
  
  // Allowed Origins for CORS
  cors: {
    origins: [
      'https://wisptools.io',
      'https://management.wisptools.io',
      'https://wisptools-production.web.app',
      'https://wisptools-management.web.app',
      'https://wisptools-production.firebaseapp.com',
      'https://wisptools-io.web.app',
      'https://wisptools-io.firebaseapp.com',
      'https://lte-pci-mapper-65450042-bbf71.web.app',
      'https://lte-pci-mapper-65450042-bbf71.firebaseapp.com',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001'
    ]
  },
  
  // Function Configuration
  functions: {
    // Default function options
    defaultOptions: {
      region: 'us-central1',
      memory: '512MiB',
      timeoutSeconds: 30,
      maxInstances: 10
    },
    
    // Function-specific options
    apiProxy: {
      region: 'us-central1',
      memory: '1GiB',
      timeoutSeconds: 60,
      maxInstances: 20
    },
    
    isoProxy: {
      region: 'us-central1',
      memory: '512MiB',
      timeoutSeconds: 30,
      maxInstances: 10
    }
  }
} as const;

/**
 * Get Cloud Function URL
 */
export function getCloudFunctionUrl(functionName: keyof typeof FUNCTIONS_CONFIG.cloudFunctions): string {
  return FUNCTIONS_CONFIG.cloudFunctions[functionName];
}

/**
 * Get Firebase project ID
 */
export function getFirebaseProjectId(): string {
  return FUNCTIONS_CONFIG.firebase.projectId;
}

/**
 * Get Firebase region
 */
export function getFirebaseRegion(): string {
  return FUNCTIONS_CONFIG.firebase.region;
}

