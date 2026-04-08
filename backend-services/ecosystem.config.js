/**
 * PM2 Ecosystem Configuration
 * Manages all API services as separate processes on isolated ports.
 * Secrets (MONGODB_URI, INTERNAL_API_KEY, FIREBASE_*, ARCGIS_*, SMTP_*) must be in .env.
 * Run from backend-services: pm2 start ecosystem.config.js
 */

const path = require('path');
const os = require('os');

const pm2LogDir = path.join(os.homedir(), '.pm2', 'logs');

module.exports = {
  apps: [
    {
      name: 'main-api',
      script: './server.js',
      cwd: path.join(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        FIREBASE_PROJECT_ID: 'wisptools-production'
      },
      error_file: path.join(pm2LogDir, 'main-api-error.log'),
      out_file: path.join(pm2LogDir, 'main-api-out.log'),
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
      script: './min-epc-server.js',
      cwd: path.join(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '0.0.0.0',
        FIREBASE_PROJECT_ID: 'wisptools-production'
      },
      error_file: path.join(pm2LogDir, 'epc-api-error.log'),
      out_file: path.join(pm2LogDir, 'epc-api-out.log'),
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

