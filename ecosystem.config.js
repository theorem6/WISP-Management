/**
 * PM2 ecosystem (GCE-style paths).
 * Do not put secrets here. Use `backend-services/.env` and the canonical config:
 *   cd /opt/lte-pci-mapper/backend-services && pm2 start ecosystem.config.js
 * That file loads only non-secret defaults; set MONGODB_URI, INTERNAL_API_KEY,
 * FIREBASE_SERVICE_ACCOUNT_*, ARCGIS_*, SMTP_* on the server (env or Secret Manager).
 */

const backendDir = '/opt/lte-pci-mapper/backend-services';

module.exports = {
  apps: [
    {
      name: 'main-api',
      script: 'server.js',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        FIREBASE_PROJECT_ID: 'wisptools-production'
      },
      error_file: '/home/david/.pm2/logs/main-api-error.log',
      out_file: '/home/david/.pm2/logs/main-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git']
    },
    {
      name: 'epc-api',
      script: 'min-epc-server.js',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '0.0.0.0',
        FIREBASE_PROJECT_ID: 'wisptools-production'
      },
      error_file: '/home/david/.pm2/logs/epc-api-error.log',
      out_file: '/home/david/.pm2/logs/epc-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',
      watch: false
    }
  ]
};
