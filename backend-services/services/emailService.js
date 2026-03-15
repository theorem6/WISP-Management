/**
 * Email Service
 * Sends welcome emails and notifications to users
 * 
 * Uses nodemailer with sendmail (local) or SMTP
 * Falls back to console logging if email sending fails
 */

const nodemailer = require('nodemailer');

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@hss.wisptools.io';
const FROM_NAME = process.env.FROM_NAME || 'WISP Management';

// Check if we should use SMTP or sendmail
const USE_SMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

// Create transporter (lazy initialization)
let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (USE_SMTP) {
      // Use SMTP configuration
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log('📧 [Email] SMTP transporter initialized');
    } else {
      // Use sendmail (local mail transport)
      transporter = nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail'
      });
      console.log('📧 [Email] Sendmail transporter initialized');
    }
  }
  return transporter;
}

/**
 * Check if email service is configured
 */
function isConfigured() {
  return true; // Always configured - uses sendmail as fallback
}

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(options) {
  const {
    email,
    displayName,
    tenantName,
    role,
    invitedByName
  } = options;

  const transport = getTransporter();

  const firstName = displayName?.split(' ')[0] || email.split('@')[0];
  const roleName = getRoleName(role);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${tenantName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #8b5cf6; margin: 0; font-size: 28px; }
    h2 { color: #1f2937; margin: 0 0 20px; }
    p { margin: 0 0 16px; color: #4b5563; }
    .highlight { background: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .highlight strong { color: #7c3aed; }
    .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .button:hover { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); }
    .steps { margin: 24px 0; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .step-number { background: #8b5cf6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; margin-right: 12px; flex-shrink: 0; }
    .step-content { flex: 1; }
    .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
    .footer a { color: #8b5cf6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>🌐 WISP Management</h1>
      </div>
      
      <h2>Welcome to ${tenantName}!</h2>
      
      <p>Hi ${firstName},</p>
      
      <p>${invitedByName ? `${invitedByName} has added you` : 'You have been added'} to <strong>${tenantName}</strong> on WISP Management as a <strong>${roleName}</strong>.</p>
      
      <div class="highlight">
        <strong>Your Role:</strong> ${roleName}<br>
        <strong>Organization:</strong> ${tenantName}
      </div>
      
      <p><strong>Getting Started:</strong></p>
      
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">Go to <strong>wisptools.io</strong></div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">Sign in with <strong>Google</strong> or create an account using this email address</div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">You'll automatically have access to ${tenantName}</div>
        </div>
      </div>
      
      <center>
        <a href="https://wisptools.io/wisp-management/login" class="button">Sign In to WISP Management →</a>
      </center>
      
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        If you have any questions, please contact your organization administrator.
      </p>
    </div>
    
    <div class="footer">
      <p>This email was sent by <a href="https://wisptools.io">WISP Management</a></p>
      <p>WISP Management Platform</p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Welcome to ${tenantName}!

Hi ${firstName},

${invitedByName ? `${invitedByName} has added you` : 'You have been added'} to ${tenantName} on WISP Management as a ${roleName}.

Your Role: ${roleName}
Organization: ${tenantName}

Getting Started:
1. Go to wisptools.io
2. Sign in with Google or create an account using this email address
3. You'll automatically have access to ${tenantName}

Sign In: https://wisptools.io/wisp-management/login

If you have any questions, please contact your organization administrator.

---
WISP Management - WISP Management Platform
https://wisptools.io
  `;

  try {
    const result = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: `Welcome to ${tenantName} - WISP Management`,
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email] Welcome email sent to ${email}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send welcome email to ${email}:`, error.message);
    return { sent: false, reason: error.message };
  }
}

/**
 * Get human-readable role name
 */
function getRoleName(role) {
  const roleNames = {
    platform_admin: 'Platform Admin',
    owner: 'Owner',
    admin: 'Admin',
    engineer: 'Engineer',
    installer: 'Field Technician',
    helpdesk: 'Help Desk',
    support: 'Customer Support',
    viewer: 'Viewer'
  };
  return roleNames[role] || role;
}

/**
 * Send password reset email (placeholder)
 */
async function sendPasswordResetEmail(email, resetLink) {
  console.log(`📧 [Email] Password reset requested for ${email}`);
  if (!resetLink) {
    return { sent: false, reason: 'Reset link not provided' };
  }

  const transport = getTransporter();
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your WISP Management password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .button { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .muted { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h2>Reset your password</h2>
      <p>We received a request to reset your WISP Management password. Use the button below to choose a new password.</p>
      <p><a class="button" href="${resetLink}">Reset password</a></p>
      <p class="muted">If you did not request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
Reset your WISP Management password

Use this link to reset your password:
${resetLink}

If you did not request this, you can ignore this email.
  `.trim();

  try {
    const result = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Reset your WISP Management password',
      text: textContent,
      html: htmlContent
    });
    console.log(`✅ [Email] Password reset email sent to ${email}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send password reset email to ${email}:`, error.message);
    return { sent: false, reason: error.message };
  }
}

/**
 * Send email verification code
 */
async function sendVerificationEmail(options) {
  const { email, code } = options;

  const transport = getTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WISP Management Email Verification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #8b5cf6; margin: 0; font-size: 28px; }
    h2 { color: #1f2937; margin: 0 0 20px; }
    p { margin: 0 0 16px; color: #4b5563; }
    .code-box { background: #f5f3ff; border: 2px dashed #8b5cf6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-size: 32px; font-weight: 700; color: #7c3aed; letter-spacing: 4px; font-family: monospace; }
    .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
    .footer a { color: #8b5cf6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>🌐 WISP Management</h1>
      </div>
      
      <h2>Email Verification</h2>
      
      <p>Hi there,</p>
      
      <p>You're creating a new WISP Management account. Please use the verification code below to verify your email address:</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
      </div>
      
      <p>This code will expire in 10 minutes.</p>
      
      <p>If you didn't request this code, you can safely ignore this email.</p>
    </div>
    
    <div class="footer">
      <p>This email was sent by <a href="https://wisptools.io">WISP Management</a></p>
      <p>WISP Management Platform</p>
      <p>https://wisptools.io</p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
WISP Management Email Verification

Hi there,

You're creating a new WISP Management account. Please use the verification code below to verify your email address:

${code}

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.

---
WISP Management - WISP Management Platform
https://wisptools.io
  `;

  try {
    const result = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: 'WISP Management Email Verification Code',
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email] Verification code sent to ${email}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send verification email to ${email}:`, error.message);
    throw error; // Re-throw so caller can handle
  }
}

module.exports = {
  isConfigured,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};

