import { supabase } from './supabaseClient';

// Production Backend API Base URL from Vite build/environment variables
// When empty or unset (local development), relative /api URLs are used and routed by Vite proxy
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Resolves an API path against VITE_API_BASE_URL if configured,
 * otherwise preserves the relative path for the Vite dev proxy.
 */
export function resolveApiUrl(path) {
  if (!path) return path;
  if (API_BASE_URL && path.startsWith('/api')) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

// In production, when VITE_API_BASE_URL is provided, transparently route all direct
// fetch('/api/...') calls to the cloud backend without breaking development proxy.
if (API_BASE_URL && typeof window !== 'undefined' && window.fetch) {
  const nativeFetch = window.fetch;
  window.fetch = function (resource, config) {
    if (typeof resource === 'string' && resource.startsWith('/api')) {
      resource = `${API_BASE_URL}${resource}`;
    }
    return nativeFetch.call(this, resource, config);
  };
}

/**
 * Retrieves the Authorization header containing the active Supabase Bearer token.
 * Throws an error if no valid session or token is available.
 */
export async function getAuthHeader() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || !session.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return {
    Authorization: `Bearer ${session.access_token}`
  };
}

/**
 * Authenticated fetch helper.
 * Automatically injects the Supabase Bearer token into headers.
 * Ensures multipart/form-data boundary is handled natively by the browser for FormData bodies.
 */
export async function authFetch(url, options = {}) {
  const authHeader = await getAuthHeader();

  const headers = {
    ...authHeader,
    ...(options.headers || {})
  };

  // When submitting FormData, do not specify Content-Type so browser sets boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const targetUrl = resolveApiUrl(url);

  return fetch(targetUrl, {
    ...options,
    headers
  });
}

