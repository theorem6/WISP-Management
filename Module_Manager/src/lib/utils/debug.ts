/**
 * Debug Utility
 * Provides conditional logging based on user's debug preference
 * Debug mode should only be enabled when working with wisptools.io engineers
 */

const DEBUG_STORAGE_KEY = 'wisptools_debug_enabled';

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable debug mode
 */
export function enableDebug(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, 'true');
    // Dispatch event so components can react
    window.dispatchEvent(new CustomEvent('debug-mode-changed', { detail: { enabled: true } }));
  } catch (err) {
    console.error('Failed to enable debug mode:', err);
  }
}

/**
 * Disable debug mode
 */
export function disableDebug(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DEBUG_STORAGE_KEY);
    // Dispatch event so components can react
    window.dispatchEvent(new CustomEvent('debug-mode-changed', { detail: { enabled: false } }));
  } catch (err) {
    console.error('Failed to disable debug mode:', err);
  }
}

/**
 * Debug logger - only logs if debug mode is enabled
 */
export const debug = {
  log: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.log('[DEBUG]', ...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but prefix with [DEBUG] if debug mode is on
    if (isDebugEnabled()) {
      console.error('[DEBUG]', ...args);
    } else {
      console.error(...args);
    }
  },
  warn: (...args: any[]) => {
    // Always log warnings, but prefix with [DEBUG] if debug mode is on
    if (isDebugEnabled()) {
      console.warn('[DEBUG]', ...args);
    } else {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.info('[DEBUG]', ...args);
    }
  },
  group: (label: string) => {
    if (isDebugEnabled()) {
      console.group('[DEBUG]', label);
    }
  },
  groupEnd: () => {
    if (isDebugEnabled()) {
      console.groupEnd();
    }
  },
  table: (data: any) => {
    if (isDebugEnabled()) {
      console.table(data);
    }
  }
};
