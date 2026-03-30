/**
 * Voice / SIP / UC — tenant API client
 */

import { browser } from '$app/environment';
import { authService } from './authService';
import { isPlatformAdmin } from './adminService';
import { getApiUrl } from '$lib/config/api';

export interface VoiceBoundContext {
  id: string;
  label: string;
  entities: string[];
}

export interface VoiceDomainSchema {
  bounded_contexts: VoiceBoundContext[];
  entities: Record<string, string>;
  state_machines: Record<string, string[]>;
  carrier_comparison: Array<{
    dimension: string;
    bandwidth: string;
    telnyx: string;
    twilio: string;
  }>;
  pragmatic_recommendation: string;
  arcgis: { note: string; uses: string[] };
  phased_rollout: { phase: number; scope: string }[];
  first_build_in_code: string[];
  enums: Record<string, string[]>;
}

export interface VoiceProviderAccount {
  _id: string;
  tenantId: string;
  provider: 'bandwidth' | 'telnyx' | 'twilio';
  externalAccountId: string;
  displayName?: string;
  credentialRef?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceTelephoneNumber {
  _id: string;
  tenantId: string;
  e164: string;
  status: 'inventory' | 'assigned' | 'suspended';
  voiceProviderAccountId: string;
  providerTnId?: string;
  rateCenter?: string;
  lata?: string;
  emergencyAddressId?: unknown;
  e911Display?: string;
  /** Customer module id (e.g. CUST-2025-001) */
  customerId?: string;
}

export interface VoiceServiceLocation {
  _id: string;
  tenantId: string;
  customerId?: string;
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  postal?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  geocodeAccuracyM?: number;
  geocodeSource?: string;
  geocodeLocatorName?: string;
  geocodeScore?: number;
}

export interface VoicePortOrder {
  _id: string;
  tenantId: string;
  status: string;
  telephoneNumbersE164?: string[];
  losingCarrierName?: string;
  focTargetDate?: string;
  providerOrderId?: string;
}

class VoiceService {
  private async apiCall<T>(endpoint: string, options: RequestInit = {}, tenantId?: string): Promise<T> {
    if (!browser) {
      throw new Error('Voice service can only be used in browser');
    }

    const token = await authService.getAuthTokenForApi();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const resolvedTenantId =
      tenantId || (typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null);
    const user = await authService.getCurrentUser();
    const isAdmin = isPlatformAdmin(user?.email ?? null);

    if (!resolvedTenantId && !isAdmin) {
      throw new Error('No tenant selected');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (resolvedTenantId) {
      headers['X-Tenant-ID'] = resolvedTenantId;
    } else if (!isAdmin) {
      throw new Error('No tenant selected');
    }

    const base = getApiUrl('VOICE') || '/api/voice';
    const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((err as { error?: string }).error || 'Request failed');
    }

    return (await response.json()) as T;
  }

  async fetchSchema(): Promise<VoiceDomainSchema> {
    return this.apiCall<VoiceDomainSchema>('/schema');
  }

  async listProviderAccounts(): Promise<VoiceProviderAccount[]> {
    return this.apiCall<VoiceProviderAccount[]>('/provider-accounts');
  }

  async createProviderAccount(data: {
    provider: string;
    externalAccountId: string;
    displayName?: string;
    credentialRef?: string;
  }): Promise<VoiceProviderAccount> {
    return this.apiCall<VoiceProviderAccount>('/provider-accounts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async listTelephoneNumbers(filters?: { customerId?: string }): Promise<VoiceTelephoneNumber[]> {
    const q =
      filters?.customerId != null && filters.customerId !== ''
        ? `?customerId=${encodeURIComponent(filters.customerId)}`
        : '';
    return this.apiCall<VoiceTelephoneNumber[]>(`/telephone-numbers${q}`);
  }

  async createTelephoneNumber(body: {
    e164: string;
    status: 'inventory' | 'assigned' | 'suspended';
    voiceProviderAccountId: string;
    providerTnId?: string;
    rateCenter?: string;
    lata?: string;
    emergencyAddressId?: string;
    customerId?: string;
  }): Promise<VoiceTelephoneNumber> {
    return this.apiCall<VoiceTelephoneNumber>('/telephone-numbers', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async createServiceLocation(body: {
    customerId?: string;
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    geocodeAccuracyM?: number;
    geocodeSource?: string;
    geocodeLocatorName?: string;
    geocodeScore?: number;
  }): Promise<VoiceServiceLocation> {
    return this.apiCall<VoiceServiceLocation>('/service-locations', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async patchTelephoneNumber(
    id: string,
    body: Partial<{
      status: string;
      providerTnId: string;
      rateCenter: string;
      lata: string;
      emergencyAddressId: string | null;
      customerId: string | null;
    }>
  ): Promise<VoiceTelephoneNumber> {
    return this.apiCall<VoiceTelephoneNumber>(`/telephone-numbers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  async listServiceLocations(filters?: { customerId?: string }): Promise<VoiceServiceLocation[]> {
    const q =
      filters?.customerId != null && filters.customerId !== ''
        ? `?customerId=${encodeURIComponent(filters.customerId)}`
        : '';
    return this.apiCall<VoiceServiceLocation[]>(`/service-locations${q}`);
  }

  async listPortOrders(): Promise<VoicePortOrder[]> {
    return this.apiCall<VoicePortOrder[]>('/port-orders');
  }
}

export const voiceService = new VoiceService();
