<script lang="ts">
  // No default coordinates - map will center on US or last deployed plan
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import CoverageMapView from './components/CoverageMapView.svelte';
  import FilterPanel from './components/FilterPanel.svelte';
  import AddSiteModal from './components/AddSiteModal.svelte';
  import AddNOCModal from './components/AddNOCModal.svelte';
  import AddWarehouseModal from './components/AddWarehouseModal.svelte';
  import AddVehicleModal from './components/AddVehicleModal.svelte';
  import AddRMAModal from './components/AddRMAModal.svelte';
  import AddSectorModal from './components/AddSectorModal.svelte';
  // SettingsButton removed - now only on dashboard
  import AddCPEModal from './components/AddCPEModal.svelte';
  import AddBackhaulLinkModal from './components/AddBackhaulLinkModal.svelte';
  import AddInventoryModal from './components/AddInventoryModal.svelte';
  import MapContextMenu from './components/MapContextMenu.svelte';
  import TowerActionsMenu from './components/TowerActionsMenu.svelte';
  import SectorActionsMenu from './components/SectorActionsMenu.svelte';
  import BackhaulActionsMenu from './components/BackhaulActionsMenu.svelte';
  import EPCDeploymentModal from '../deploy/components/EPCDeploymentModal.svelte';
  import HSSRegistrationModal from './components/HSSRegistrationModal.svelte';
  import HardwareDeploymentModal from './components/HardwareDeploymentModal.svelte';
  import SiteEditModal from './components/SiteEditModal.svelte';
  import UnifiedDeviceDetailsModal from './components/UnifiedDeviceDetailsModal.svelte';
  import DeviceManagementPanel from './components/DeviceManagementPanel.svelte';
import { coverageMapService } from './lib/coverageMapService.mongodb';
  import { reportGenerator } from './lib/reportGenerator';
  import HelpModal from '$lib/components/modals/HelpModal.svelte';
  import { coverageMapDocs } from '$lib/docs/coverage-map-docs';
  import TipsModal from '$lib/components/modals/TipsModal.svelte';
  import { getModuleTips } from '$lib/config/moduleTips';
  import { tipsService } from '$lib/services/tipsService';
  import { objectStateManager, type ModuleContext } from '$lib/services/objectStateManager';
import { mapLayerManager } from '$lib/map/MapLayerManager';
import { authService } from '$lib/services/authService';
  import type { 
    TowerSite, Sector, CPEDevice, NetworkEquipment, 
    CoverageMapFilters, Location 
  } from './lib/models';
import type { PlanLayerFeature, PlanFeatureSummary, HardwareView, PlanFeatureGeometry, PlanMarketingAddress } from '$lib/services/planService';
import type { MapModuleMode, MapCapabilities } from '$lib/map/MapCapabilities';
  
  // Data
  let towers: TowerSite[] = [];
  let sectors: Sector[] = [];
  let cpeDevices: CPEDevice[] = [];
  let equipment: NetworkEquipment[] = [];
  
  // UI State
  let isLoading = true;
  let error = '';
  let success = '';
  let showFilters = false;
  let showStats = false;
  let currentBasemap = 'topo-vector';
  
  // Modals
  let showAddSiteModal = false;
  let showAddNOCModal = false;
  let showAddWarehouseModal = false;
  let showAddVehicleModal = false;
  let showAddRMAModal = false;
  let showAddSectorModal = false;
  let selectedSectorForEdit: Sector | null = null;
  let showAddCPEModal = false;
  let showAddBackhaulModal = false;
  let showAddInventoryModal = false;
  let showContextMenu = false;
  let showTowerActionsMenu = false;
  let showSectorActionsMenu = false;
  let showBackhaulActionsMenu = false;
  let showEPCDeploymentModal = false;
  let showHSSRegistrationModal = false;
  let showHardwareDeploymentModal = false;
  let showSiteEditModal = false;
  let showHelpModal = false;
  const helpContent = coverageMapDocs;
  
  // Unified Device Management
  let showDevicePanel = false;
  let showUnifiedDeviceModal = false;
  let selectedDevice: any = null;
  let selectedDeviceType: 'snmp' | 'tr069' | 'mikrotik' | 'epc' | 'network-equipment' | 'unknown' = 'unknown';
  let allDevices: any[] = []; // Combined devices from all sources
  
  async function loadAllDevicesForManagement() {
    if (!tenantId) return;
    
    try {
      const user = authService.getCurrentUser();
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const devices: any[] = [];
      
      // Load SNMP devices
      try {
        const snmpResponse = await fetch('/api/monitoring/devices', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          }
        });
        if (snmpResponse.ok) {
          const snmpData = await snmpResponse.json();
          const snmpDevices = (snmpData.devices || []).map((d: any) => ({
            ...d,
            _deviceType: 'snmp'
          }));
          devices.push(...snmpDevices);
        }
      } catch (err) {
        console.error('Error loading SNMP devices:', err);
      }
      
      // Load MikroTik devices
      try {
        const mikrotikResponse = await fetch('/api/mikrotik/devices', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          }
        });
        if (mikrotikResponse.ok) {
          const mikrotikData = await mikrotikResponse.json();
          const mikrotikDevices = (mikrotikData.devices || []).map((d: any) => ({
            ...d,
            _deviceType: 'mikrotik'
          }));
          devices.push(...mikrotikDevices);
        }
      } catch (err) {
        console.error('Error loading MikroTik devices:', err);
      }
      
      // Load EPC devices
      try {
        const epcResponse = await fetch('/api/hss/epc/remote/list', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          }
        });
        if (epcResponse.ok) {
          const epcData = await epcResponse.json();
          const epcDevices = (epcData.epcs || []).map((d: any) => ({
            ...d,
            _deviceType: 'epc',
            id: d.epc_id || d.id || d._id
          }));
          devices.push(...epcDevices);
        }
      } catch (err) {
        console.error('Error loading EPC devices:', err);
      }
      
      // Add network equipment
      const networkEquipment = equipment.map((eq: any) => ({
        ...eq,
        _deviceType: 'network-equipment',
        id: eq.id || eq._id
      }));
      devices.push(...networkEquipment);
      
      allDevices = devices;
    } catch (error) {
      console.error('Error loading devices for management:', error);
    }
  }
  
  // Tips Modal
  let showTipsModal = false;
  let tipsShown = false; // Track if tips have been shown
  const tips = getModuleTips('coverage-map');
  
  // Check if we're in an iframe (will be set in onMount)
  let isInIframe = false;
  
  // Check if we're embedded (in iframe or plan/deploy mode) - don't show tips if embedded
  $: isEmbedded = (() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const isPlanMode = urlParams.get('mode') === 'plan' || urlParams.get('planMode') === 'true';
    const isDeployMode = urlParams.get('mode') === 'deploy' || urlParams.get('deployMode') === 'true';
    return isInIframe || isPlanMode || isDeployMode;
  })();
  
  // Show tips AFTER loading completes (maps are loaded)
  $: if (!isLoading && !tipsShown && !isEmbedded && tips.length > 0 && tipsService.shouldShowTips('coverage-map')) {
    // Defer slightly to ensure maps are fully rendered
    setTimeout(() => {
      if (!isLoading && !tipsShown && !isEmbedded) {
        showTipsModal = true;
        tipsShown = true;
      }
    }, 500); // 500ms delay to ensure maps are loaded
  }
  
  // Guard flag to prevent duplicate loads
  let isLoadingData = false;
  let lastLoadedTenantId: string | null = null;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuLat: number | null = null;
  let contextMenuLon: number | null = null;
  let selectedSiteForSector: TowerSite | null = null;
  let selectedSiteForBackhaul: TowerSite | null = null;
  let selectedSiteForInventory: TowerSite | null = null;
  let selectedTowerForMenu: TowerSite | null = null;
  let selectedSectorForMenu: Sector | null = null;
  let selectedBackhaulForMenu: NetworkEquipment | null = null;
  let selectedTowerForEPC: TowerSite | null = null;
  let selectedSiteForEdit: TowerSite | null = null;
  let towerMenuX = 0;
  let towerMenuY = 0;
  let sectorMenuX = 0;
  let sectorMenuY = 0;
  let backhaulMenuX = 0;
  let backhaulMenuY = 0;
  let selectedBackhaulForEdit: NetworkEquipment | null = null;
  let initialSiteType: TowerSite['type'] | null = null;
  let selectedPlanDraft: PlanLayerFeature | null = null;
  let showPlanDraftMenu = false;
  let planDraftMenuX = 0;
  let planDraftMenuY = 0;
  let selectedPlanDraftCoords = { latitude: null as number | null, longitude: null as number | null };
  let planDraftForSiteEdit: PlanLayerFeature | null = null;
  let planDraftsForMap: PlanLayerFeature[] = [];
  let planDraftSitesForActions: TowerSite[] = [];
  let combinedSites: TowerSite[] = [];
  let visiblePlanIds: string[] = [];
  let currentVisiblePlanIds: Set<string> = new Set();
  let marketingLeads: PlanMarketingAddress[] = [];
  
  // Map mode derived from query parameters (default to coverage view)
  $: mapMode = (() => {
    const modeParam = $page.url.searchParams.get('mode');
    if (modeParam) {
      return modeParam.toLowerCase();
    }
    return $page.url.searchParams.get('planMode') === 'true' ? 'plan' : 'coverage';
  })();

  $: isPlanMode = mapMode === 'plan';
  $: isDeployMode = mapMode === 'deploy';
  $: isMonitorMode = mapMode === 'monitor';

  let sharedCapabilities: MapCapabilities | null = null;
  let sharedActivePlanId: string | null = null;
  let planEditingEnabled = true;

  // Module context for permissions
  $: moduleContext = (() => {
    const userRole = ($currentTenant?.userRole as string | undefined) || 'admin';
    const context: ModuleContext = {
      module: 'coverage-map',
      userRole
    };

    if (isPlanMode) {
      context.module = 'plan';
      if (planId) {
        context.projectId = planId;
      }
    } else if (isDeployMode) {
      context.module = 'deploy';
    } else if (isMonitorMode) {
      context.module = 'monitor';
    }

    return context;
  })();
  
  // Filters
  let filters: CoverageMapFilters = {
    showTowers: true,
    showSectors: true,
    showCPE: true,
    showEquipment: false,
    showMarketing: true,
    showBackhaul: true,
    showFiber: true,
    showWirelessLicensed: true,
    showWirelessUnlicensed: true,
    bandFilters: [],
    statusFilter: [],
    technologyFilter: [],
    locationTypeFilter: []
  };
  
  // References
  let mapComponent: any;

  /** Voice / SIP / E911: center map when opening from service location link */
  let lastVoiceFocusKey = '';
  $: if (browser && mapComponent && !isLoading) {
    const lat = parseFloat($page.url.searchParams.get('focusLat') || '');
    const lng = parseFloat($page.url.searchParams.get('focusLng') || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      lastVoiceFocusKey = '';
    } else {
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (key !== lastVoiceFocusKey) {
        lastVoiceFocusKey = key;
        tick().then(() => {
          if (typeof mapComponent?.centerMapOnLocation === 'function') {
            mapComponent.centerMapOnLocation(lat, lng, 16).catch(() => {});
          }
        });
      }
    }
  }
  
  // Tenant info
  // In iframe context, also check localStorage for tenantId (set by parent)
  let storedTenantId: string | null = null;
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    storedTenantId = localStorage.getItem('selectedTenantId');
  }
  // Reactive tenantId - use store first, then localStorage fallback for iframe
  $: tenantId = $currentTenant?.id || (typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null) || '';
  $: tenantName = $currentTenant?.displayName || 'Organization';
  
  // Check if stats should be hidden (for plan module)
  $: hideStats = isPlanMode ? true : $page.url.searchParams.get('hideStats') === 'true';
  // Plan mode - when creating sites within a plan
  let planId: string | null = null;
  $: planId = $page.url.searchParams.get('planId') || null;
  let activePlanName: string | null = null;
  let effectivePlanId: string | null = null;
  
  let externalPlanFeatures: PlanLayerFeature[] = [];
  let externalPlanSummary: PlanFeatureSummary | null = null;
  let derivedPlanSummary: PlanFeatureSummary | null = null;
  let displayPlanSummary: PlanFeatureSummary | null = null;
  function summarizePlanFeatures(features: PlanLayerFeature[]): PlanFeatureSummary {
    const summary: PlanFeatureSummary = {
      total: features.length,
      byType: {},
      byStatus: {}
    };

    for (const feature of features) {
      const typeKey = feature.featureType || feature.properties?.featureType || 'plan';
      const statusKey = feature.status || 'draft';
      summary.byType[typeKey] = (summary.byType[typeKey] ?? 0) + 1;
      summary.byStatus[statusKey] = (summary.byStatus[statusKey] ?? 0) + 1;
    }

    return summary;
  }

  let sharedMapMode: MapModuleMode | null = null;
  let externalProductionHardware: HardwareView[] = [];
  let sharedVisibleProjects: any[] = [];
  let sharedProjectOverlays: Map<string, PlanLayerFeature[]> = new Map();
  let sharedMapStateTimestamp: Date | null = null;

  $: {
    const activePlanId = planId || sharedActivePlanId;
    const mapInPlanMode = isPlanMode || sharedMapMode === 'plan' || mapMode === 'plan';
    const readOnly = sharedCapabilities?.readOnly ?? false;
    const canAddTemporary = sharedCapabilities?.canAddTemporary ?? false;

    // Enable plan editing if:
    // 1. Not in plan mode (always enabled)
    // 2. In plan mode AND (has active plan ID OR can add temporary OR has plan features) AND not read-only
    // Check if we have plan features loaded (indicating a plan is active)
    const hasActivePlan = Boolean(activePlanId);
    const hasPlanFeatures = externalPlanFeatures.length > 0;
    
    planEditingEnabled = mapInPlanMode 
      ? ((hasActivePlan || canAddTemporary || hasPlanFeatures) && !readOnly)
      : true;
  }

  $: effectivePlanId = planId ?? sharedActivePlanId ?? null;
  $: {
    const activePlanId = getActivePlanIdForActions();
    if (activePlanId && !visiblePlanIds.includes(activePlanId)) {
      visiblePlanIds = Array.from(new Set([...visiblePlanIds, activePlanId]));
    }
  }
  $: planDraftsForMap = (externalPlanFeatures ?? []).filter(feature => {
      const featurePlanId = getFeaturePlanId(feature);
      const activePlanId = getActivePlanIdForActions();
      if (activePlanId) {
        if (!featurePlanId) {
          return true;
        }
        return featurePlanId === activePlanId;
      }
      if (visiblePlanIds.length > 0) {
        return featurePlanId ? visiblePlanIds.includes(featurePlanId) : false;
      }
      return false;
    });
  $: planDraftSitesForActions = planDraftsForMap
      .filter(feature => feature.featureType === 'site')
      .map(convertPlanDraftToTowerSite);
  $: combinedSites = [...towers, ...planDraftSitesForActions];
  $: derivedPlanSummary = summarizePlanFeatures(planDraftsForMap);
  $: displayPlanSummary = externalPlanSummary ?? derivedPlanSummary;

  function getPlanDraftCoordinates(draft: PlanLayerFeature | null): { latitude: number | null; longitude: number | null } {
    if (!draft) return { latitude: null, longitude: null };

    const original = draft.metadata?.originalGeometry;
    if (original?.coordinates?.length >= 2) {
      return { longitude: original.coordinates[0], latitude: original.coordinates[1] };
    }

    const geometry: any = draft.geometry;
    if (geometry?.coordinates?.length >= 2) {
      return { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] };
    }

    if (typeof geometry?.longitude === 'number' && typeof geometry?.latitude === 'number') {
      return { longitude: geometry.longitude, latitude: geometry.latitude };
    }

    if (typeof geometry?.x === 'number' && typeof geometry?.y === 'number') {
      return { longitude: geometry.x, latitude: geometry.y };
    }

    if (typeof draft.properties?.longitude === 'number' && typeof draft.properties?.latitude === 'number') {
      return { longitude: draft.properties.longitude, latitude: draft.properties.latitude };
    }

    return { latitude: null, longitude: null };
  }

  function getFeaturePlanId(feature: PlanLayerFeature): string | null {
    return (
      feature.planId ??
      feature.properties?.planId ??
      (feature.metadata as any)?.planId ??
      (feature.metadata as any)?.originalPlanId ??
      null
    );
  }

  function getActivePlanIdForActions(): string | null {
    return effectivePlanId;
  }

  function convertPlanDraftToTowerSite(feature: PlanLayerFeature): TowerSite {
    const coords = getPlanDraftCoordinates(feature);
    const props = feature.properties ?? {};
    const latitude =
      coords.latitude ??
      props.latitude ??
      props.location?.latitude ??
      0;
    const longitude =
      coords.longitude ??
      props.longitude ??
      props.location?.longitude ??
      0;

    return {
      id: feature.id,
      name: props.name ?? props.siteName ?? 'Draft Site',
      type: (props.siteType ?? 'tower') as TowerSite['type'],
      location: {
        latitude,
        longitude,
        address: props.address ?? props.location?.address,
        city: props.city ?? props.location?.city,
        state: props.state ?? props.location?.state,
        zipCode: props.zipCode ?? props.location?.zipCode
      },
      height: props.height,
      fccId: props.fccId,
      towerOwner: props.towerOwner,
      towerContact: props.towerContact,
      siteContact: props.siteContact,
      gateCode: props.gateCode,
      accessInstructions: props.accessInstructions,
      safetyNotes: props.safetyNotes,
      tenantId: props.tenantId ?? tenantId ?? '',
      createdAt: new Date(feature.createdAt ?? Date.now()),
      updatedAt: new Date(feature.updatedAt ?? Date.now()),
      planId: getFeaturePlanId(feature),
      planDraft: true,
      status: feature.status ?? 'draft',
      metadata: feature.metadata ?? {}
    };
  }

  function handlePlanDraftMenuAction(action: 'edit-site' | 'add-sector' | 'add-backhaul' | 'add-inventory' | 'deploy-epc' | 'deploy-hardware') {
    if (!selectedPlanDraft) {
      return;
    }

    const activePlan = getActivePlanIdForActions();
    if (!activePlan && action !== 'deploy-epc' && action !== 'deploy-hardware') {
      error = 'Select a plan to stage assets.';
      setTimeout(() => (error = ''), 4000);
      showPlanDraftMenu = false;
      return;
    }

    const draftSite = convertPlanDraftToTowerSite(selectedPlanDraft);

    switch (action) {
      case 'edit-site': {
        planDraftForSiteEdit = selectedPlanDraft;
        initialSiteType = draftSite.type;
        contextMenuLat = draftSite.location.latitude;
        contextMenuLon = draftSite.location.longitude;
        showAddSiteModal = true;
        break;
      }
      case 'add-sector': {
        selectedSiteForSector = draftSite;
        showAddSectorModal = true;
        break;
      }
      case 'add-backhaul': {
        selectedSiteForBackhaul = draftSite;
        showAddBackhaulModal = true;
        break;
      }
      case 'add-inventory': {
        selectedSiteForInventory = draftSite;
        showAddInventoryModal = true;
        break;
      }
      case 'deploy-epc': {
        // Open EPC deployment modal with site pre-selected
        selectedTowerForEPC = draftSite;
        showEPCDeploymentModal = true;
        break;
      }
      case 'deploy-hardware': {
        // Navigate to hardware deployment page with site context
        goto(`/modules/deploy?site=${encodeURIComponent(draftSite.name || draftSite.id)}&lat=${draftSite.location.latitude}&lon=${draftSite.location.longitude}`);
        break;
      }
    }

    showPlanDraftMenu = false;
  }

  function handleSiteModalClose() {
    planDraftForSiteEdit = null;
    initialSiteType = null;
  }

  $: selectedPlanDraftCoords = getPlanDraftCoordinates(selectedPlanDraft);
  $: if (selectedPlanDraft) {
      const refreshedDraft = planDraftsForMap.find(feature => feature.id === selectedPlanDraft?.id) ?? null;
      if (!refreshedDraft) {
        selectedPlanDraft = null;
        showPlanDraftMenu = false;
      } else if (refreshedDraft !== selectedPlanDraft) {
        selectedPlanDraft = refreshedDraft;
      }
    }

  onMount(async () => {
    // Check if we're in an iframe (must be done in onMount where window is available)
    isInIframe = window.parent && window.parent !== window;
    
    window.addEventListener('message', handleSharedMapMessage);
    
    if (isInIframe) {
      // Request state immediately
      window.parent.postMessage({ source: 'coverage-map', type: 'request-state' }, '*');
      
      // Check localStorage for tenantId (might have been set by parent)
      const storedTenantId = typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null;
      if (storedTenantId && !tenantId) {
        console.log('[CoverageMap] Found tenantId in localStorage from parent:', storedTenantId);
        // Use requestAnimationFrame for minimal delay instead of 500ms setTimeout
        requestAnimationFrame(async () => {
          if (tenantId || storedTenantId) {
            await loadAllData();
          }
          isLoading = false;
        });
      } else if (tenantId) {
        await loadAllData();
        isLoading = false;
      } else {
        // Wait for state-update message with tenantId
        isLoading = false;
      }
    } else {
      // Not in iframe, proceed normally
      if (tenantId) {
        await loadAllData();
      }
      isLoading = false;
    }
  });
  
  onDestroy(() => {
    window.removeEventListener('message', handleSharedMapMessage);
  });
  
  // Watch for tenant changes and plan visibility changes
  // Only reload if tenant actually changed (not on every reactive update)
  $: if (browser && tenantId && mapMode && tenantId !== lastLoadedTenantId && !isLoadingData) {
    lastLoadedTenantId = tenantId;
    loadAllData();
  }
  
  // Reload when plan visibility changes (only if planId actually changed)
  let lastPlanId: string | null = null;
  $: if (browser && planId !== null && planId !== lastPlanId && !isLoadingData) {
    lastPlanId = planId;
    loadAllData();
  }
  
  // Load devices from all sources (SNMP, TR-069, MikroTik, EPC, Network Equipment)
  async function loadAllDevices() {
    if (!tenantId) return;
    
    try {
      const user = authService.getCurrentUser();
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const devices: any[] = [];
      const seenIds = new Set<string>();
      
      // Helper to add device with deduplication
      const addDevice = (device: any, type: string) => {
        const deviceId = device.id || device._id || device.epc_id;
        if (deviceId && !seenIds.has(String(deviceId))) {
          seenIds.add(String(deviceId));
          devices.push({
            ...device,
            _deviceType: type,
            id: deviceId
          });
        }
      };
      
      // Load devices from all sources in parallel
      const [tr069Result, snmpResult, mikrotikResult, epcResult, networkEquipmentResult] = await Promise.allSettled([
        // TR-069 devices from GenieACS
        (async () => {
          try {
            const response = await fetch('/api/tr069/devices', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json'
              }
            });
            if (response.ok) {
              const data = await response.json();
              return data.success ? (data.devices || []) : [];
            }
            return [];
          } catch (e) {
            console.error('[CoverageMap] Error loading TR-069 devices:', e);
            return [];
          }
        })(),
        // SNMP devices
        (async () => {
          try {
            const { monitoringService } = await import('$lib/services/monitoringService');
            const result = await monitoringService.getSNMPDevices();
            return result.success ? (result.data?.devices || []) : [];
          } catch (e) {
            console.error('[CoverageMap] Error loading SNMP devices:', e);
            return [];
          }
        })(),
        // MikroTik devices
        (async () => {
          try {
            const { monitoringService } = await import('$lib/services/monitoringService');
            const result = await monitoringService.getMikrotikDevices();
            return result.success ? (result.data?.devices || []) : [];
          } catch (e) {
            console.error('[CoverageMap] Error loading MikroTik devices:', e);
            return [];
          }
        })(),
        // EPC devices
        (async () => {
          try {
            const { monitoringService } = await import('$lib/services/monitoringService');
            const result = await monitoringService.getEPCDevices();
            return result.success ? (result.data?.epcs || []) : [];
          } catch (e) {
            console.error('[CoverageMap] Error loading EPC devices:', e);
            return [];
          }
        })(),
        // Network equipment (already loaded as equipment array)
        Promise.resolve(equipment || [])
      ]);
      
      // Process TR-069 devices
      if (tr069Result.status === 'fulfilled') {
        tr069Result.value.forEach((device: any) => addDevice(device, 'tr069'));
      }
      
      // Process SNMP devices
      if (snmpResult.status === 'fulfilled') {
        snmpResult.value.forEach((device: any) => addDevice(device, 'snmp'));
      }
      
      // Process MikroTik devices
      if (mikrotikResult.status === 'fulfilled') {
        mikrotikResult.value.forEach((device: any) => addDevice(device, 'mikrotik'));
      }
      
      // Process EPC devices
      if (epcResult.status === 'fulfilled') {
        epcResult.value.forEach((device: any) => addDevice(device, 'epc'));
      }
      
      // Process network equipment
      if (networkEquipmentResult.status === 'fulfilled') {
        networkEquipmentResult.value.forEach((device: any) => addDevice(device, 'network-equipment'));
      }
      
      allDevices = devices;
      console.log(`[CoverageMap] Loaded ${devices.length} devices from all sources`);
    } catch (error) {
      console.error('[CoverageMap] Error loading devices:', error);
      allDevices = [];
    }
  }

  async function loadAllData() {
    // Guard against duplicate concurrent loads
    if (isLoadingData) {
      return; // Silently skip duplicate calls
    }
    
    if (!tenantId) {
      return;
    }
    
    isLoadingData = true;
    lastLoadedTenantId = tenantId;
    
    isLoading = true;
    error = '';
    
    try {
      const { planService } = await import('$lib/services/planService');

      let plans: any[] = [];
      try {
        plans = await planService.getPlans(tenantId);
      } catch (planErr) {
        console.error('Failed to load plans:', planErr);
        plans = [];
      }

      currentVisiblePlanIds = new Set(
        plans
          .filter((p: any) => p.showOnMap)
          .map((p: any) => String(p.id || p._id))
      );
      visiblePlanIds = Array.from(currentVisiblePlanIds);
      if (planId) {
        visiblePlanIds = Array.from(new Set([...visiblePlanIds, planId]));
      }
      if (sharedActivePlanId) {
        visiblePlanIds = Array.from(new Set([...visiblePlanIds, sharedActivePlanId]));
      }

      // Filter plans to only show addresses from active projects (not deployed/cancelled/rejected)
      // Deployed/cancelled/rejected projects should have addresses in permanent layer (customer leads)
      const activeProjectStatuses = ['draft', 'active', 'ready', 'approved', 'authorized'];
      
      if (isPlanMode && planId) {
        const activePlan = plans.find((p: any) => String(p.id || p._id) === planId);
        activePlanName = activePlan?.name || null;
        if (!sharedActivePlanId) {
          // Only show marketing addresses if the active plan is visible AND active (not deployed)
          const isActiveProject = activePlan && activeProjectStatuses.includes(activePlan.status);
          if (activePlan && isActiveProject && currentVisiblePlanIds.has(String(planId))) {
            const addresses = activePlan?.marketing?.addresses;
            marketingLeads = Array.isArray(addresses) ? addresses : [];
          } else {
            marketingLeads = [];
          }
        }
      } else {
        activePlanName = null;
        if (!sharedActivePlanId) {
          // Aggregate marketing addresses from all visible active plans only
          const allMarketingAddresses: any[] = [];
          plans.forEach((plan: any) => {
            const planIdStr = String(plan.id || plan._id);
            const isActiveProject = activeProjectStatuses.includes(plan.status);
            // Only include addresses from active projects (not deployed/cancelled/rejected)
            if (currentVisiblePlanIds.has(planIdStr) && isActiveProject && plan.marketing?.addresses) {
              const addresses = Array.isArray(plan.marketing.addresses) ? plan.marketing.addresses : [];
              allMarketingAddresses.push(...addresses);
            }
          });
          marketingLeads = allMarketingAddresses;
          console.log(`[CoverageMap] Loaded ${marketingLeads.length} marketing addresses from ${currentVisiblePlanIds.size} visible active plans`);
        }
      }

      const planIdsForFetch: string[] = [];
      if (isPlanMode && planId) {
        planIdsForFetch.push(planId);
      }
      if (!isPlanMode && currentVisiblePlanIds.size > 0) {
        planIdsForFetch.push(...Array.from(currentVisiblePlanIds));
      }

      // In plan mode, includePlanLayer tells the API to return both:
      // 1. Production hardware (towers/sectors/etc with planId matching)
      // 2. Plan layer features (staged features converted to production format)
      // We need this to show staged plan features in plan mode
      const includePlanLayer = planIdsForFetch.length > 0;
      const fetchOptions = includePlanLayer ? { includePlanLayer: true, planIds: planIdsForFetch } : {};

      const [
        towersResult,
        sectorsResult,
        cpeResult,
        equipmentResult
      ] = await Promise.allSettled([
        coverageMapService.getTowerSites(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load towers:', err);
          return [];
        }),
        coverageMapService.getSectors(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load sectors:', err);
          return [];
        }),
        coverageMapService.getCPEDevices(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load CPE:', err);
          return [];
        }),
        coverageMapService.getEquipment(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load equipment:', err);
          return [];
        })
      ]);

      const loadedTowers = towersResult.status === 'fulfilled' ? towersResult.value : [];
      const loadedSectors = sectorsResult.status === 'fulfilled' ? sectorsResult.value : [];
      const loadedCPE = cpeResult.status === 'fulfilled' ? cpeResult.value : [];
      const loadedEquipment = equipmentResult.status === 'fulfilled' ? equipmentResult.value : [];

      const visiblePlanIdSet = new Set(planIdsForFetch);
      currentVisiblePlanIds.forEach(id => visiblePlanIdSet.add(id));

      // In deploy mode, show all hardware regardless of planId (deployed hardware)
      const isDeployMode = sharedMapMode === 'deploy' || mapMode === 'deploy';
      
      towers = loadedTowers.filter((site: any) => {
        if (isDeployMode) return true; // Show all towers in deploy mode
        if (!site.planId) return true;
        if (isPlanMode && site.planId === planId) return true;
        return visiblePlanIdSet.has(site.planId);
      });

      sectors = loadedSectors.filter((sector: any) => {
        if (isDeployMode) return true; // Show all sectors in deploy mode
        if (!sector.planId) return true;
        if (isPlanMode && sector.planId === planId) return true;
        return visiblePlanIdSet.has(sector.planId);
      });

      cpeDevices = loadedCPE.filter((cpe: any) => {
        if (isDeployMode) return true; // Show all CPE in deploy mode
        if (!cpe.planId) return true;
        if (isPlanMode && cpe.planId === planId) return true;
        return visiblePlanIdSet.has(cpe.planId);
      });

      equipment = loadedEquipment.filter((eq: any) => {
        if (isDeployMode) return true; // Show all equipment (including backhauls) in deploy mode
        // In plan mode, filter by planId
        if (!eq.planId) return true;
        if (isPlanMode && eq.planId === planId) return true;
        return visiblePlanIdSet.has(eq.planId);
      });

      console.log('[CoverageMap] 📊 Assets loaded:', {
        towers: { loaded: loadedTowers.length, filtered: towers.length },
        sectors: { loaded: loadedSectors.length, filtered: sectors.length },
        cpe: { loaded: loadedCPE.length, filtered: cpeDevices.length },
        equipment: { loaded: loadedEquipment.length, filtered: equipment.length },
        productionHardware: externalProductionHardware.length,
        visiblePlanIds: Array.from(visiblePlanIdSet),
        isPlanMode,
        planId
      });
      
      // Explicitly refresh map data to ensure newly created objects are displayed
      // The reactive bindings should also trigger, but this ensures it happens
      if (mapComponent && typeof mapComponent.refreshMapData === 'function') {
        mapComponent.refreshMapData();
        console.log('[CoverageMap] Explicitly refreshed map data');
      } else {
        console.log('[CoverageMap] Map component not ready yet, reactive bindings will handle refresh');
      }
      
      // Load all devices from various sources for unified device management
      await loadAllDevices();
    } catch (err: any) {
      console.error('Failed to load data:', err);
      error = err.message || 'Failed to load network data';
    } finally {
      isLoading = false;
      isLoadingData = false; // Reset guard flag
    }
  }

  async function removePlanDraft() {
    if (!selectedPlanDraft) return;

    const activePlanId = effectivePlanId ?? selectedPlanDraft.planId ?? null;
    if (!activePlanId) {
      error = 'Select a plan to remove staged objects.';
      setTimeout(() => (error = ''), 4000);
      return;
    }

    try {
      await mapLayerManager.deleteFeature(activePlanId, selectedPlanDraft.id);
      success = 'Draft removed from plan.';
      setTimeout(() => (success = ''), 3000);
    } catch (err: any) {
      console.error('[CoverageMap] Failed to remove plan draft', err);
      error = err?.message || 'Failed to remove draft';
      setTimeout(() => (error = ''), 5000);
    } finally {
      showPlanDraftMenu = false;
      selectedPlanDraft = null;
    }
  }

  function closePlanDraftMenu() {
    showPlanDraftMenu = false;
    selectedPlanDraft = null;
  }
  
  function handleFiltersChange(event: CustomEvent<CoverageMapFilters>) {
    filters = event.detail;
  }
  
  function changeBasemap(basemapId: string) {
    currentBasemap = basemapId;
    if (mapComponent) {
      mapComponent.changeBasemap(basemapId);
    }
  }
  
  async function handleExportCSV() {
    const report = {
      towers,
      sectors,
      cpeDevices,
      equipment,
      generatedAt: new Date(),
      tenantName
    };
    
    const csv = reportGenerator.generateCSV(report);
    const filename = `network-equipment-${Date.now()}.csv`;
    reportGenerator.downloadCSV(csv, filename);
    
    success = 'Equipment report downloaded as CSV';
    setTimeout(() => success = '', 3000);
  }
  
  async function handleExportPDF() {
    const report = {
      towers,
      sectors,
      cpeDevices,
      equipment,
      generatedAt: new Date(),
      tenantName
    };
    
    const html = reportGenerator.generatePDFHTML(report);
    reportGenerator.printPDF(html);
    
    success = 'Opening PDF print dialog...';
    setTimeout(() => success = '', 3000);
  }
  
  async function handleImportFromCBRS() {
    const result = await coverageMapService.importFromCBRS(tenantId);
    if (result.errors.length > 0) {
      error = result.errors.join(', ');
    } else {
      success = `Imported ${result.imported} devices from CBRS module`;
      await loadAllData();
    }
    setTimeout(() => { error = ''; success = ''; }, 5000);
  }
  
  async function handleImportFromACS() {
    const result = await coverageMapService.importFromACS(tenantId);
    if (result.errors.length > 0) {
      error = result.errors.join(', ');
    } else {
      success = `Imported ${result.imported} devices from ACS module`;
      await loadAllData();
    }
    setTimeout(() => { error = ''; success = ''; }, 5000);
  }

  function handleSharedMapMessage(event: MessageEvent) {
    const { source, type, payload } = event.data || {};
    
    // Handle messages from deploy/plan modules
    if (source === 'deploy-module' || source === 'plan-module') {
      if (type === 'show-sector-menu') {
        console.log('[CoverageMap] 🔵 Received show-sector-menu message from parent:', payload);
        const { sector, screenX, screenY } = payload?.payload || payload || {};
        if (sector) {
          console.log('[CoverageMap] ✅✅✅ Opening sector menu from parent message:', { sectorName: sector.name, screenX, screenY });
          selectedSectorForMenu = sector;
          sectorMenuX = screenX || 0;
          sectorMenuY = screenY || 0;
          showSectorActionsMenu = true;
          console.log('[CoverageMap] ✅✅✅ Sector menu state set from message:', { showSectorActionsMenu, sectorMenuX, sectorMenuY });
        } else {
          console.error('[CoverageMap] ❌ No sector in show-sector-menu message');
        }
        return; // Don't process further
      }
    }
    
    if (source === 'shared-map' && type === 'state-update') {
      const state = payload?.state ?? {};
      
      // Set tenantId in localStorage if provided (for iframe context where tenant store might not be ready)
      const tenantIdFromState = payload?.tenantId;
      if (tenantIdFromState && typeof window !== 'undefined') {
        const currentStoredTenant = localStorage.getItem('selectedTenantId');
        if (currentStoredTenant !== tenantIdFromState) {
          localStorage.setItem('selectedTenantId', tenantIdFromState);
          console.log('[CoverageMap] Set tenantId from state-update:', tenantIdFromState);
        }
        
        // Update storedTenantId to trigger reactive update
        storedTenantId = tenantIdFromState;
        
        // If we're in an iframe, trigger data load now that we have tenantId
        if (window.parent && window.parent !== window) {
          console.log('[CoverageMap] Received tenantId in iframe, loading data...');
          // Use the tenantId from state to load data
          // Load immediately when tenantId is received (no delay needed)
          if (tenantIdFromState && !isLoadingData) {
            loadAllData().catch(err => {
              console.error('[CoverageMap] Failed to load data after receiving tenantId:', err);
            });
          }
        }
      }

      sharedMapMode = payload?.mode ?? state.mode ?? null;
      sharedCapabilities = state.capabilities ?? sharedCapabilities;
      externalPlanFeatures = state.stagedFeatures ?? [];
      externalPlanSummary = state.stagedSummary ?? null;
      externalProductionHardware = state.productionHardware ?? [];
      sharedVisibleProjects = state.visibleProjects ?? [];
      sharedProjectOverlays = state.projectOverlays ? new Map(state.projectOverlays) : new Map();
      sharedMapStateTimestamp = state.lastUpdated ? new Date(state.lastUpdated) : null;

      const activePlanIdFromState = state.activePlanId ?? null;
      if (activePlanIdFromState && activePlanIdFromState !== planId) {
        planId = activePlanIdFromState;
      }
      sharedActivePlanId = activePlanIdFromState;

      const inboundMarketing = state.activePlanMarketing?.addresses ?? [];
      // Only use marketing addresses if the plan is visible
      // SharedMap already filters by visibility, but double-check here for safety
      // Ensure currentVisiblePlanIds is initialized before using it
      const isPlanVisible = !activePlanIdFromState || (currentVisiblePlanIds && currentVisiblePlanIds.has(String(activePlanIdFromState)));
      marketingLeads = (isPlanVisible && Array.isArray(inboundMarketing)) ? [...inboundMarketing] : [];
      // Marketing leads logging removed - was too verbose in console
    } else if (source === 'shared-map' && type === 'center-map') {
      // Handle center-map message from parent
      const { lat, lon, zoom, features } = payload || {};
      
      if (mapComponent) {
        if (features && Array.isArray(features) && features.length > 0) {
          mapComponent.centerMapOnFeatures(features).catch((err: any) => {
            console.warn('[CoverageMap] Failed to center on features:', err);
          });
        } else if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
          mapComponent.centerMapOnLocation(lat, lon, zoom).catch((err: any) => {
            console.warn('[CoverageMap] Failed to center on location:', err);
          });
        }
      } else {
        console.warn('[CoverageMap] Map component not ready for centering');
      }
    } else if (source === 'deploy-module' && type === 'show-sector-menu') {
      // Handle show-sector-menu message from deploy module (fallback)
      console.log('[CoverageMap] 🔵 Received show-sector-menu message:', payload);
      const { sector, screenX, screenY } = payload || {};
      if (sector) {
        selectedSectorForMenu = sector;
        sectorMenuX = screenX || 0;
        sectorMenuY = screenY || 0;
        showSectorActionsMenu = true;
        console.log('[CoverageMap] ✅✅✅ Sector menu opened via message:', { showSectorActionsMenu, sectorName: sector.name });
      }
    } else if (source === 'plan-page') {
      // Handle messages from plan page
      if (type === 'visibility-changed') {
        // Reload all data to reflect visibility changes (only if not already loading)
        if (!isLoadingData) {
          loadAllData().catch(err => {
            console.error('[CoverageMap] Failed to reload after visibility change:', err);
          });
        }
      } else if (type === 'enable-rectangle-drawing') {
        if (mapComponent) {
          console.log('[CoverageMap] Enabling rectangle drawing...');
          mapComponent.enableRectangleDrawing().catch((err: any) => {
            console.error('[CoverageMap] Failed to enable rectangle drawing:', err);
          });
        } else {
          console.warn('[CoverageMap] Map component not ready for rectangle drawing');
          // Try again after a short delay
          setTimeout(() => {
            if (mapComponent) {
              mapComponent.enableRectangleDrawing().catch((err: any) => {
                console.error('[CoverageMap] Failed to enable rectangle drawing (retry):', err);
              });
            }
          }, 500);
        }
      } else if (type === 'disable-rectangle-drawing') {
        if (mapComponent) {
          console.log('[CoverageMap] Disabling rectangle drawing...');
          mapComponent.disableRectangleDrawing(true).catch((err: any) => {
            console.error('[CoverageMap] Failed to disable rectangle drawing:', err);
          });
        }
      } else if (type === 'clear-drawing-graphics') {
        if (mapComponent) {
          console.log('[CoverageMap] Clearing drawing graphics...');
          mapComponent.clearDrawingGraphics();
        }
      } else if (type === 'layer-filters-changed') {
        // Handle layer filter updates from plan page
        const planFilters = event.data.detail;
        if (planFilters && mapComponent) {
          // Map plan layer filters to coverage map filters
          filters.showMarketing = planFilters.showMarketing ?? filters.showMarketing;
          filters.showBackhaul = planFilters.showBackhaul ?? filters.showBackhaul;
          // Plan features visibility is handled via setPlanFeaturesVisibility
          if (typeof planFilters.showPlanFeatures === 'boolean') {
            mapComponent.setPlanFeaturesVisibility(planFilters.showPlanFeatures);
          }
          // Network assets map to towers, sectors, CPE, equipment
          if (planFilters.showNetworkAssets === false) {
            filters.showTowers = false;
            filters.showSectors = false;
            filters.showCPE = false;
            filters.showEquipment = false;
          } else if (planFilters.showNetworkAssets === true) {
            // Only enable if they were previously enabled (don't force enable)
            // This preserves user's individual asset type preferences
          }
          
          mapComponent.setFilters(filters);
          console.log('[CoverageMap] Layer filters updated from plan page:', filters);
        }
      }
    }
  }
  
  function handleMapRightClick(event: CustomEvent) {
    const { latitude, longitude, screenX, screenY } = event.detail;
    // console.log('Right-click at:', latitude, longitude);

    showPlanDraftMenu = false;
    selectedPlanDraft = null;

    if ((isPlanMode || sharedMapMode === 'plan') && !planEditingEnabled) {
      showContextMenu = false;
      if (!error) {
        error = 'Start a plan to add sites or hardware.';
        setTimeout(() => error = '', 4000);
      }
      return;
    }
    
    // Show context menu
    showContextMenu = true;
    contextMenuX = screenX;
    contextMenuY = screenY;
    contextMenuLat = latitude;
    contextMenuLon = longitude;
  }
  
  function handleContextMenuAction(event: CustomEvent) {
    const { action, latitude, longitude } = event.detail;
    
    contextMenuLat = latitude;
    contextMenuLon = longitude;

    if ((isPlanMode || sharedMapMode === 'plan') && !planEditingEnabled) {
      showContextMenu = false;
      return;
    }
    
    switch (action) {
      case 'create-site-tower':
        initialSiteType = 'tower';
        showAddSiteModal = true;
        break;
      case 'create-site-noc':
        initialSiteType = 'noc';
        showAddSiteModal = true;
        break;
      case 'create-site-warehouse':
        initialSiteType = 'warehouse';
        showAddSiteModal = true;
        break;
      case 'create-site-other':
        initialSiteType = 'other';
        showAddSiteModal = true;
        break;
      case 'create-sector':
        // Create sector at clicked location (need to select site first)
        // For now, just show add sector modal
        showAddSectorModal = true;
        break;
      case 'create-cpe':
        showAddCPEModal = true;
        break;
      case 'copy-coords':
        if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
          navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          success = 'Coordinates copied to clipboard';
          setTimeout(() => success = '', 3000);
        } else {
          error = 'Invalid coordinates';
          setTimeout(() => error = '', 3000);
        }
        break;
    }
    
    showContextMenu = false;
  }
  
  async function handlePlanFeatureMoved(event: CustomEvent<{
    featureId: string;
    planId?: string | null;
    geometry: PlanFeatureGeometry;
    latitude: number;
    longitude: number;
  }>) {
    const { featureId, planId: featurePlanId, geometry, latitude, longitude } = event.detail;
    const activePlanId = effectivePlanId ?? featurePlanId ?? null;

    if (!activePlanId) {
      error = 'Select a plan to edit staged objects.';
      setTimeout(() => (error = ''), 4000);
      return;
    }

    const draft = planDraftsForMap.find(feature => feature.id === featureId) ?? null;
    const propertiesUpdate = draft
      ? {
          ...draft.properties,
          latitude,
          longitude
        }
      : { latitude, longitude };

    const coordinates =
      Array.isArray((geometry as any)?.coordinates) && (geometry as any).coordinates.length >= 2
        ? (geometry as any).coordinates
        : [longitude, latitude];

    const geometryUpdate: PlanFeatureGeometry = {
      type: 'Point',
      coordinates
    };

    try {
      await mapLayerManager.updateFeature(activePlanId, featureId, {
        geometry: geometryUpdate,
        properties: propertiesUpdate
      });
      success = 'Draft location updated.';
      setTimeout(() => (success = ''), 3000);
      showPlanDraftMenu = false;
    } catch (err: any) {
      console.error('[CoverageMap] Failed to update plan draft location', err);
      error = err?.message || 'Failed to update draft location';
      setTimeout(() => (error = ''), 5000);
    }
  }

  function handleAssetClick(event: CustomEvent) {
    const { type, id, data, screenX, screenY, isRightClick } = event.detail;
    console.log('[CoverageMap] 🔵 handleAssetClick called:', { type, id, isRightClick, hasData: !!data });

    if (!type?.startsWith('plan-')) {
      showPlanDraftMenu = false;
      selectedPlanDraft = null;
    }

    const planningMode = isPlanMode || sharedMapMode === 'plan';
    if (planningMode && !planEditingEnabled && isRightClick) {
      console.log('[CoverageMap] Planning mode but editing not enabled');
      if (!error) {
        error = 'Start a plan to edit or deploy assets.';
        setTimeout(() => error = '', 4000);
      }
      return;
    }

    if (type?.startsWith('plan-')) {
      const draft = planDraftsForMap.find(feature => feature.id === id) ?? null;
      if (!draft) {
        return;
      }

      if (isRightClick) {
        selectedPlanDraft = draft;
        planDraftMenuX = screenX;
        planDraftMenuY = screenY;
        showPlanDraftMenu = true;
      } else {
        success = `${draft.featureType?.toUpperCase() ?? 'Draft'} selected`;
        setTimeout(() => (success = ''), 3000);
      }
      return;
    }
    
    // Check if this is a read-only item from ACS or CBRS
    if (data?.modules?.acs || data?.modules?.cbrs) {
      success = `This ${type} is managed by the ${data.modules.acs ? 'ACS' : 'CBRS'} module (read-only)`;
      setTimeout(() => success = '', 5000);
      return;
    }
    
    // Only show menu for right-clicks
    if (isRightClick) {
      console.log('[CoverageMap] 🔵 Right-click detected, type:', type);
      
      if (type === 'tower' || type === 'noc' || type === 'warehouse') {
        const tower = towers.find(t => t.id === id);
        if (tower && tower.id) {
          // console.log('[CoverageMap] Opening tower actions menu', { tower, id, towerId: tower.id });
          selectedTowerForMenu = tower;
          towerMenuX = screenX;
          towerMenuY = screenY;
          showTowerActionsMenu = true;
        } else {
          console.error('[CoverageMap] Tower not found or missing id', { id, tower, towers });
        }
      } else if (type === 'sector') {
        console.log('[CoverageMap] 🔵🔵🔵 Right-click on sector detected:', { 
          id, 
          type, 
          sectorsCount: sectors.length, 
          sectors: sectors.map(s => ({ id: s.id, _id: (s as any)._id, name: s.name })),
          searchingFor: id,
          idType: typeof id
        });
        
        // Try multiple ways to find the sector
        let sector = sectors.find(s => s.id === id);
        if (!sector) {
          sector = sectors.find(s => (s as any)._id === id);
        }
        if (!sector) {
          sector = sectors.find(s => String(s.id) === String(id));
        }
        if (!sector) {
          sector = sectors.find(s => String((s as any)._id) === String(id));
        }
        
        if (sector) {
          console.log('[CoverageMap] ✅✅✅ Found sector for menu:', { 
            sector, 
            id: sector.id, 
            _id: (sector as any)._id,
            name: sector.name
          });
          selectedSectorForMenu = sector;
          sectorMenuX = screenX;
          sectorMenuY = screenY;
          showSectorActionsMenu = true;
          console.log('[CoverageMap] ✅✅✅ Sector menu state set:', { 
            showSectorActionsMenu, 
            sectorMenuX, 
            sectorMenuY,
            hasSector: !!selectedSectorForMenu,
            sectorName: selectedSectorForMenu?.name
          });
          
          // Force reactivity update
          setTimeout(() => {
            console.log('[CoverageMap] ✅✅✅ After timeout - Sector menu state:', { 
              showSectorActionsMenu, 
              hasSector: !!selectedSectorForMenu 
            });
          }, 100);
        } else {
          console.error('[CoverageMap] ❌❌❌ Sector not found:', { 
            id, 
            type, 
            idType: typeof id,
            availableSectorIds: sectors.map(s => ({ 
              id: s.id, 
              _id: (s as any)._id, 
              name: s.name,
              idString: String(s.id),
              _idString: String((s as any)._id)
            }))
          });
        }
      } else if (type === 'cpe') {
        const cpe = cpeDevices.find(c => c.id === id);
        if (cpe) {
          success = `CPE: ${data.name || 'Unknown'} - Right-click for options`;
          setTimeout(() => success = '', 3000);
        }
      } else if (type === 'equipment') {
        const eq = equipment.find(e => e.id === id);
        if (eq) {
          success = `Equipment: ${data.name || 'Unknown'} - Right-click for options`;
          setTimeout(() => success = '', 3000);
        }
      } else if (type === 'backhaul') {
        console.log('[CoverageMap] 🔵🔵🔵 Right-click on backhaul detected:', { 
          id, 
          type, 
          equipmentCount: equipment.length, 
          equipmentIds: equipment.map(eq => ({ id: eq.id, _id: (eq as any)._id, type: eq.type, name: eq.name })),
          searchingFor: id,
          idType: typeof id,
          dataFromEvent: data
        });
        
        // Try multiple ways to find the backhaul (similar to sectors)
        let backhaulEquipment = equipment.find(eq => eq.id === id && eq.type === 'backhaul');
        if (!backhaulEquipment) {
          backhaulEquipment = equipment.find(eq => (eq as any)._id === id && eq.type === 'backhaul');
        }
        if (!backhaulEquipment) {
          backhaulEquipment = equipment.find(eq => String(eq.id) === String(id) && eq.type === 'backhaul');
        }
        if (!backhaulEquipment) {
          backhaulEquipment = equipment.find(eq => String((eq as any)._id) === String(id) && eq.type === 'backhaul');
        }
        
        // If still not found and we have data from the event, try to construct it
        if (!backhaulEquipment && data && isRightClick) {
          console.log('[CoverageMap] ⚠️ Backhaul not found in equipment array, using event data:', data);
          // Use the data from the event to create a backhaul object
          backhaulEquipment = {
            id: data.id || id,
            name: data.name || 'Unknown Backhaul',
            type: 'backhaul' as const,
            location: data.location || { latitude: 0, longitude: 0 },
            locationType: 'tower' as const,
            manufacturer: data.equipmentManufacturer || '',
            model: data.equipmentModel || '',
            serialNumber: data.equipmentSerialNumber || '',
            status: data.status || 'active' as const,
            tenantId: data.tenantId || tenantId || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data
          } as NetworkEquipment;
        }
        
        if (backhaulEquipment && isRightClick) {
          console.log('[CoverageMap] ✅✅✅ Found backhaul for menu:', { 
            backhaul: backhaulEquipment, 
            id: backhaulEquipment.id, 
            _id: (backhaulEquipment as any)._id,
            name: backhaulEquipment.name,
            type: backhaulEquipment.type
          });
          selectedBackhaulForMenu = backhaulEquipment;
          backhaulMenuX = screenX;
          backhaulMenuY = screenY;
          showBackhaulActionsMenu = true;
          console.log('[CoverageMap] ✅✅✅ Backhaul menu state set:', { 
            showBackhaulActionsMenu, 
            backhaulMenuX, 
            backhaulMenuY,
            hasBackhaul: !!selectedBackhaulForMenu
          });
        } else if (!isRightClick) {
          success = `Backhaul Link: ${data?.name || 'Unknown'}`;
          setTimeout(() => success = '', 3000);
        } else {
          console.error('[CoverageMap] ❌❌❌ Backhaul not found:', { 
            id, 
            type, 
            idType: typeof id,
            availableBackhaulIds: equipment
              .filter(eq => eq.type === 'backhaul')
              .map(eq => ({ 
                id: eq.id, 
                _id: (eq as any)._id, 
                name: eq.name,
                idString: String(eq.id),
                _idString: String((eq as any)._id)
              }))
          });
          success = `Backhaul Link: ${data?.name || 'Unknown'} - Right-click for options`;
          setTimeout(() => success = '', 3000);
        }
      } else {
        console.warn('[CoverageMap] ⚠️ Unknown asset type for right-click:', type);
      }
    } else {
      console.log('[CoverageMap] Left-click on asset:', type, id);
    }
  }
  
  function handleSectorAction(event: CustomEvent) {
    const { action, sector } = event.detail;
    
    console.log('[CoverageMap] handleSectorAction called', { action, sector, hasSector: !!sector });
    
    if (!sector) {
      console.error('❌ Sector action called without sector');
      return;
    }
    
    switch (action) {
      case 'add-sector':
        // Add new sector to the same site as this sector
        console.log('[CoverageMap] Add sector to site:', sector);
        if (sector) {
          // Find the site for this sector
          const site = towers.find(t => t.id === sector.siteId || String(t.id) === String(sector.siteId));
          selectedSiteForSector = site || null;
          selectedSectorForEdit = null; // Clear any sector being edited
          showAddSectorModal = true;
          console.log('[CoverageMap] Opening AddSectorModal for adding new sector to site:', site?.name);
        }
        break;
      case 'edit-sector':
        // Open sector edit modal (use AddSectorModal in edit mode)
        console.log('[CoverageMap] Edit sector:', sector);
        if (sector) {
          // Find the site for this sector
          const site = towers.find(t => t.id === sector.siteId || String(t.id) === String(sector.siteId));
          selectedSiteForSector = site || null;
          // Set the sector to edit - AddSectorModal will pre-fill the form
          selectedSectorForEdit = sector;
          showAddSectorModal = true;
          console.log('[CoverageMap] Opening AddSectorModal for editing sector:', sector.name);
        }
        break;
      case 'view-sector-details':
        // View details opens the same modal as edit (combined functionality)
        console.log('[CoverageMap] View sector details (opening edit modal):', sector);
        if (sector) {
          // Find the site for this sector
          const site = towers.find(t => t.id === sector.siteId || String(t.id) === String(sector.siteId));
          selectedSiteForSector = site || null;
          // Set the sector to edit - AddSectorModal will show details and allow editing
          selectedSectorForEdit = sector;
          showAddSectorModal = true;
          console.log('[CoverageMap] Opening AddSectorModal for viewing/editing sector:', sector.name);
        }
        break;
      case 'delete-sector':
        if (confirm(`Are you sure you want to delete sector "${sector.name}"?`)) {
          coverageMapService.deleteSector(tenantId, sector.id)
            .then(() => {
              success = `Sector "${sector.name}" deleted`;
              setTimeout(() => success = '', 3000);
              loadAllData(); // Reload all data to refresh the map
            })
            .catch((err: any) => {
              error = `Failed to delete sector: ${err.message}`;
              setTimeout(() => error = '', 5000);
            });
        }
        break;
      default:
        console.warn(`[CoverageMap] Unknown sector action: ${action}`);
    }
  }
  
  function handleTowerAction(event: CustomEvent) {
    const { action, tower } = event.detail;
    
    console.log('[CoverageMap] handleTowerAction called', { action, tower, hasTower: !!tower });
    
    // Guard: ensure tower exists
    if (!tower && action !== 'add-site') {
      console.error('❌ Tower action called without tower');
      return;
    }
    
    switch (action) {
      case 'edit-site':
        if (tower) {
          selectedSiteForEdit = tower;
          showSiteEditModal = true;
        }
        break;
      case 'add-sector':
        selectedSiteForSector = tower;
        showAddSectorModal = true;
        break;
      case 'add-backhaul':
        selectedSiteForBackhaul = tower;
        showAddBackhaulModal = true;
        break;
      case 'add-inventory':
        selectedSiteForInventory = tower;
        showAddInventoryModal = true;
        break;
      case 'view-inventory':
        if (tower) {
          // Check if we're in deploy/plan mode (embedded in iframe)
          const isIframe = typeof window !== 'undefined' && window.parent && window.parent !== window;
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          // Use reactive variables from component scope
          const checkDeployMode = isDeployMode || urlParams?.get('deployMode') === 'true' || urlParams?.get('mode') === 'deploy';
          const checkPlanMode = isPlanMode || urlParams?.get('planMode') === 'true' || urlParams?.get('mode') === 'plan';
          const isEmbedded = isIframe || checkDeployMode || checkPlanMode;
          
          console.log('[CoverageMap] Handling view-inventory action', { 
            tower, 
            isIframe, 
            checkDeployMode, 
            checkPlanMode, 
            isEmbedded,
            hasParent: typeof window !== 'undefined' && !!window.parent,
            url: typeof window !== 'undefined' ? window.location.href : 'N/A'
          });
          
          // If embedded (iframe or deploy/plan mode), ALWAYS send to parent and NEVER navigate
          if (isEmbedded) {
            // Send message to parent in the format expected by iframeCommunicationService
            const message = {
              source: 'coverage-map', // Add source to help message routing
              type: 'object-action',
              objectId: tower.id,
              action: 'view-inventory',
              data: { tower }
            };
            console.log('[CoverageMap] 🔵 Embedded mode detected - sending message to parent:', message);
            
            if (typeof window !== 'undefined' && window.parent) {
              try {
                // Send message - SharedMap will handle calling the global handler
                // Don't try to access window.parent directly due to cross-origin restrictions
                console.log('[CoverageMap] Sending message to parent (SharedMap will handle)');
                
                // Send to parent window - SharedMap will handle calling the global handler
                window.parent.postMessage(message, '*');
                console.log('[CoverageMap] ✅ Sent view-inventory message to parent');
                
                // Also try sending to top window in case of nested iframes
                if (window.top && window.top !== window.parent) {
                  console.log('[CoverageMap] 🔵 Also sending to top window');
                  window.top.postMessage(message, '*');
                }
                // DO NOT navigate - we're in embedded mode, parent will handle it
                return; // Exit early to prevent navigation
              } catch (err) {
                console.error('[CoverageMap] ❌ Failed to send message to parent:', err);
                // Even if message fails, don't navigate in embedded mode
                return;
              }
            } else {
              console.warn('[CoverageMap] ⚠️ Embedded mode but no window.parent available');
              // Don't navigate in embedded mode even if parent is unavailable
              return;
            }
          }
          
          // Standalone mode - navigate to inventory (only if NOT embedded)
          console.log('[CoverageMap] Standalone mode - navigating to inventory');
          goto(`/modules/inventory?siteId=${tower.id}&siteName=${encodeURIComponent(tower.name)}`);
        }
        break;
      case 'deploy-hardware':
        if (!tower) {
          console.error('deploy-hardware action called without tower');
          return;
        }
        
        console.log('[CoverageMap] 🔧 Setting up HardwareDeploymentModal:', { towerName: tower.name, towerId: tower.id, hasTower: !!tower });
        selectedTowerForEPC = tower;
        showHardwareDeploymentModal = true;
        console.log('[CoverageMap] 🔧 HardwareDeploymentModal state set:', { show: showHardwareDeploymentModal, selectedTower: selectedTowerForEPC?.name });
        break;
      case 'change-site-type':
        // Change site type via edit modal
        if (tower) {
          console.log('[CoverageMap] change-site-type action triggered for tower:', tower.id, tower.name);
          // If in iframe (deploy/plan mode), dispatch action to parent
          if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            // Send message to parent in the format expected by iframeCommunicationService
            window.parent.postMessage({
              type: 'object-action',
              objectId: tower.id,
              action: 'change-site-type',
              data: { tower }
            }, '*');
            console.log('[CoverageMap] Sent change-site-type action to parent', { objectId: tower.id });
          } else {
            // Standalone mode - open edit modal
            console.log('[CoverageMap] Opening SiteEditModal for change-site-type', { towerId: tower.id, towerName: tower.name, towerType: tower.type });
            selectedSiteForEdit = { ...tower }; // Create a copy to ensure reactivity
            showSiteEditModal = true;
            console.log('[CoverageMap] SiteEditModal state:', { show: showSiteEditModal, hasSite: !!selectedSiteForEdit });
          }
        } else {
          console.error('[CoverageMap] change-site-type action called but tower is null/undefined');
        }
        break;
      case 'view-details':
        if (tower) {
          // If in iframe (deploy/plan mode), dispatch action to parent
          if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            // Send message to parent in the format expected by iframeCommunicationService
            window.parent.postMessage({
              type: 'object-action',
              objectId: tower.id,
              action: 'view-details',
              data: { tower }
            }, '*');
            console.log('[CoverageMap] Sent view-details action to parent', { objectId: tower.id, tower });
          } else {
            // Standalone mode - just show message
            success = `Viewing ${tower.name}`;
            setTimeout(() => success = '', 3000);
          }
        }
        break;
      case 'delete-site':
        if (tower && confirm(`Delete ${tower.name}?`)) {
          deleteTowerSite(tower.id);
        }
        break;
    }
  }
  
  async function deleteTowerSite(siteId: string) {
    try {
      await coverageMapService.deleteTowerSite(tenantId, siteId);
      success = 'Tower site deleted';
      setTimeout(() => success = '', 3000);
      await loadAllData();
      
      // Trigger refresh in monitoring module
      if (typeof window !== 'undefined') {
        localStorage.setItem('monitoring-refresh-needed', 'true');
        // Also trigger storage event for other tabs
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'monitoring-refresh-needed',
          newValue: 'true',
          storageArea: localStorage
        }));
      }
    } catch (err: any) {
      error = err.message || 'Failed to delete site';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function handleAddSite() {
    planDraftForSiteEdit = null;
    // Use map center if available, otherwise null
    contextMenuLat = mapComponent?.mapView?.center?.latitude ?? null;
    contextMenuLon = mapComponent?.mapView?.center?.longitude ?? null;
    initialSiteType = null;
    showAddSiteModal = true;
  }
  
  function handleAddSector(site: TowerSite | null = null) {
    planDraftForSiteEdit = null;
    selectedSiteForSector = site;
    selectedSectorForEdit = null; // Clear any sector being edited
    showAddSectorModal = true;
  }
  
  function handleSectorModalSaved() {
    selectedSectorForEdit = null; // Clear after save
    handleModalSaved();
  }
  
  function handleBackhaulAction(event: CustomEvent) {
    const { action, backhaul } = event.detail;
    
    console.log('[CoverageMap] handleBackhaulAction called', { action, backhaul, hasBackhaul: !!backhaul });
    
    if (!backhaul) {
      console.error('❌ Backhaul action called without backhaul');
      return;
    }
    
    switch (action) {
      case 'add-backhaul':
        // Add new backhaul
        console.log('[CoverageMap] Add backhaul');
        selectedBackhaulForEdit = null; // Clear any backhaul being edited
        showAddBackhaulModal = true;
        console.log('[CoverageMap] Opening AddBackhaulLinkModal for adding new backhaul');
        break;
      case 'edit-backhaul':
        // Open backhaul edit modal
        console.log('[CoverageMap] Edit backhaul:', backhaul);
        if (backhaul) {
          selectedBackhaulForEdit = backhaul;
          showAddBackhaulModal = true;
          console.log('[CoverageMap] Opening AddBackhaulLinkModal for editing backhaul:', backhaul.name);
        }
        break;
      case 'delete-backhaul':
        // Delete backhaul
        console.log('[CoverageMap] Delete backhaul:', backhaul);
        if (confirm(`Are you sure you want to delete backhaul "${backhaul.name}"?`)) {
          deleteBackhaul(backhaul.id || (backhaul as any)._id);
        }
        break;
      default:
        console.warn('[CoverageMap] Unknown backhaul action:', action);
    }
  }
  
  async function deleteBackhaul(backhaulId: string) {
    try {
      await coverageMapService.deleteEquipment(tenantId, backhaulId);
      success = 'Backhaul deleted successfully.';
      setTimeout(() => success = '', 3000);
      await loadAllData();
    } catch (err: any) {
      console.error('[CoverageMap] Failed to delete backhaul:', err);
      error = err?.message || 'Failed to delete backhaul';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function handleBackhaulModalSaved() {
    selectedBackhaulForEdit = null; // Clear after save
    handleModalSaved();
  }
  
  function handleAddCPE() {
    planDraftForSiteEdit = null;
    // Use map center if available, otherwise null
    contextMenuLat = mapComponent?.mapView?.center?.latitude ?? null;
    contextMenuLon = mapComponent?.mapView?.center?.longitude ?? null;
    showAddCPEModal = true;
  }
  
  async function handleModalSaved(event?: CustomEvent<{ message?: string }>) {
    success = event?.detail?.message || 'Changes saved to plan.';
    setTimeout(() => success = '', 3000);
    planDraftForSiteEdit = null;
    initialSiteType = null;
    
    try {
      // Reload all data to show newly created sectors, sites, etc.
      await loadAllData();
      
      // Refresh plan features if in plan mode
      if (effectivePlanId && (isPlanMode || sharedMapMode === 'plan')) {
        await mapLayerManager.refreshPlan(effectivePlanId);
      }
      
      // Explicitly refresh map data to ensure newly created objects are displayed
      // This is a safeguard in case the reactive statement doesn't trigger properly
      if (mapComponent && typeof mapComponent.refreshMapData === 'function') {
        mapComponent.refreshMapData();
        console.log('[CoverageMap] Explicitly refreshed map after modal save');
      }
    } catch (err: any) {
      console.error('Error refreshing data after modal save:', err);
      error = err?.message || 'Unable to refresh map data.';
      setTimeout(() => error = '', 4000);
    }
  }
</script>

<svelte:window onclick={() => showPlanDraftMenu && closePlanDraftMenu()} />

<TenantGuard>
<div class="fullscreen-map">
  <!-- Full Screen Map -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading network assets...</p>
    </div>
  {:else}
    <CoverageMapView
      bind:this={mapComponent}
      {towers}
      {sectors}
      {cpeDevices}
      {equipment}
      {filters}
      externalPlanFeatures={planDraftsForMap}
      {marketingLeads}
      projectOverlays={sharedProjectOverlays}
      on:map-right-click={handleMapRightClick}
      on:asset-click={handleAssetClick}
      on:plan-feature-moved={handlePlanFeatureMoved}
    />
  {/if}

  {#if showPlanDraftMenu && selectedPlanDraft}
    <div
      class="plan-draft-menu"
      style="left: {planDraftMenuX}px; top: {planDraftMenuY}px"
      onclick={(e) => e.stopPropagation()}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <div class="menu-header">
        <strong>{selectedPlanDraft.properties?.name ?? selectedPlanDraft.featureType ?? 'Draft Object'}</strong>
        <small>Status: {selectedPlanDraft.status ?? 'draft'}</small>
      </div>
      <div class="menu-body">
        <p>Drag the marker to refine this deployment location.</p>
        <p class="coords">
          📍
          {selectedPlanDraftCoords.latitude != null && typeof selectedPlanDraftCoords.latitude === 'number' ? selectedPlanDraftCoords.latitude.toFixed(7) : '—'},
          {selectedPlanDraftCoords.longitude != null && typeof selectedPlanDraftCoords.longitude === 'number' ? selectedPlanDraftCoords.longitude.toFixed(7) : '—'}
        </p>
      </div>
      <button class="menu-item" onclick={() => handlePlanDraftMenuAction('edit-site')}>
        ✏️ Edit Draft Details
      </button>
      <button class="menu-item" onclick={() => handlePlanDraftMenuAction('add-sector')}>
        📶 Add Sector
      </button>
      <button class="menu-item" onclick={() => handlePlanDraftMenuAction('add-backhaul')}>
        🔗 Add Backhaul Link
      </button>
      <button class="menu-item" onclick={() => handlePlanDraftMenuAction('add-inventory')}>
        📦 Add Equipment
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item deploy-hardware" onclick={() => handlePlanDraftMenuAction('deploy-epc')}>
        📡 Deploy EPC/SNMP Server
      </button>
      <button class="menu-item" onclick={() => handlePlanDraftMenuAction('deploy-hardware')}>
        🔧 Deploy Other Hardware
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item danger" onclick={removePlanDraft}>
        🗑️ Remove From Plan
      </button>
      <button class="menu-item" onclick={closePlanDraftMenu}>
        ✕ Close
      </button>
    </div>
  {/if}

  <!-- Floating Control Panel -->
  <div class="floating-controls">
    {#if !isDeployMode}
      <button class="control-btn" onclick={() => showFilters = !showFilters} title="Toggle Filters">
        🔍
      </button>
    {/if}
    {#if !hideStats}
      <button class="control-btn" onclick={() => showStats = !showStats} title="Toggle Statistics">
        📊
      </button>
    {/if}
    <button 
      class="control-btn" 
      onclick={() => showDevicePanel = !showDevicePanel} 
      title="Device Management (SNMP, TR-069, MikroTik, EPC)"
      class:active={showDevicePanel}
    >
      📱
    </button>
    
    <!-- Map Type Toggle -->
    <div class="control-group">
      <button class="control-btn map-control-btn" title="Toggle Map Type">
        🗺️
      </button>
      <div class="control-dropdown">
        <div class="dropdown-section">
          <div class="dropdown-label">Map View</div>
          <div class="basemap-switcher-inline">
            <button 
              class="basemap-btn-inline" 
              class:active={currentBasemap === 'streets-vector'}
              onclick={() => changeBasemap('streets-vector')}
              title="Streets"
            >
              🛣️
            </button>
            <button 
              class="basemap-btn-inline" 
              class:active={currentBasemap === 'hybrid'}
              onclick={() => changeBasemap('hybrid')}
              title="Satellite"
            >
              🛰️
            </button>
            <button 
              class="basemap-btn-inline" 
              class:active={currentBasemap === 'topo-vector'}
              onclick={() => changeBasemap('topo-vector')}
              title="Topographic"
            >
              🗺️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Help Button - Fixed Position -->
  <button class="help-button" onclick={() => showHelpModal = true} aria-label="Open Help" title="Help">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  </button>

  {#if displayPlanSummary && (() => {
    // In deploy mode, only show if a plan is being worked on (has objects)
    if (isDeployMode || sharedMapMode === 'deploy') {
      return displayPlanSummary.total > 0;
    }
    // In plan mode, always show
    return isPlanMode || sharedMapMode === 'plan';
  })()}
    <div class="plan-summary-card">
      <div class="plan-summary-header">
        <span>Plan Drafts</span>
        {#if sharedMapStateTimestamp}
          <small>Updated {sharedMapStateTimestamp.toLocaleTimeString()}</small>
        {/if}
      </div>
      <div class="plan-summary-total">{displayPlanSummary.total} objects</div>
      <div class="plan-summary-grid">
        {#each Object.entries(displayPlanSummary.byType ?? {}) as [type, count]}
          <div class="plan-summary-item">
            <span class="label">{type}</span>
            <span class="value">{count}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}



  <!-- Filters Modal -->
  {#if showFilters && !isDeployMode}
  <div class="modal-overlay" onclick={() => showFilters = false}>
    <div class="modal-content filters-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>🔍 Map Filters</h3>
        <button class="close-btn" onclick={() => showFilters = false}>✕</button>
      </div>
      <div class="modal-body">
        <FilterPanel {filters} on:change={handleFiltersChange} />
      </div>
    </div>
  </div>
  {/if}

  <!-- Statistics Modal -->
  {#if showStats && !hideStats}
  <div class="modal-overlay" onclick={() => showStats = false}>
    <div class="modal-content stats-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>📊 Network Statistics</h3>
        <button class="close-btn" onclick={() => showStats = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📡</div>
            <div class="stat-content">
              <div class="stat-value">{towers.length}</div>
              <div class="stat-label">Tower Sites</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📶</div>
            <div class="stat-content">
              <div class="stat-value">{sectors.length}</div>
              <div class="stat-label">Sectors</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📱</div>
            <div class="stat-content">
              <div class="stat-value">{cpeDevices.length}</div>
              <div class="stat-label">CPE Devices</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🔧</div>
            <div class="stat-content">
              <div class="stat-value">{equipment.length}</div>
              <div class="stat-label">Equipment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Messages -->
  {#if error}
    <div class="message-banner error">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" onclick={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="message-banner success">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" onclick={() => success = ''}>✕</button>
    </div>
  {/if}
</div>

<!-- Unified Device Management -->
<DeviceManagementPanel
  bind:show={showDevicePanel}
  devices={allDevices}
  on:deviceSelected={(e) => {
    selectedDevice = e.detail.device;
    selectedDeviceType = e.detail.deviceType;
    showUnifiedDeviceModal = true;
  }}
  on:close={() => showDevicePanel = false}
/>

<UnifiedDeviceDetailsModal
  bind:show={showUnifiedDeviceModal}
  device={selectedDevice}
  deviceType={selectedDeviceType}
  on:close={() => {
    showUnifiedDeviceModal = false;
    selectedDevice = null;
  }}
/>

<!-- Modals -->
<AddSiteModal 
  bind:show={showAddSiteModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  initialType={initialSiteType}
  planId={effectivePlanId}
  {tenantId}
  existingDraft={planDraftForSiteEdit}
  on:saved={handleModalSaved}
  on:close={handleSiteModalClose}
/>

<AddNOCModal 
  bind:show={showAddNOCModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddWarehouseModal 
  bind:show={showAddWarehouseModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddVehicleModal 
  bind:show={showAddVehicleModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddRMAModal 
  bind:show={showAddRMAModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddSectorModal 
  bind:show={showAddSectorModal}
  sites={combinedSites}
  selectedSite={selectedSiteForSector}
  sectorToEdit={selectedSectorForEdit}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleSectorModalSaved}
/>

<AddCPEModal 
  bind:show={showAddCPEModal}
  sites={combinedSites}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddBackhaulLinkModal 
  bind:show={showAddBackhaulModal}
  fromSite={selectedSiteForBackhaul}
  sites={combinedSites}
  backhaulToEdit={selectedBackhaulForEdit}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleBackhaulModalSaved}
/>

<AddInventoryModal 
  bind:show={showAddInventoryModal}
  site={selectedSiteForInventory}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<!-- Context Menus -->
<MapContextMenu 
  bind:show={showContextMenu}
  x={contextMenuX}
  y={contextMenuY}
  latitude={contextMenuLat ?? undefined}
  longitude={contextMenuLon ?? undefined}
  planMode={isPlanMode || sharedMapMode === 'plan'}
  planName={activePlanName}
  disabled={(isPlanMode || sharedMapMode === 'plan') && !planEditingEnabled}
  on:action={handleContextMenuAction}
/>

<TowerActionsMenu 
  bind:show={showTowerActionsMenu}
  tower={selectedTowerForMenu}
  x={towerMenuX}
  y={towerMenuY}
  moduleContext={moduleContext}
  on:action={handleTowerAction}
/>

<SectorActionsMenu 
  bind:show={showSectorActionsMenu}
  sector={selectedSectorForMenu}
  x={sectorMenuX}
  y={sectorMenuY}
  moduleContext={moduleContext}
  on:action={handleSectorAction}
/>

<BackhaulActionsMenu 
  bind:show={showBackhaulActionsMenu}
  backhaul={selectedBackhaulForMenu as any}
  x={backhaulMenuX}
  y={backhaulMenuY}
  moduleContext={moduleContext}
  on:action={handleBackhaulAction}
/>

<!-- EPC Deployment Modal -->
<EPCDeploymentModal
  bind:show={showEPCDeploymentModal}
  tenantId={tenantId}
  siteData={selectedTowerForEPC}
  on:close={() => {
    showEPCDeploymentModal = false;
    selectedTowerForEPC = null;
  }}
/>

<!-- HSS Registration Modal -->
<HSSRegistrationModal
  bind:show={showHSSRegistrationModal}
  tenantId={tenantId}
  siteData={selectedTowerForEPC}
  on:close={() => {
    showHSSRegistrationModal = false;
    selectedTowerForEPC = null;
  }}
/>

<!-- Hardware Deployment Modal -->
<HardwareDeploymentModal
  show={showHardwareDeploymentModal}
  tower={selectedTowerForEPC}
  {tenantId}
  on:close={() => {
    showHardwareDeploymentModal = false;
    selectedTowerForEPC = null;
  }}
  on:deploy-epc={(e) => {
    selectedTowerForEPC = e.detail;
    showHardwareDeploymentModal = false;
    showEPCDeploymentModal = true;
  }}
  on:view-inventory={(e) => {
    const tower = e.detail.tower;
    if (!tower) return;
    
    // Check if we're in embedded mode (iframe)
    const isIframe = typeof window !== 'undefined' && window.parent && window.parent !== window;
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const checkDeployMode = isDeployMode || urlParams?.get('deployMode') === 'true' || urlParams?.get('mode') === 'deploy';
    const checkPlanMode = isPlanMode || urlParams?.get('planMode') === 'true' || urlParams?.get('mode') === 'plan';
    const isEmbedded = isIframe || checkDeployMode || checkPlanMode;
    
    if (isEmbedded && typeof window !== 'undefined' && window.parent) {
      // Send message to parent (deploy module) to show SiteEquipmentModal
      const message = {
        source: 'coverage-map',
        type: 'object-action',
        objectId: tower.id,
        action: 'view-inventory',
        data: { tower }
      };
      console.log('[CoverageMap] HardwareDeploymentModal view-inventory - sending to parent:', message);
      window.parent.postMessage(message, '*');
    } else {
      // Standalone mode - navigate to inventory
      goto(`/modules/inventory?siteId=${tower.id}&siteName=${encodeURIComponent(tower.name)}`);
    }
  }}
  on:deployed={async (e) => {
    console.log('[CoverageMap] Hardware deployed:', e.detail);
    success = `Hardware deployed to ${e.detail.tower?.name || 'site'} successfully`;
    setTimeout(() => success = '', 5000);
    await loadAllData();
  }}
/>

<!-- Help Modal -->
{#if !isEmbedded}
<TipsModal
  bind:show={showTipsModal}
  moduleId="coverage-map"
  tips={tips}
  on:close={() => showTipsModal = false}
/>
{/if}

<HelpModal
  show={showHelpModal}
  title="Coverage Map Help"
  content={helpContent}
  on:close={() => showHelpModal = false}
/>

<!-- Site Edit Modal -->
<SiteEditModal
  show={showSiteEditModal}
  site={selectedSiteForEdit}
  {tenantId}
  on:saved={handleModalSaved}
  on:close={() => {
    showSiteEditModal = false;
    selectedSiteForEdit = null;
  }}
/>

<!-- Global Settings Button - Removed from modules -->
</TenantGuard>

<style>
  .fullscreen-map {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 1;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: white;
    z-index: 1000;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .floating-controls {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 100;
  }

  .control-btn {
    width: 50px;
    height: 50px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .control-btn:hover {
    background: rgba(124, 58, 237, 0.8);
    border-color: rgba(124, 58, 237, 0.5);
    transform: scale(1.1);
  }

  .map-control-btn {
    background: rgba(59, 130, 246, 0.8);
    border-color: rgba(59, 130, 246, 0.5);
  }
  
  .map-control-btn:hover {
    background: rgba(59, 130, 246, 0.95);
    border-color: rgba(59, 130, 246, 0.7);
  }
  
  .control-group {
    position: relative;
  }
  
  .control-dropdown {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 280px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
    z-index: 1000;
    display: none;
    flex-direction: column;
    gap: 1rem;
  }
  
  .control-group:hover .control-dropdown,
  .control-group:focus-within .control-dropdown {
    display: flex;
  }
  
  .dropdown-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .dropdown-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(148, 163, 184, 0.8);
    margin-bottom: 0.25rem;
  }
  
  .basemap-switcher-inline {
    display: flex;
    gap: 0.5rem;
  }
  
  .basemap-btn-inline {
    flex: 1;
    padding: 0.5rem;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .basemap-btn-inline:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
  }
  
  .basemap-btn-inline.active {
    background: rgba(59, 130, 246, 0.6);
    border-color: rgba(59, 130, 246, 0.8);
  }
  
  
  /* Help Button */
  .help-button {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    z-index: 999;
  }
  
  .help-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15);
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  }
  
  .help-button:active {
    transform: translateY(0);
  }
  
  .help-button svg {
    width: 24px;
    height: 24px;
    stroke: white;
    fill: none;
    stroke-width: 2.5;
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }


  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
    padding: 1rem;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
  }

  .main-menu-modal {
    width: 600px;
    max-width: calc(100vw - 2rem);
  }

  .filters-modal {
    width: 400px;
    max-width: calc(100vw - 2rem);
  }

  .stats-modal {
    width: 500px;
    max-width: calc(100vw - 2rem);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .menu-section {
    margin-bottom: 2rem;
  }

  .menu-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .basemap-switcher {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .basemap-btn {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .basemap-btn:hover {
    background: var(--bg-hover);
  }

  .basemap-btn.active {
    background: var(--brand-primary);
    color: white;
    border-color: var(--brand-primary);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .action-btn {
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 0.875rem;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    transform: translateY(-2px);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--brand-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .message-banner {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1001;
    max-width: 500px;
    backdrop-filter: blur(10px);
  }

  .message-banner.error {
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .message-banner.success {
    background: rgba(34, 197, 94, 0.9);
    color: white;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .dismiss-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .plan-summary-card {
    position: absolute;
    bottom: 5.5rem;
    right: 1rem;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.88);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    color: #e2e8f0;
    min-width: 220px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
    z-index: 10001;
  }

  .plan-summary-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: #38bdf8;
  }

  .plan-summary-header small {
    font-weight: 400;
    color: rgba(226, 232, 240, 0.65);
  }

  .plan-summary-total {
    font-size: 1.65rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    color: #f8fafc;
  }

  .plan-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .plan-draft-menu {
    position: fixed;
    min-width: 260px;
    background: var(--card-bg, #0f172a);
    border: 1px solid rgba(59, 130, 246, 0.35);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.4);
    z-index: 2200;
    overflow: hidden;
    color: var(--text-primary, #e2e8f0);
  }

  .plan-draft-menu .menu-header {
    padding: 0.75rem 1rem;
    background: rgba(59, 130, 246, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .plan-draft-menu .menu-header strong {
    font-size: 0.95rem;
  }

  .plan-draft-menu .menu-header small {
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.85);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .plan-draft-menu .menu-body {
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-secondary, #cbd5f5);
  }

  .plan-draft-menu .menu-body .coords {
    margin-top: 0.5rem;
    font-family: monospace;
    color: rgba(129, 140, 248, 0.9);
  }

  .plan-draft-menu .menu-item {
    width: 100%;
    background: transparent;
    border: none;
    text-align: left;
    padding: 0.75rem 1rem;
    color: inherit;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .plan-draft-menu .menu-item:hover {
    background: rgba(59, 130, 246, 0.18);
  }

  .plan-draft-menu .menu-item.danger {
    color: #fca5a5;
  }

  .plan-draft-menu .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.18);
  }
  
  .plan-draft-menu .menu-item.deploy-hardware {
    color: #86efac;
    font-weight: 500;
  }
  
  .plan-draft-menu .menu-item.deploy-hardware:hover {
    background: rgba(34, 197, 94, 0.18);
  }
  
  .plan-draft-menu .menu-divider {
    height: 1px;
    background: rgba(148, 163, 184, 0.2);
    margin: 0.25rem 0;
  }

  .plan-summary-item {
    padding: 0.5rem 0.6rem;
    background: rgba(30, 41, 59, 0.85);
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .plan-summary-item .label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(148, 163, 184, 0.85);
  }

  .plan-summary-item .value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #f8fafc;
  }

  @media (max-width: 768px) {
    .floating-controls {
      display: none;
    }
    
    .control-btn {
      width: 48px;
      height: 48px;
      font-size: 1.25rem;
      min-height: 48px;
      min-width: 48px;
    }
    
    .coverage-map-page {
      height: 100vh;
      height: 100dvh; /* Dynamic viewport height for mobile */
    }
    
    .map-container {
      touch-action: pan-x pan-y;
    }
    
    .filter-panel {
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .filter-panel button {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 16px;
    }
    
    .modal-overlay {
      padding: 0.5rem;
      align-items: flex-start;
      padding-top: 2rem;
    }
    
    .modal-content {
      max-height: calc(100vh - 4rem);
      margin: 0;
    }
    
    .main-menu-modal,
    .filters-modal,
    .stats-modal {
      width: 100%;
      max-width: calc(100vw - 1rem);
    }
    
    .modal-header {
      padding: 1rem;
      position: sticky;
      top: 0;
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      z-index: 10;
    }
    
    .modal-body {
      padding: 1rem;
    }
    
    .action-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    
    .action-btn {
      min-height: 48px;
      padding: 12px 16px;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .basemap-switcher {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    
    .basemap-btn {
      min-height: 48px;
      padding: 12px 16px;
      font-size: 16px;
    }
    
    .stats-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
    
    .stat-card {
      padding: 1rem;
    }
    
    .message-banner {
      left: 1rem;
      right: 1rem;
      transform: none;
      max-width: none;
      bottom: 80px; /* Above mobile controls */
    }
    
    /* Improve touch targets */
    .close-btn {
      min-height: 44px;
      min-width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Better spacing for mobile */
    .modal-body {
      padding-bottom: 2rem; /* Extra space for mobile controls */
    }
    
    /* Prevent zoom on input focus */
    input, select, textarea {
      font-size: 16px;
    }

    .plan-summary-card {
      position: static;
      margin: 0.75rem;
      min-width: unset;
    }
    .plan-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>