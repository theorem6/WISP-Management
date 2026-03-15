<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';

  let actionCode = '';
  let newPassword = '';
  let confirmPassword = '';
  let isLoading = false;
  let error = '';
  let success = '';
  let mode: 'reset' | 'verify' | 'unknown' = 'unknown';

  onMount(() => {
    if (!browser) return;

    // Get action code from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    actionCode = urlParams.get('oobCode') || urlParams.get('code') || '';
    const modeParam = urlParams.get('mode') || '';

    if (!actionCode) {
      error = 'Invalid reset link. Please request a new password reset email.';
      return;
    }

    // Determine mode based on URL parameter
    if (modeParam === 'resetPassword') {
      mode = 'reset';
    } else if (modeParam === 'verifyEmail') {
      mode = 'verify';
    } else {
      // Try to infer from action code or default to reset
      mode = 'reset';
    }
  });

  async function handlePasswordReset() {
    if (!newPassword || !confirmPassword) {
      error = 'Please enter and confirm your new password';
      return;
    }

    if (newPassword.length < 6) {
      error = 'Password must be at least 6 characters long';
      return;
    }

    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const result = await authService.verifyPasswordReset(actionCode, newPassword);
      
      if (result.success) {
        success = 'Password reset successfully! Redirecting to login...';
        setTimeout(() => {
          goto('/login?passwordReset=success');
        }, 2000);
      } else {
        error = result.error || 'Failed to reset password. The link may have expired.';
      }
    } catch (err: any) {
      error = err.message || 'An error occurred while resetting your password';
    } finally {
      isLoading = false;
    }
  }

  async function handleEmailVerification() {
    isLoading = true;
    error = '';

    try {
      const result = await authService.verifyActionCode(actionCode);
      
      if (result.success) {
        success = 'Email verified successfully! Redirecting to login...';
        setTimeout(() => {
          goto('/login?emailVerified=success');
        }, 2000);
      } else {
        error = result.error || 'Failed to verify email. The link may have expired.';
      }
    } catch (err: any) {
      error = err.message || 'An error occurred while verifying your email';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="reset-password-page">
  <div class="reset-password-container">
    <div class="reset-password-card">
      <h1>WISP Management</h1>
      <p class="subtitle">Password Reset</p>

      {#if error}
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          {error}
        </div>
      {/if}

      {#if success}
        <div class="success-message">
          <span class="success-icon">✅</span>
          {success}
        </div>
      {/if}

      {#if mode === 'reset'}
        <div class="form-container">
          <h2>Set New Password</h2>
          <p class="form-description">Enter your new password below</p>

          <div class="form-group">
            <label for="newPassword">New Password <span class="required">*</span></label>
            <input
              id="newPassword"
              type="password"
              bind:value={newPassword}
              placeholder="Enter your new password"
              disabled={isLoading}
              required
              minlength="6"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              placeholder="Confirm your new password"
              disabled={isLoading}
              required
              minlength="6"
            />
          </div>

          <button 
            type="button" 
            class="btn-primary" 
            onclick={handlePasswordReset}
            disabled={isLoading || !newPassword || !confirmPassword}
          >
            {#if isLoading}
              <span class="spinner"></span>
              Resetting...
            {:else}
              Reset Password
            {/if}
          </button>
        </div>
      {:else if mode === 'verify'}
        <div class="form-container">
          <h2>Verify Email</h2>
          <p class="form-description">Click the button below to verify your email address</p>

          <button 
            type="button" 
            class="btn-primary" 
            onclick={handleEmailVerification}
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="spinner"></span>
              Verifying...
            {:else}
              Verify Email
            {/if}
          </button>
        </div>
      {:else if !actionCode}
        <div class="form-container">
          <p class="error-text">Invalid reset link. Please request a new password reset email.</p>
          <button 
            type="button" 
            class="btn-primary" 
            onclick={() => goto('/login')}
          >
            Go to Login
          </button>
        </div>
      {/if}

      <div class="form-footer">
        <a href="/login" class="link">Back to Login</a>
      </div>
    </div>
  </div>
</div>

<style>
  .reset-password-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    padding: 2rem;
  }

  .reset-password-container {
    width: 100%;
    max-width: 450px;
  }

  .reset-password-card {
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 217, 255, 0.2);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  h1 {
    color: #00d9ff;
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    text-align: center;
  }

  .subtitle {
    color: #a0d9e8;
    font-size: 1rem;
    text-align: center;
    margin: 0 0 2rem;
  }

  .form-container {
    margin: 2rem 0;
  }

  h2 {
    color: #ffffff;
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }

  .form-description {
    color: #a0d9e8;
    font-size: 0.875rem;
    margin: 0 0 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    color: #e2e8f0;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .required {
    color: #ef4444;
  }

  input[type="password"] {
    width: 100%;
    padding: 0.875rem 1rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(0, 217, 255, 0.3);
    border-radius: 0.5rem;
    color: #ffffff;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  input[type="password"]:focus {
    outline: none;
    border-color: #00d9ff;
    box-shadow: 0 0 0 3px rgba(0, 217, 255, 0.1);
  }

  input[type="password"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, #00d9ff 0%, #0088cc 100%);
    border: none;
    border-radius: 0.5rem;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 217, 255, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
    color: #fca5a5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
    color: #86efac;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-text {
    color: #fca5a5;
    text-align: center;
    margin: 1rem 0;
  }

  .form-footer {
    margin-top: 2rem;
    text-align: center;
  }

  .link {
    color: #00d9ff;
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.2s;
  }

  .link:hover {
    color: #86efac;
    text-decoration: underline;
  }

  .spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(15, 23, 42, 0.3);
    border-top-color: #0f172a;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

