<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerService, type Customer } from '$lib/services/customerService';
  import { voiceService, type VoiceTelephoneNumber } from '$lib/services/voiceService';
  import { API_CONFIG } from '$lib/config/api';
  import { debug } from '$lib/utils/debug';
  
  export let show = false;
  export let customer: Customer | null = null;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  let success = '';
  
  let formData = {
    firstName: '',
    lastName: '',
    primaryPhone: '',
    alternatePhone: '',
    email: '',
    serviceAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      latitude: undefined as number | undefined,
      longitude: undefined as number | undefined
    },
    billingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      sameAsService: true
    },
    serviceStatus: '' as Customer['serviceStatus'] | '',
    serviceType: '' as Customer['serviceType'] | '',
    groupId: '' as string | undefined,
    servicePlan: {
      planId: undefined as string | undefined,
      planName: '',
      downloadMbps: undefined as number | undefined,
      uploadMbps: undefined as number | undefined,
      monthlyFee: undefined as number | undefined,
      currency: 'USD',
      qci: 9 as number | undefined,
      maxBandwidthDl: undefined as number | undefined,
      maxBandwidthUl: undefined as number | undefined,
      dataQuota: undefined as number | undefined,
      priorityLevel: 'medium' as 'low' | 'medium' | 'high' | 'premium' | undefined
    },
    lteAuth: {
      ki: '',
      op: '',
      opc: '',
      sqn: 0
    },
    macAddress: '',
    networkInfo: {
      imsi: '',
      msisdn: ''
    },
    notes: '',
    tags: [] as string[]
  };
  
  let tagInput = '';

  /** Voice / SIP lines linked via customerId (Voice module) */
  let voiceLines: VoiceTelephoneNumber[] = [];
  let voiceLoading = false;
  let voiceError = '';
  
  // Customer Groups
  let customerGroups: any[] = [];
  let bandwidthPlans: any[] = [];
  
  onMount(() => {
    loadGroups();
    if (customer) {
      loadCustomerData();
    }
  });
  
  $: if (customer && show) {
    loadCustomerData();
  }

  async function loadVoiceLinesForCustomer(cid: string) {
    voiceLoading = true;
    voiceError = '';
    try {
      voiceLines = await voiceService.listTelephoneNumbers({ customerId: cid });
    } catch (e) {
      voiceError = e instanceof Error ? e.message : 'Could not load voice lines';
      voiceLines = [];
    } finally {
      voiceLoading = false;
    }
  }

  $: if (show && customer?.customerId) {
    void loadVoiceLinesForCustomer(customer.customerId);
  }
  
  // Track the last groupId we processed to avoid infinite loops
  let lastProcessedGroupId: string | undefined = undefined;
  
  // Watch for when groups are loaded and we have a groupId - populate service plan
  // This ensures service plan displays when editing existing customers with a group
  $: groupsReady = customerGroups.length > 0 && bandwidthPlans.length > 0;
  $: if (formData.groupId && groupsReady && formData.groupId !== lastProcessedGroupId) {
    debug.log('[CustomerForm] Reactive: Triggering handleGroupChange', {
      groupId: formData.groupId,
      groupsCount: customerGroups.length,
      plansCount: bandwidthPlans.length,
      lastProcessed: lastProcessedGroupId
    });
    // Set tracking immediately to prevent reactive statement from retriggering
    lastProcessedGroupId = formData.groupId;
    // Use setTimeout to avoid reactive loop issues
    setTimeout(() => {
      handleGroupChange();
    }, 0);
  }
  
  // Reset tracking when groupId is cleared
  $: if (!formData.groupId) {
    lastProcessedGroupId = undefined;
  }
  
  async function loadGroups() {
    try {
      const tenantId = localStorage.getItem('selectedTenantId');
      if (!tenantId) return;
      
      const apiPath = API_CONFIG.PATHS.CUSTOMERS.split('/customers')[0];
      const token = await (await import('$lib/services/authService')).authService.getAuthTokenForApi();
      
      const [groupsRes, plansRes] = await Promise.all([
        fetch(`${apiPath}/hss/groups`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        }).catch(() => null),
        fetch(`${apiPath}/hss/bandwidth-plans`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        }).catch(() => null)
      ]);
      
      if (groupsRes?.ok) {
        const groupsData = await groupsRes.json();
        customerGroups = Array.isArray(groupsData.groups) ? groupsData.groups : groupsData;
        debug.log('[CustomerForm] Loaded groups:', {
          count: customerGroups.length,
          groups: customerGroups.map(g => ({
            group_id: g.group_id,
            id: g.id,
            name: g.name,
            bandwidth_plan_id: g.bandwidth_plan_id
          }))
        });
      }
      
      if (plansRes?.ok) {
        const plansData = await plansRes.json();
        bandwidthPlans = Array.isArray(plansData.plans) ? plansData.plans : plansData;
        debug.log('[CustomerForm] Loaded bandwidth plans:', {
          count: bandwidthPlans.length,
          plans: bandwidthPlans.map(p => ({
            id: p.id,
            plan_id: p.plan_id,
            name: p.name,
            download_mbps: p.download_mbps,
            upload_mbps: p.upload_mbps,
            max_bandwidth_dl: p.max_bandwidth_dl,
            max_bandwidth_ul: p.max_bandwidth_ul
          }))
        });
      }
      
      // Service plan will be populated by reactive statement when groupsReady becomes true
      // No need to call handleGroupChange here - the reactive statement will handle it
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  }
  
  let groupWarning = '';
  
  function handleGroupChange() {
    groupWarning = ''; // Clear previous warning
    
    debug.log('[CustomerForm] handleGroupChange called', {
      groupId: formData.groupId,
      groupsCount: customerGroups.length,
      plansCount: bandwidthPlans.length,
      lastProcessed: lastProcessedGroupId
    });
    
    // Update tracking immediately to prevent reactive statement from retriggering
    // This works for both event handler calls and reactive statement calls
    const currentGroupId = formData.groupId;
    lastProcessedGroupId = currentGroupId;
    
    if (!formData.groupId) {
      // Clear service plan if no group selected
      formData.servicePlan.planId = undefined;
      formData.servicePlan.planName = '';
      formData.servicePlan.downloadMbps = undefined;
      formData.servicePlan.uploadMbps = undefined;
      formData.servicePlan.maxBandwidthDl = undefined;
      formData.servicePlan.maxBandwidthUl = undefined;
      lastProcessedGroupId = undefined;
      return;
    }
    
    // Find selected group - check both group_id and id fields
    const selectedGroup = customerGroups.find(g => {
      const groupMatch = (g.group_id === formData.groupId) || (g.id === formData.groupId);
      debug.log('[CustomerForm] Checking group:', {
        group_id: g.group_id,
        id: g.id,
        targetGroupId: formData.groupId,
        matches: groupMatch
      });
      return groupMatch;
    });
    
    if (!selectedGroup) {
      console.warn('[CustomerForm] Group not found:', {
        searchedGroupId: formData.groupId,
        availableGroups: customerGroups.map(g => ({ group_id: g.group_id, id: g.id, name: g.name }))
      });
      groupWarning = 'Selected group not found';
      return;
    }
    
    debug.log('[CustomerForm] Found group:', {
      name: selectedGroup.name,
      bandwidth_plan_id: selectedGroup.bandwidth_plan_id
    });
    
    if (!selectedGroup.bandwidth_plan_id) {
      console.warn('[CustomerForm] Group has no bandwidth plan:', selectedGroup);
      groupWarning = `Warning: The group "${selectedGroup.name}" does not have a bandwidth plan assigned. Please assign a bandwidth plan to this group in the Customer Groups tab.`;
      // Clear service plan since group has no plan
      formData.servicePlan.planId = undefined;
      formData.servicePlan.planName = '';
      formData.servicePlan.downloadMbps = undefined;
      formData.servicePlan.uploadMbps = undefined;
      formData.servicePlan.maxBandwidthDl = undefined;
      formData.servicePlan.maxBandwidthUl = undefined;
      return;
    }
    
    // Find bandwidth plan - check multiple possible ID fields
    const plan = bandwidthPlans.find(p => {
      const planId = selectedGroup.bandwidth_plan_id;
      // Check all possible ID fields
      const matches = 
        p.plan_id === planId ||
        p.id === planId ||
        p._id?.toString() === planId ||
        (p._id && p._id.toString() === planId);
      
      if (matches) {
        console.log('[CustomerForm] Plan match found:', {
          searchedId: planId,
          matchedPlan: { plan_id: p.plan_id, id: p.id, _id: p._id, name: p.name }
        });
      }
      
      return matches;
    });
    
    debug.log('[CustomerForm] Looking for plan:', {
      searchedPlanId: selectedGroup.bandwidth_plan_id,
      foundPlan: !!plan,
      groupBandwidthPlanId: selectedGroup.bandwidth_plan_id,
      availablePlans: bandwidthPlans.map(p => ({ 
        plan_id: p.plan_id, 
        id: p.id, 
        _id: p._id?.toString(),
        name: p.name 
      }))
    });
    
    if (plan) {
      // Populate service plan from group's bandwidth plan
      // Store plan ID for reference
      formData.servicePlan.planId = plan.plan_id || plan.id || selectedGroup.bandwidth_plan_id;
      
      // Check for plan name in multiple possible fields
      const planName = plan.name || plan.plan_name || plan.planName || '';
      formData.servicePlan.planName = planName;
      
      // Handle bandwidth values - API may return in Mbps or bytes
      // If max_bandwidth_dl/ul are in bytes (large numbers), convert to Mbps
      // If download_mbps/upload_mbps exist, use those
      const downloadMbps = plan.download_mbps || 
        (plan.max_bandwidth_dl && plan.max_bandwidth_dl > 1000 ? Math.round(plan.max_bandwidth_dl / 1000000) : 
         plan.max_bandwidth_dl ? plan.max_bandwidth_dl : undefined);
      const uploadMbps = plan.upload_mbps || 
        (plan.max_bandwidth_ul && plan.max_bandwidth_ul > 1000 ? Math.round(plan.max_bandwidth_ul / 1000000) : 
         plan.max_bandwidth_ul ? plan.max_bandwidth_ul : undefined);
      
      formData.servicePlan.downloadMbps = downloadMbps;
      formData.servicePlan.uploadMbps = uploadMbps;
      
      // Store max bandwidth in bytes (convert Mbps to bytes if needed)
      formData.servicePlan.maxBandwidthDl = plan.max_bandwidth_dl || 
        (plan.download_mbps ? plan.download_mbps * 1000000 : undefined);
      formData.servicePlan.maxBandwidthUl = plan.max_bandwidth_ul || 
        (plan.upload_mbps ? plan.upload_mbps * 1000000 : undefined);
      
      // Log full plan object to see all available fields
      debug.log('[CustomerForm] Full plan object:', plan);
      debug.log('[CustomerForm] ✅ Service plan populated from group:', {
        groupId: formData.groupId,
        groupName: selectedGroup.name,
        planId: formData.servicePlan.planId,
        planName: formData.servicePlan.planName,
        planObject: { 
          name: plan.name, 
          plan_name: plan.plan_name, 
          planName: plan.planName,
          description: plan.description,
          plan_id: plan.plan_id, 
          id: plan.id,
          _id: plan._id,
          download_mbps: plan.download_mbps,
          upload_mbps: plan.upload_mbps,
          max_bandwidth_dl: plan.max_bandwidth_dl,
          max_bandwidth_ul: plan.max_bandwidth_ul
        },
        populated: {
          download: formData.servicePlan.downloadMbps,
          upload: formData.servicePlan.uploadMbps,
          maxDl: formData.servicePlan.maxBandwidthDl,
          maxUl: formData.servicePlan.maxBandwidthUl
        }
      });
    } else {
      console.warn('[CustomerForm] ❌ Bandwidth plan not found:', {
        searchedPlanId: selectedGroup.bandwidth_plan_id,
        availablePlans: bandwidthPlans
      });
      groupWarning = `Warning: The bandwidth plan assigned to "${selectedGroup.name}" could not be found.`;
    }
  }
  
  function loadCustomerData() {
    if (!customer) return;
    
    // Reset tracking when loading new customer data
    lastProcessedGroupId = undefined;
    
    formData.firstName = customer.firstName || '';
    formData.lastName = customer.lastName || '';
    formData.primaryPhone = customer.primaryPhone || '';
    formData.alternatePhone = customer.alternatePhone || '';
    formData.email = customer.email || '';
    formData.serviceStatus = customer.serviceStatus || '';
    formData.serviceType = customer.serviceType || '';
    formData.macAddress = customer.macAddress || '';
    formData.notes = (customer as any).notes || '';
    formData.tags = (customer as any).tags || [];
    
    if (customer.lteAuth) {
      formData.lteAuth = {
        ki: customer.lteAuth.ki || '',
        op: customer.lteAuth.op || '',
        opc: customer.lteAuth.opc || '',
        sqn: customer.lteAuth.sqn || 0
      };
    }
    
    if (customer.networkInfo) {
      formData.networkInfo = {
        imsi: customer.networkInfo.imsi || '',
        msisdn: customer.networkInfo.msisdn || ''
      };
    }
    
    if (customer.serviceAddress) {
      formData.serviceAddress = {
        street: customer.serviceAddress.street || '',
        city: customer.serviceAddress.city || '',
        state: customer.serviceAddress.state || '',
        zipCode: customer.serviceAddress.zipCode || '',
        country: customer.serviceAddress.country || 'USA',
        latitude: customer.serviceAddress.latitude,
        longitude: customer.serviceAddress.longitude
      };
    }
    
    // Load groupId if it exists (may be stored in customer or need to look up from HSS)
    formData.groupId = (customer as any).groupId || (customer as any).group_id || '';
    console.log('[CustomerForm] Loaded groupId:', formData.groupId, 'from customer:', {
      groupId: (customer as any).groupId,
      group_id: (customer as any).group_id,
      customerId: customer._id || (customer as any).id
    });
    
    // Load service plan from customer if it exists
    // Note: Service plan will be populated from group via reactive statement when groups load
    if (customer.servicePlan) {
      formData.servicePlan = {
        planId: (customer.servicePlan as any).planId || undefined,
        planName: customer.servicePlan.planName || '',
        downloadMbps: customer.servicePlan.downloadMbps,
        uploadMbps: customer.servicePlan.uploadMbps,
        monthlyFee: customer.servicePlan.monthlyFee,
        currency: customer.servicePlan.currency || 'USD',
        qci: customer.servicePlan.qci || 9,
        maxBandwidthDl: customer.servicePlan.maxBandwidthDl,
        maxBandwidthUl: customer.servicePlan.maxBandwidthUl,
        dataQuota: customer.servicePlan.dataQuota,
        priorityLevel: customer.servicePlan.priorityLevel || 'medium'
      };
      debug.log('[CustomerForm] Loaded existing service plan:', {
        planId: formData.servicePlan.planId,
        planName: formData.servicePlan.planName
      });
    } else {
      // Initialize empty service plan - will be populated from group if groupId exists
      formData.servicePlan = {
        planId: undefined,
        planName: '',
        downloadMbps: undefined,
        uploadMbps: undefined,
        monthlyFee: undefined,
        currency: 'USD',
        qci: 9,
        maxBandwidthDl: undefined,
        maxBandwidthUl: undefined,
        dataQuota: undefined,
        priorityLevel: 'medium'
      };
      debug.log('[CustomerForm] Initialized empty service plan, will populate from group if groupId exists');
    }
  }
  
  function handleBillingAddressChange() {
    if (formData.billingAddress.sameAsService) {
      formData.billingAddress = {
        ...formData.serviceAddress,
        sameAsService: true
      };
    }
  }
  
  function addTag() {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      formData.tags = [...formData.tags, tagInput.trim()];
      tagInput = '';
    }
  }
  
  function removeTag(tag: string) {
    formData.tags = formData.tags.filter(t => t !== tag);
  }
  
  async function handleSave() {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      error = 'First name and last name are required';
      return;
    }
    
    if (!formData.primaryPhone.trim()) {
      error = 'Primary phone is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const firstName = formData.firstName.trim();
      const lastName = formData.lastName.trim();
      const fullName = `${firstName} ${lastName}`.trim();
      
      const customerData: Partial<Customer> = {
        firstName,
        lastName,
        fullName,
        primaryPhone: formData.primaryPhone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        email: formData.email.trim() || undefined,
        serviceAddress: {
          street: formData.serviceAddress.street.trim() || undefined,
          city: formData.serviceAddress.city.trim() || undefined,
          state: formData.serviceAddress.state.trim() || undefined,
          zipCode: formData.serviceAddress.zipCode.trim() || undefined,
          country: formData.serviceAddress.country,
          latitude: formData.serviceAddress.latitude,
          longitude: formData.serviceAddress.longitude
        },
        billingAddress: formData.billingAddress.sameAsService ? undefined : {
          street: formData.billingAddress.street.trim() || undefined,
          city: formData.billingAddress.city.trim() || undefined,
          state: formData.billingAddress.state.trim() || undefined,
          zipCode: formData.billingAddress.zipCode.trim() || undefined,
          country: formData.billingAddress.country
        },
        serviceStatus: formData.serviceStatus || 'pending',
        serviceType: formData.serviceType || undefined,
        // groupId is required when a group is selected
        groupId: formData.groupId && formData.groupId.trim() ? formData.groupId.trim() : undefined,
        // servicePlan is required when a group is selected (group always has a plan)
        // Always save planId and bandwidth data when groupId exists
        servicePlan: formData.groupId && formData.groupId.trim() ? {
          planId: formData.servicePlan.planId || undefined,
          planName: formData.servicePlan.planName || undefined,
          downloadMbps: formData.servicePlan.downloadMbps,
          uploadMbps: formData.servicePlan.uploadMbps,
          monthlyFee: formData.servicePlan.monthlyFee,
          currency: formData.servicePlan.currency || 'USD',
          qci: formData.servicePlan.qci || 9,
          maxBandwidthDl: formData.servicePlan.maxBandwidthDl,
          maxBandwidthUl: formData.servicePlan.maxBandwidthUl,
          dataQuota: formData.servicePlan.dataQuota,
          priorityLevel: formData.servicePlan.priorityLevel || 'medium'
        } : undefined,
        lteAuth: formData.serviceType === '4G/5G' && (formData.lteAuth.ki || formData.lteAuth.opc) ? {
          ki: formData.lteAuth.ki || undefined,
          op: formData.lteAuth.op || undefined,
          opc: formData.lteAuth.opc || undefined,
          sqn: formData.lteAuth.sqn || 0
        } : undefined,
        macAddress: formData.macAddress.trim() || undefined,
        networkInfo: formData.networkInfo.imsi ? {
          imsi: formData.networkInfo.imsi,
          msisdn: formData.networkInfo.msisdn || undefined
        } : undefined,
        notes: formData.notes.trim() || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        isActive: true
      };
      
      if (customer?._id) {
        await customerService.updateCustomer(customer._id, customerData);
      } else {
        await customerService.createCustomer(customerData);
      }
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      
      // Parse error message to show user-friendly message
      let errorMessage = err.message || 'Failed to save customer';
      
      // Check if it's a duplicate error
      if (errorMessage.includes('already exists') || errorMessage.includes('Duplicate')) {
        error = errorMessage;
      } else if (errorMessage.includes('Validation')) {
        error = errorMessage;
      } else {
        error = `Failed to save customer: ${errorMessage}`;
      }
      
      // Scroll error into view
      setTimeout(() => {
        const errorBanner = document.querySelector('.error-banner');
        if (errorBanner) {
          errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
    // Reset tracking
    lastProcessedGroupId = undefined;
    // Reset form
    formData = {
      firstName: '',
      lastName: '',
      primaryPhone: '',
      alternatePhone: '',
      email: '',
      serviceAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA',
        latitude: undefined,
        longitude: undefined
      },
      billingAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA',
        sameAsService: true
      },
      serviceStatus: 'pending',
      serviceType: '',
      groupId: undefined,
      servicePlan: {
        planId: undefined,
        planName: '',
        downloadMbps: undefined,
        uploadMbps: undefined,
        monthlyFee: undefined,
        currency: 'USD',
        qci: 9,
        maxBandwidthDl: undefined,
        maxBandwidthUl: undefined,
        dataQuota: undefined,
        priorityLevel: 'medium'
      },
      lteAuth: {
        ki: '',
        op: '',
        opc: '',
        sqn: 0
      },
      macAddress: '',
      networkInfo: {
        imsi: '',
        msisdn: ''
      },
      notes: '',
      tags: []
    };
    tagInput = '';
    dispatch('close');
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>{customer ? '✏️ Edit Customer' : '➕ Add Customer'}</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    {#if success}
      <div class="success">{success}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Basic Information -->
      <div class="section">
        <h3>👤 Basic Information</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label>First Name *</label>
            <input type="text" bind:value={formData.firstName} placeholder="John" required />
          </div>
          
          <div class="form-group">
            <label>Last Name *</label>
            <input type="text" bind:value={formData.lastName} placeholder="Smith" required />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Primary Phone *</label>
            <input type="tel" bind:value={formData.primaryPhone} placeholder="555-123-4567" required />
          </div>
          
          <div class="form-group">
            <label>Alternate Phone</label>
            <input type="tel" bind:value={formData.alternatePhone} placeholder="555-123-4568" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Email</label>
          <input type="email" bind:value={formData.email} placeholder="john.smith@example.com" />
        </div>
      </div>
      
      <!-- Service -->
      <div class="section">
        <h3>📡 Service</h3>
        
        <div class="form-group">
          <label>Service Status</label>
          <select bind:value={formData.serviceStatus}>
            <option value="">Select Service Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Service Type</label>
          <select bind:value={formData.serviceType}>
            <option value="">Select Service Type</option>
            <option value="4G/5G">4G/5G (LTE/5G)</option>
            <option value="FWA">FWA (Fixed Wireless Access)</option>
            <option value="WiFi">WiFi</option>
            <option value="Fiber">Fiber</option>
          </select>
        </div>
      </div>
      
      <!-- Service Address -->
      <div class="section">
        <h3>📍 Service Address</h3>
        
        <div class="form-group">
          <label>Street Address</label>
          <input type="text" bind:value={formData.serviceAddress.street} placeholder="123 Main St" />
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>City</label>
            <input type="text" bind:value={formData.serviceAddress.city} placeholder="City" />
          </div>
          
          <div class="form-group">
            <label>State</label>
            <input type="text" bind:value={formData.serviceAddress.state} placeholder="State" />
          </div>
          
          <div class="form-group">
            <label>ZIP Code</label>
            <input type="text" bind:value={formData.serviceAddress.zipCode} placeholder="12345" />
          </div>
        </div>
      </div>
      
      <!-- Billing Address -->
      <div class="section">
        <h3>💳 Billing Address</h3>
        
        <div class="form-group">
          <label>
            <input type="checkbox" bind:checked={formData.billingAddress.sameAsService} on:change={handleBillingAddressChange} />
            Same as Service Address
          </label>
        </div>
        
        {#if !formData.billingAddress.sameAsService}
          <div class="form-group">
            <label>Street Address</label>
            <input type="text" bind:value={formData.billingAddress.street} placeholder="123 Main St" />
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>City</label>
              <input type="text" bind:value={formData.billingAddress.city} placeholder="City" />
            </div>
            
            <div class="form-group">
              <label>State</label>
              <input type="text" bind:value={formData.billingAddress.state} placeholder="State" />
            </div>
            
            <div class="form-group">
              <label>ZIP Code</label>
              <input type="text" bind:value={formData.billingAddress.zipCode} placeholder="12345" />
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Customer Group -->
      <div class="section">
        <h3>📦 Customer Group</h3>
        <p class="section-description">Select a customer group. The service plan will be automatically set from the group's bandwidth plan.</p>
        
        <div class="form-group">
          <select bind:value={formData.groupId} on:change={handleGroupChange}>
            <option value="">Select Customer Group</option>
            {#each customerGroups as group}
              <option value={group.group_id || group.id}>{group.name}</option>
            {/each}
          </select>
        </div>
        
        {#if groupWarning}
          <div class="warning-message" style="margin-top: 0.75rem; padding: 0.75rem; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">
            <strong>⚠️ {groupWarning}</strong>
          </div>
        {/if}
        
        {#if formData.groupId}
          {#if formData.servicePlan.planId || formData.servicePlan.downloadMbps || formData.servicePlan.uploadMbps}
            <div class="service-plan-preview">
              <h4>Service Plan</h4>
              <div class="plan-details">
                {#if formData.servicePlan.planName}
                  <div class="plan-detail">
                    <span class="label">Plan:</span>
                    <span class="value">{formData.servicePlan.planName}</span>
                  </div>
                {:else if formData.servicePlan.planId}
                  <div class="plan-detail">
                    <span class="label">Plan ID:</span>
                    <span class="value">{formData.servicePlan.planId}</span>
                  </div>
                {/if}
                {#if formData.servicePlan.downloadMbps}
                  <div class="plan-detail">
                    <span class="label">Download:</span>
                    <span class="value">{formData.servicePlan.downloadMbps} Mbps</span>
                  </div>
                {/if}
                {#if formData.servicePlan.uploadMbps}
                  <div class="plan-detail">
                    <span class="label">Upload:</span>
                    <span class="value">{formData.servicePlan.uploadMbps} Mbps</span>
                  </div>
                {/if}
              </div>
            </div>
          {:else if !groupWarning}
            <div class="service-plan-preview" style="opacity: 0.6;">
              <p style="margin: 0; color: var(--text-secondary);">Loading service plan from group...</p>
            </div>
          {/if}
        {/if}
        
        {#if formData.serviceType === '4G/5G'}
          <div class="form-grid" style="margin-top: 1rem;">
            <div class="form-group">
              <label>QCI (Quality Class Identifier)</label>
              <input type="number" bind:value={formData.servicePlan.qci} min="1" max="9" placeholder="9" />
              <small>1-9 (9 is default best effort)</small>
            </div>
            <div class="form-group">
              <label>Data Quota (bytes)</label>
              <input type="number" bind:value={formData.servicePlan.dataQuota} placeholder="0 = unlimited" />
              <small>0 = unlimited, or specify bytes</small>
            </div>
            <div class="form-group">
              <select bind:value={formData.servicePlan.priorityLevel}>
                <option value="">Select Priority Level</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- LTE/5G Authentication (for 4G/5G service type) -->
      {#if formData.serviceType === '4G/5G'}
        <div class="section">
          <h3>🔐 LTE/5G Authentication</h3>
          <p class="section-description">Required for 4G/5G service type. These credentials are used for subscriber authentication.</p>
          
          <div class="form-grid">
            <div class="form-group">
              <label>IMSI (15 digits)</label>
              <input 
                type="text" 
                bind:value={formData.networkInfo.imsi} 
                placeholder="123456789012345" 
                maxlength="15"
                pattern="[0-9]{15}"
              />
              <small>International Mobile Subscriber Identity</small>
            </div>
            
            <div class="form-group">
              <label>MSISDN (Phone Number)</label>
              <input 
                type="text" 
                bind:value={formData.networkInfo.msisdn} 
                placeholder={formData.primaryPhone.replace(/\D/g, '')} 
              />
              <small>Mobile Station ISDN Number</small>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Ki (Authentication Key) *</label>
              <input 
                type="text" 
                bind:value={formData.lteAuth.ki} 
                placeholder="32 or 64 hex characters" 
                pattern="[0-9A-Fa-f]{32}|[0-9A-Fa-f]{64}"
              />
              <small>128-bit (32 hex) or 256-bit (64 hex) key</small>
            </div>
            
            <div class="form-group">
              <label>OPc (Operator Variant) *</label>
              <input 
                type="text" 
                bind:value={formData.lteAuth.opc} 
                placeholder="32 hex characters" 
                pattern="[0-9A-Fa-f]{32}"
              />
              <small>128-bit (32 hex) operator variant</small>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>OP (Operator Variant - Alternative)</label>
              <input 
                type="text" 
                bind:value={formData.lteAuth.op} 
                placeholder="32 hex characters (optional)" 
                pattern="[0-9A-Fa-f]{32}"
              />
              <small>Use OP instead of OPc if needed</small>
            </div>
            
            <div class="form-group">
              <label>SQN (Sequence Number)</label>
              <input 
                type="number" 
                bind:value={formData.lteAuth.sqn} 
                placeholder="0" 
                min="0"
              />
              <small>Sequence number for AKA (default: 0)</small>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- MAC Address (Optional, for ACS integration) -->
      <div class="section">
        <h3>🔌 MAC Address (Optional)</h3>
        <p class="section-description">MAC address for ACS/TR-069 integration. Not required but useful for device management.</p>
        
        <div class="form-group">
          <label>MAC Address</label>
          <input 
            type="text" 
            bind:value={formData.macAddress} 
            placeholder="aa:bb:cc:dd:ee:ff or aa-bb-cc-dd-ee-ff" 
            pattern="([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})"
          />
          <small>Format: xx:xx:xx:xx:xx:xx or xx-xx-xx-xx-xx-xx</small>
        </div>
      </div>
      
      <!-- Tags -->
      <div class="section">
        <h3>🏷️ Tags</h3>
        
        <div class="form-group">
          <div class="tag-input-group">
            <input 
              type="text" 
              bind:value={tagInput} 
              placeholder="Add tag..."
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <button type="button" class="btn-add-tag" on:click={addTag}>Add</button>
          </div>
          
          {#if formData.tags.length > 0}
            <div class="tags-list">
              {#each formData.tags as tag}
                <span class="tag">
                  {tag}
                  <button type="button" class="tag-remove" on:click={() => removeTag(tag)}>✕</button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Voice / SIP (linked by customer id) -->
      {#if customer?.customerId}
        <div class="section">
          <h3>📞 Voice / SIP</h3>
          <p class="section-description">
            Voice inventory and E911 are managed in the Voice module. Telephone numbers can be linked to this customer using
            customer id <code>{customer.customerId}</code>.
          </p>
          {#if voiceLoading}
            <p class="muted">Loading voice lines…</p>
          {:else if voiceError}
            <p class="voice-err">{voiceError}</p>
          {:else if voiceLines.length === 0}
            <p class="muted">No voice lines linked yet. Open Voice &amp; SIP to assign numbers to this customer.</p>
          {:else}
            <ul class="voice-line-list">
              {#each voiceLines as vl}
                <li>
                  <code>{vl.e164}</code>
                  <span class="muted">· {vl.status}</span>
                  <span title="E911 from emergency address">· 911: {vl.e911Display ?? '—'}</span>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="voice-actions">
            <button
              type="button"
              class="btn-secondary"
              on:click={() => goto(`/modules/voice-telephony?customerId=${encodeURIComponent(customer.customerId)}`)}
            >
              Open Voice module
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Notes -->
      <div class="section">
        <h3>📝 Notes</h3>
        
        <div class="form-group">
          <textarea 
            bind:value={formData.notes} 
            placeholder="Additional notes about this customer..."
            rows="4"
          ></textarea>
        </div>
      </div>
      
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : (customer ? '✅ Update Customer' : '✅ Create Customer')}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-color);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: var(--transition);
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .error-banner {
    background: var(--danger-light);
    color: var(--danger);
    padding: var(--spacing-md);
    margin: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--danger);
  }
  
  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }
  
  .section {
    margin-bottom: var(--spacing-xl);
  }
  
  .section h3 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
    font-weight: 600;
  }
  
  .section-description {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    font-style: italic;
  }
  
  .form-group small {
    display: block;
    color: #666;
    font-size: 0.85rem;
    margin-top: 0.25rem;
    font-weight: normal;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .form-group label {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg, var(--card-bg));
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
    transition: var(--transition);
    width: 100%;
  }
  
  /* Enhanced select dropdown styling */
  .form-group select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23334155' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 12px;
    padding-right: 2.5rem;
    cursor: pointer;
    font-weight: 500;
    border: 2px solid var(--border-color);
    background-color: var(--card-bg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  /* Style placeholder option in dropdown list */
  .form-group select option[value=""] {
    color: var(--text-secondary, #64748b);
    font-style: italic;
  }
  
  /* Style select when placeholder is selected (empty value) */
  .form-group select:has(option[value=""]:checked) {
    color: var(--text-secondary, #64748b);
  }
  
  /* When a real value is selected, show normal text color */
  .form-group select:not(:has(option[value=""]:checked)) {
    color: var(--text-primary);
  }
  
  .form-group select:hover {
    border-color: var(--brand-primary, #3b82f6);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
  }
  
  .form-group select:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    background-color: var(--card-bg);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    background: var(--card-bg);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }
  
  .tag-input-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .tag-input-group input {
    flex: 1;
  }
  
  .btn-add-tag {
    padding: var(--spacing-md);
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 600;
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 0.85rem;
  }
  
  .tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 1rem;
    padding: 0;
    width: 1.2rem;
    height: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .tag-remove:hover {
    color: var(--danger);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-md) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-primary {
    background: var(--gradient-primary);
    color: var(--text-inverse);
    box-shadow: var(--shadow-md);
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
    transform: translateY(-1px);
  }
  
  /* HSS Subscriber Styles */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }
  
  .btn-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
  }
  
  .btn-toggle:hover {
    color: var(--text-primary);
  }
  
  /* Service Plan Preview */
  .service-plan-preview {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    margin-top: 1rem;
  }
  
  .service-plan-preview h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
  
  .plan-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .plan-detail {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
  
  .plan-detail .label {
    font-weight: 500;
    color: var(--text-secondary);
  }
  
  .plan-detail .value {
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .loading {
    text-align: center;
    padding: var(--spacing-md);
    color: var(--text-secondary);
  }
  
  .success {
    background: var(--success-light);
    color: var(--success);
    padding: var(--spacing-md);
    margin: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--success);
  }

  .voice-line-list {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
  }
  .voice-line-list li {
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  .voice-err {
    color: #b91c1c;
    font-size: 0.9rem;
  }
  .voice-actions {
    margin-top: 0.75rem;
  }
</style>

