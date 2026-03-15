<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService } from '$lib/services/brandingService';
  import { goto } from '$app/navigation';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { getApiUrl } from '$lib/config/api';
  import { authService } from '$lib/services/authService';

  const API_URL = getApiUrl();

  type Tab = 'branding' | 'features' | 'billing' | 'alerts' | 'faq' | 'knowledge' | 'chat';

  let currentTab: Tab = 'branding';
  let loading = false;
  let saving = false;
  let error = '';
  let success = '';
  let tenantId = '';
  let tenantName = '';

  // Domain configuration
  let customDomain = '';
  let enableCustomDomain = false;
  let portalSubdomain = '';
  let portalUrl = '';

  // Branding
  let companyName = '';
  let logoUrl = '';
  let primaryColor = '#3b82f6';
  let supportEmail = '';
  let supportPhone = '';

  // Features
  let enableFAQ = true;
  let enableServiceStatus = true;
  let enableBilling = true;
  let enableTickets = true;
  let enableLiveChat = false;
  let enableKnowledgeBase = false;
  let liveChatEmbedHtml = '';

  // Billing Portal Admin: payment gateways & invoice customization
  let stripeEnabled = false;
  let stripePublicKey = '';
  let stripeNote = '';
  let paypalEnabled = false;
  let paypalClientId = '';
  let paypalSandbox = true;
  let paypalNote = '';
  let invoiceCompanyName = '';
  let invoiceLogoUrl = '';
  let invoiceAddress = '';
  let invoiceFooterText = '';
  let invoiceTermsAndConditions = '';
  let invoiceDueDays = 14;
  let invoiceCurrency = 'USD';

  // Alerts & Outages
  interface Alert {
    _id?: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'outage' | 'maintenance';
    status: 'active' | 'resolved' | 'scheduled';
    startDate?: string;
    endDate?: string;
    createdAt?: string;
  }
  let alerts: Alert[] = [];
  let newAlert: Alert = {
    title: '',
    message: '',
    type: 'info',
    status: 'active'
  };
  let showAlertForm = false;
  let editingAlertId: string | null = null;

  // FAQ Items
  interface FAQItem {
    _id?: string;
    question: string;
    answer: string;
    category: string;
    order: number;
    published: boolean;
  }
  let faqItems: FAQItem[] = [];
  let newFAQ: FAQItem = {
    question: '',
    answer: '',
    category: 'General',
    order: 0,
    published: true
  };
  let showFAQForm = false;
  let editingFAQId: string | null = null;
  let faqCategories = ['General', 'Billing', 'Technical', 'Account', 'Service'];

  // Knowledge Base
  interface KBArticle {
    _id?: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    published: boolean;
    createdAt?: string;
  }
  let kbArticles: KBArticle[] = [];
  let newArticle: KBArticle = {
    title: '',
    content: '',
    category: 'Getting Started',
    tags: [],
    published: true
  };
  let showArticleForm = false;
  let editingArticleId: string | null = null;
  let articleTagInput = '';

  // Live Chat Settings
  interface ChatSettings {
    enabled: boolean;
    welcomeMessage: string;
    offlineMessage: string;
    operatingHours: {
      enabled: boolean;
      start: string;
      end: string;
      timezone: string;
    };
    autoResponses: {
      greeting: string;
      away: string;
      closed: string;
    };
  }
  let chatSettings: ChatSettings = {
    enabled: false,
    welcomeMessage: 'Hello! How can we help you today?',
    offlineMessage: 'We are currently offline. Please leave a message and we will get back to you.',
    operatingHours: {
      enabled: false,
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York'
    },
    autoResponses: {
      greeting: 'Thanks for reaching out! A support agent will be with you shortly.',
      away: 'All agents are currently busy. Please wait and someone will assist you soon.',
      closed: 'We are currently closed. Our hours are Monday-Friday 9am-5pm.'
    }
  };

  let initializedTenantId = '';

  onMount(() => {
    const unsubscribe = currentTenant.subscribe(async (tenant) => {
      if (tenant?.id && tenant.id !== initializedTenantId) {
        initializedTenantId = tenant.id;
        tenantId = tenant.id;
        tenantName = tenant.displayName || tenant.name || '';
        companyName = tenantName || companyName;
        supportEmail = tenant.contactEmail || supportEmail;
        await loadExistingConfig();
        await loadAlerts();
        await loadFAQItems();
        await loadKBArticles();
        await loadChatSettings();
      }
    });

    return () => unsubscribe();
  });

  async function loadExistingConfig() {
    if (!tenantId) {
      error = 'No tenant selected. Please select a tenant to configure the portal.';
      return;
    }

    loading = true;
    try {
      const branding = await brandingService.getTenantBranding(tenantId);

      enableCustomDomain = branding.portal?.enableCustomDomain || false;
      customDomain = branding.portal?.customDomain || '';
      portalSubdomain = branding.portal?.portalSubdomain || tenantId.slice(0, 12);
      portalUrl = branding.portal?.portalUrl || `https://wisptools.io/wisp-management/portal/${portalSubdomain}`;

      companyName = branding.company?.name || tenantName || companyName;
      logoUrl = branding.logo?.url || '';
      primaryColor = branding.colors?.primary || '#3b82f6';
      supportEmail = branding.company?.supportEmail || supportEmail;
      supportPhone = branding.company?.supportPhone || '';

      enableFAQ = branding.features?.enableFAQ !== false;
      enableServiceStatus = branding.features?.enableServiceStatus !== false;
      enableBilling = branding.features?.enableBilling !== false;
      enableTickets = branding.features?.enableTickets !== false;
      enableLiveChat = branding.features?.enableLiveChat || false;
      enableKnowledgeBase = branding.features?.enableKnowledgeBase || false;
      liveChatEmbedHtml = branding.features?.liveChatEmbedHtml || '';

      const bp = branding.billingPortal;
      stripeEnabled = bp?.paymentGateways?.stripe?.enabled || false;
      stripePublicKey = bp?.paymentGateways?.stripe?.publicKey || '';
      stripeNote = bp?.paymentGateways?.stripe?.note || '';
      paypalEnabled = bp?.paymentGateways?.paypal?.enabled || false;
      paypalClientId = bp?.paymentGateways?.paypal?.clientId || '';
      paypalSandbox = bp?.paymentGateways?.paypal?.sandbox !== false;
      paypalNote = bp?.paymentGateways?.paypal?.note || '';
      invoiceCompanyName = bp?.invoice?.companyName || branding.company?.displayName || companyName || '';
      invoiceLogoUrl = bp?.invoice?.logoUrl || '';
      invoiceAddress = bp?.invoice?.address || '';
      invoiceFooterText = bp?.invoice?.footerText || '';
      invoiceTermsAndConditions = bp?.invoice?.termsAndConditions || '';
      invoiceDueDays = bp?.invoice?.dueDays ?? 14;
      invoiceCurrency = bp?.invoice?.currency || 'USD';
    } catch (err: any) {
      console.error('Error loading config:', err);
      error = err.message || 'Failed to load existing configuration.';
    } finally {
      loading = false;
    }
  }

  async function loadAlerts() {
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alerts = await response.json();
      }
    } catch (err) {
      console.error('Error loading alerts:', err);
    }
  }

  async function loadFAQItems() {
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/faq`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        faqItems = await response.json();
      }
    } catch (err) {
      console.error('Error loading FAQ:', err);
    }
  }

  async function loadKBArticles() {
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/knowledge-base`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        kbArticles = await response.json();
      }
    } catch (err) {
      console.error('Error loading knowledge base:', err);
    }
  }

  async function loadChatSettings() {
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/chat-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const settings = await response.json();
        if (settings) {
          chatSettings = { ...chatSettings, ...settings };
        }
      }
    } catch (err) {
      console.error('Error loading chat settings:', err);
    }
  }

  async function saveBranding() {
    if (!tenantId) {
      error = 'No tenant selected.';
      return;
    }
    
    saving = true;
    error = '';
    success = '';
    
    try {
      if (!enableCustomDomain && !portalSubdomain) {
        portalSubdomain = tenantId.slice(0, 12);
      }
      
      await brandingService.updateTenantBranding(tenantId, {
        logo: { url: logoUrl, altText: companyName || 'Company Logo' },
        colors: { primary: primaryColor },
        company: { name: companyName, supportEmail, supportPhone },
        portal: {
          enableCustomDomain,
          customDomain: enableCustomDomain ? customDomain : '',
          portalSubdomain: enableCustomDomain ? undefined : portalSubdomain,
          welcomeMessage: `Welcome to ${companyName}'s Customer Portal`
        },
        features: { enableFAQ, enableServiceStatus, enableBilling, enableTickets, enableLiveChat, enableKnowledgeBase, liveChatEmbedHtml: liveChatEmbedHtml.trim() || undefined }
      });
      
      portalUrl = getPortalUrl();
      success = 'Branding saved successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save branding';
    } finally {
      saving = false;
    }
  }

  async function saveBillingPortal() {
    if (!tenantId) {
      error = 'No tenant selected.';
      return;
    }
    saving = true;
    error = '';
    success = '';
    try {
      await brandingService.updateTenantBranding(tenantId, {
        billingPortal: {
          paymentGateways: {
            stripe: { enabled: stripeEnabled, publicKey: stripePublicKey.trim() || undefined, note: stripeNote || undefined },
            paypal: { enabled: paypalEnabled, clientId: paypalClientId.trim() || undefined, sandbox: paypalSandbox, note: paypalNote || undefined }
          },
          invoice: {
            companyName: invoiceCompanyName || undefined,
            logoUrl: invoiceLogoUrl || undefined,
            address: invoiceAddress || undefined,
            footerText: invoiceFooterText || undefined,
            termsAndConditions: invoiceTermsAndConditions || undefined,
            dueDays: invoiceDueDays,
            currency: invoiceCurrency
          }
        }
      });
      success = 'Billing portal settings saved.';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save billing portal settings';
    } finally {
      saving = false;
    }
  }

  async function saveFeatures() {
    if (!tenantId) {
      error = 'No tenant selected.';
      return;
    }
    
    saving = true;
    error = '';
    success = '';
    
    try {
      await brandingService.updateTenantBranding(tenantId, {
        features: { enableFAQ, enableServiceStatus, enableBilling, enableTickets, enableLiveChat, enableKnowledgeBase, liveChatEmbedHtml: liveChatEmbedHtml.trim() || undefined }
      });
      
      success = 'Features saved successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save features';
    } finally {
      saving = false;
    }
  }

  async function saveAlert() {
    saving = true;
    error = '';
    
    try {
      const token = await authService.getAuthTokenForApi();
      const method = editingAlertId ? 'PUT' : 'POST';
      const url = editingAlertId 
        ? `${API_URL}/portal-content/${tenantId}/alerts/${editingAlertId}`
        : `${API_URL}/portal-content/${tenantId}/alerts`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAlert)
      });
      
      if (!response.ok) throw new Error('Failed to save alert');
      
      await loadAlerts();
      resetAlertForm();
      success = 'Alert saved successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function deleteAlert(alertId: string) {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/alerts/${alertId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete alert');
      
      await loadAlerts();
      success = 'Alert deleted successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  function editAlert(alert: Alert) {
    newAlert = { ...alert };
    editingAlertId = alert._id || null;
    showAlertForm = true;
  }

  function resetAlertForm() {
    newAlert = { title: '', message: '', type: 'info', status: 'active' };
    editingAlertId = null;
    showAlertForm = false;
  }

  async function saveFAQ() {
    saving = true;
    error = '';
    
    try {
      const token = await authService.getAuthTokenForApi();
      const method = editingFAQId ? 'PUT' : 'POST';
      const url = editingFAQId 
        ? `${API_URL}/portal-content/${tenantId}/faq/${editingFAQId}`
        : `${API_URL}/portal-content/${tenantId}/faq`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newFAQ)
      });
      
      if (!response.ok) throw new Error('Failed to save FAQ');
      
      await loadFAQItems();
      resetFAQForm();
      success = 'FAQ saved successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function deleteFAQ(faqId: string) {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/faq/${faqId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete FAQ');
      
      await loadFAQItems();
      success = 'FAQ deleted successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  function editFAQ(faq: FAQItem) {
    newFAQ = { ...faq };
    editingFAQId = faq._id || null;
    showFAQForm = true;
  }

  function resetFAQForm() {
    newFAQ = { question: '', answer: '', category: 'General', order: 0, published: true };
    editingFAQId = null;
    showFAQForm = false;
  }

  async function saveArticle() {
    saving = true;
    error = '';
    
    try {
      const token = await authService.getAuthTokenForApi();
      const method = editingArticleId ? 'PUT' : 'POST';
      const url = editingArticleId 
        ? `${API_URL}/portal-content/${tenantId}/knowledge-base/${editingArticleId}`
        : `${API_URL}/portal-content/${tenantId}/knowledge-base`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newArticle)
      });
      
      if (!response.ok) throw new Error('Failed to save article');
      
      await loadKBArticles();
      resetArticleForm();
      success = 'Article saved successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function deleteArticle(articleId: string) {
    if (!confirm('Are you sure you want to delete this article?')) return;
    
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/knowledge-base/${articleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete article');
      
      await loadKBArticles();
      success = 'Article deleted successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    }
  }

  function editArticle(article: KBArticle) {
    newArticle = { ...article };
    articleTagInput = article.tags?.join(', ') || '';
    editingArticleId = article._id || null;
    showArticleForm = true;
  }

  function resetArticleForm() {
    newArticle = { title: '', content: '', category: 'Getting Started', tags: [], published: true };
    articleTagInput = '';
    editingArticleId = null;
    showArticleForm = false;
  }

  function addTag() {
    if (articleTagInput.trim()) {
      const tags = articleTagInput.split(',').map(t => t.trim()).filter(t => t);
      newArticle.tags = [...new Set([...newArticle.tags, ...tags])];
      articleTagInput = '';
    }
  }

  function removeTag(tag: string) {
    newArticle.tags = newArticle.tags.filter(t => t !== tag);
  }

  async function saveChatSettings() {
    saving = true;
    error = '';
    
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${API_URL}/portal-content/${tenantId}/chat-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(chatSettings)
      });
      
      if (!response.ok) throw new Error('Failed to save chat settings');
      
      success = 'Chat settings saved successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function getPortalUrl() {
    if (enableCustomDomain && customDomain) {
      return `https://${customDomain}`;
    }
    const portalPath = portalSubdomain || tenantId?.slice(0, 12) || 'portal';
    return `https://wisptools.io/wisp-management/portal/${portalPath}`;
  }

  function getAlertTypeIcon(type: string) {
    switch (type) {
      case 'outage': return '🔴';
      case 'maintenance': return '🟡';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  function getAlertStatusBadge(status: string) {
    switch (status) {
      case 'active': return 'status-active';
      case 'resolved': return 'status-resolved';
      case 'scheduled': return 'status-scheduled';
      default: return '';
    }
  }
</script>

<TenantGuard>
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading portal settings...</p>
    </div>
  {:else}
  <div class="portal-admin-page">
    <div class="page-header">
      <div class="header-left">
        <button class="back-btn" on:click={() => goto('/modules')} title="Back to Modules">
          ← Exit to Modules
        </button>
      </div>
      <div class="header-content">
        <h1>🌐 Customer Portal Management</h1>
        <p class="subtitle">Configure your customer-facing portal, content, and support features</p>
      </div>
      <div class="header-actions">
        <a href={getPortalUrl()} target="_blank" class="btn-secondary">
          View Portal →
        </a>
      </div>
    </div>
    
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}
    
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}
    
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button class="tab-btn" class:active={currentTab === 'branding'} on:click={() => currentTab = 'branding'}>
        🎨 Branding
      </button>
      <button class="tab-btn" class:active={currentTab === 'features'} on:click={() => currentTab = 'features'}>
        ⚙️ Features
      </button>
      <button class="tab-btn" class:active={currentTab === 'billing'} on:click={() => currentTab = 'billing'}>
        💳 Billing Portal
      </button>
      <button class="tab-btn" class:active={currentTab === 'alerts'} on:click={() => currentTab = 'alerts'}>
        🚨 Alerts & Outages
      </button>
      <button class="tab-btn" class:active={currentTab === 'faq'} on:click={() => currentTab = 'faq'}>
        ❓ FAQ
      </button>
      <button class="tab-btn" class:active={currentTab === 'knowledge'} on:click={() => currentTab = 'knowledge'}>
        📚 Knowledge Base
      </button>
      <button class="tab-btn" class:active={currentTab === 'chat'} on:click={() => currentTab = 'chat'}>
        💬 Live Chat
      </button>
    </div>
    
    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Branding Tab -->
      {#if currentTab === 'branding'}
        <div class="content-section">
          <h2>Portal Branding</h2>
          <p class="section-description">Customize the look and feel of your customer portal.</p>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Company Name</label>
              <div class="readonly-value">{companyName || 'Not set'}</div>
              <p class="help-text">Managed from tenant settings</p>
            </div>
            
            <div class="form-group">
              <label>Portal URL</label>
              <div class="readonly-value url-value">{getPortalUrl()}</div>
            </div>
            
            <div class="form-group">
              <label>Logo URL</label>
              <input type="url" bind:value={logoUrl} placeholder="https://yourcompany.com/logo.png" class="form-input" />
              {#if logoUrl}
                <div class="logo-preview">
                  <img src={logoUrl} alt="Logo preview" />
                </div>
              {/if}
            </div>
            
            <div class="form-group">
              <label>Primary Color</label>
              <div class="color-input-group">
                <input type="color" bind:value={primaryColor} class="color-picker" />
                <input type="text" bind:value={primaryColor} placeholder="#3b82f6" class="form-input color-text" />
              </div>
            </div>
            
            <div class="form-group">
              <label>Support Email</label>
              <input type="email" bind:value={supportEmail} placeholder="support@yourcompany.com" class="form-input" />
            </div>
            
            <div class="form-group">
              <label>Support Phone</label>
              <input type="tel" bind:value={supportPhone} placeholder="(555) 123-4567" class="form-input" />
            </div>
            
            <div class="form-group full-width">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={enableCustomDomain} />
                <span>Use Custom Domain</span>
              </label>
              {#if enableCustomDomain}
                <input type="text" bind:value={customDomain} placeholder="portal.yourcompany.com" class="form-input" />
                <p class="help-text">Point your domain's CNAME record to: <code>wisptools.io</code></p>
              {/if}
            </div>
          </div>
          
          <div class="form-actions">
            <button class="btn-primary" on:click={saveBranding} disabled={saving}>
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Billing Portal Tab: payment gateways & invoice customization -->
      {#if currentTab === 'billing'}
        <div class="content-section">
          <h2>Billing Portal Admin</h2>
          <p class="section-description">Configure payment gateways (Stripe, PayPal) and customize how invoices look for your customers.</p>
          
          <div class="billing-portal-sections">
            <section class="billing-subsection">
              <h3>Payment Gateways</h3>
              <p class="help-text">Enable online payments in the customer portal. Store Stripe secret key in backend env (STRIPE_SECRET_KEY); use the publishable key here for the portal. For PayPal, use your client ID and choose sandbox for testing.</p>
              
              <div class="form-grid">
                <div class="form-group full-width">
                  <label class="toggle-label">
                    <input type="checkbox" bind:checked={stripeEnabled} />
                    <span class="toggle-switch"></span>
                    <span>Enable Stripe</span>
                  </label>
                  <input type="text" bind:value={stripePublicKey} placeholder="pk_live_... or pk_test_... (publishable key)" class="form-input" />
                  <input type="text" bind:value={stripeNote} placeholder="Optional note (e.g. key purpose)" class="form-input" />
                </div>
                <div class="form-group full-width">
                  <label class="toggle-label">
                    <input type="checkbox" bind:checked={paypalEnabled} />
                    <span class="toggle-switch"></span>
                    <span>Enable PayPal</span>
                  </label>
                  <input type="text" bind:value={paypalClientId} placeholder="PayPal client ID" class="form-input" />
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={paypalSandbox} />
                    Use PayPal sandbox (testing)
                  </label>
                  <input type="text" bind:value={paypalNote} placeholder="Optional note" class="form-input" />
                </div>
              </div>
            </section>
            
            <section class="billing-subsection">
              <h3>Invoice Customization</h3>
              <p class="help-text">These appear on generated invoices and in the customer billing portal.</p>
              
              <div class="form-grid">
                <div class="form-group">
                  <label>Company name on invoices</label>
                  <input type="text" bind:value={invoiceCompanyName} placeholder="Your WISP Name" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Invoice logo URL</label>
                  <input type="url" bind:value={invoiceLogoUrl} placeholder="https://..." class="form-input" />
                </div>
                <div class="form-group full-width">
                  <label>Address (on invoice)</label>
                  <input type="text" bind:value={invoiceAddress} placeholder="Street, City, State ZIP" class="form-input" />
                </div>
                <div class="form-group full-width">
                  <label>Footer text</label>
                  <input type="text" bind:value={invoiceFooterText} placeholder="Thank you for your business" class="form-input" />
                </div>
                <div class="form-group full-width">
                  <label>Terms & conditions</label>
                  <textarea bind:value={invoiceTermsAndConditions} placeholder="Payment terms, late fees, etc." class="form-input" rows="4"></textarea>
                </div>
                <div class="form-group">
                  <label>Default due days</label>
                  <input type="number" min="1" max="90" bind:value={invoiceDueDays} class="form-input" />
                </div>
                <div class="form-group">
                  <label>Currency</label>
                  <select bind:value={invoiceCurrency} class="form-input">
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </section>
          </div>
          
          <div class="form-actions">
            <button class="btn-primary" on:click={saveBillingPortal} disabled={saving}>
              {saving ? 'Saving...' : 'Save Billing Portal Settings'}
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Features Tab -->
      {#if currentTab === 'features'}
        <div class="content-section">
          <h2>Portal Features</h2>
          <p class="section-description">Enable or disable features for your customer portal.</p>
          
          <div class="feature-toggles">
            <div class="feature-toggle">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={enableFAQ} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">❓ FAQ / Help Center</span>
                  <span class="toggle-description">Show frequently asked questions to customers</span>
                </div>
              </label>
            </div>
            
            <div class="feature-toggle">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={enableServiceStatus} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">🚨 Service Status & Outages</span>
                  <span class="toggle-description">Display service alerts and outage notifications</span>
                </div>
              </label>
            </div>
            
            <div class="feature-toggle">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={enableBilling} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">💳 Billing & Invoices</span>
                  <span class="toggle-description">Let customers view billing and invoice history</span>
                </div>
              </label>
            </div>
            
            <div class="feature-toggle">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={enableTickets} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">🎫 Support Tickets</span>
                  <span class="toggle-description">Let customers open and track support tickets</span>
                </div>
              </label>
            </div>
            
            <div class="feature-toggle">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={enableKnowledgeBase} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">📚 Knowledge Base</span>
                  <span class="toggle-description">Provide documentation and help articles</span>
                </div>
              </label>
            </div>
            
            <div class="feature-toggle">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={enableLiveChat} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">💬 Live Chat Support</span>
                  <span class="toggle-description">Enable real-time chat with customers</span>
                </div>
              </label>
              {#if enableLiveChat}
                <div class="form-group" style="margin-top: 0.75rem; margin-left: 2.5rem;">
                  <label>Chat widget embed code (e.g. Tawk.to, Crisp, Intercom)</label>
                  <textarea bind:value={liveChatEmbedHtml} rows="4" class="form-input" placeholder="Paste the &lt;script&gt;...&lt;/script&gt; snippet from your chat provider"></textarea>
                  <p class="hint">Paste the full script tag(s) from your chat provider. The widget will load on all portal pages when Live Chat is enabled.</p>
                </div>
              {/if}
            </div>
          </div>
          
          <div class="form-actions">
            <button class="btn-primary" on:click={saveFeatures} disabled={saving}>
              {saving ? 'Saving...' : 'Save Features'}
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Alerts Tab -->
      {#if currentTab === 'alerts'}
        <div class="content-section">
          <div class="section-header">
            <div>
              <h2>Alerts & Outages</h2>
              <p class="section-description">Notify customers about service issues, maintenance, and updates.</p>
            </div>
            <button class="btn-primary" on:click={() => showAlertForm = true}>
              + New Alert
            </button>
          </div>
          
          {#if showAlertForm}
            <div class="form-card">
              <h3>{editingAlertId ? 'Edit Alert' : 'Create New Alert'}</h3>
              
              <div class="form-grid">
                <div class="form-group">
                  <label>Title</label>
                  <input type="text" bind:value={newAlert.title} placeholder="Alert title" class="form-input" />
                </div>
                
                <div class="form-group">
                  <label>Type</label>
                  <select bind:value={newAlert.type} class="form-input">
                    <option value="info">ℹ️ Information</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="outage">🔴 Outage</option>
                    <option value="maintenance">🟡 Maintenance</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Status</label>
                  <select bind:value={newAlert.status} class="form-input">
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                
                <div class="form-group full-width">
                  <label>Message</label>
                  <textarea bind:value={newAlert.message} placeholder="Alert message..." class="form-input" rows="3"></textarea>
                </div>
                
                <div class="form-group">
                  <label>Start Date (optional)</label>
                  <input type="datetime-local" bind:value={newAlert.startDate} class="form-input" />
                </div>
                
                <div class="form-group">
                  <label>End Date (optional)</label>
                  <input type="datetime-local" bind:value={newAlert.endDate} class="form-input" />
                </div>
              </div>
              
              <div class="form-actions">
                <button class="btn-secondary" on:click={resetAlertForm}>Cancel</button>
                <button class="btn-primary" on:click={saveAlert} disabled={saving || !newAlert.title || !newAlert.message}>
                  {saving ? 'Saving...' : 'Save Alert'}
                </button>
              </div>
            </div>
          {/if}
          
          <div class="items-list">
            {#if alerts.length === 0}
              <div class="empty-state">
                <p>No alerts yet. Create one to notify your customers.</p>
              </div>
            {:else}
              {#each alerts as alert}
                <div class="list-item">
                  <div class="item-icon">{getAlertTypeIcon(alert.type)}</div>
                  <div class="item-content">
                    <div class="item-header">
                      <h4>{alert.title}</h4>
                      <span class="status-badge {getAlertStatusBadge(alert.status)}">{alert.status}</span>
                    </div>
                    <p class="item-description">{alert.message}</p>
                  </div>
                  <div class="item-actions">
                    <button class="btn-icon" on:click={() => editAlert(alert)} title="Edit">✏️</button>
                    <button class="btn-icon danger" on:click={() => deleteAlert(alert._id || '')} title="Delete">🗑️</button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- FAQ Tab -->
      {#if currentTab === 'faq'}
        <div class="content-section">
          <div class="section-header">
            <div>
              <h2>FAQ Management</h2>
              <p class="section-description">Create and manage frequently asked questions.</p>
            </div>
            <button class="btn-primary" on:click={() => showFAQForm = true}>
              + New FAQ
            </button>
          </div>
          
          {#if showFAQForm}
            <div class="form-card">
              <h3>{editingFAQId ? 'Edit FAQ' : 'Create New FAQ'}</h3>
              
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>Question</label>
                  <input type="text" bind:value={newFAQ.question} placeholder="What is your question?" class="form-input" />
                </div>
                
                <div class="form-group">
                  <label>Category</label>
                  <select bind:value={newFAQ.category} class="form-input">
                    {#each faqCategories as category}
                      <option value={category}>{category}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="checkbox-label inline">
                    <input type="checkbox" bind:checked={newFAQ.published} />
                    <span>Published</span>
                  </label>
                </div>
                
                <div class="form-group full-width">
                  <label>Answer</label>
                  <textarea bind:value={newFAQ.answer} placeholder="Provide the answer..." class="form-input" rows="4"></textarea>
                </div>
              </div>
              
              <div class="form-actions">
                <button class="btn-secondary" on:click={resetFAQForm}>Cancel</button>
                <button class="btn-primary" on:click={saveFAQ} disabled={saving || !newFAQ.question || !newFAQ.answer}>
                  {saving ? 'Saving...' : 'Save FAQ'}
                </button>
              </div>
            </div>
          {/if}
          
          <div class="items-list">
            {#if faqItems.length === 0}
              <div class="empty-state">
                <p>No FAQs yet. Create some to help your customers.</p>
              </div>
            {:else}
              {#each faqItems as faq}
                <div class="list-item">
                  <div class="item-icon">❓</div>
                  <div class="item-content">
                    <div class="item-header">
                      <h4>{faq.question}</h4>
                      <span class="category-badge">{faq.category}</span>
                      {#if !faq.published}
                        <span class="status-badge status-draft">Draft</span>
                      {/if}
                    </div>
                    <p class="item-description">{faq.answer.substring(0, 150)}...</p>
                  </div>
                  <div class="item-actions">
                    <button class="btn-icon" on:click={() => editFAQ(faq)} title="Edit">✏️</button>
                    <button class="btn-icon danger" on:click={() => deleteFAQ(faq._id || '')} title="Delete">🗑️</button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Knowledge Base Tab -->
      {#if currentTab === 'knowledge'}
        <div class="content-section">
          <div class="section-header">
            <div>
              <h2>Knowledge Base</h2>
              <p class="section-description">Create help articles and documentation for customers.</p>
            </div>
            <button class="btn-primary" on:click={() => showArticleForm = true}>
              + New Article
            </button>
          </div>
          
          {#if showArticleForm}
            <div class="form-card">
              <h3>{editingArticleId ? 'Edit Article' : 'Create New Article'}</h3>
              
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>Title</label>
                  <input type="text" bind:value={newArticle.title} placeholder="Article title" class="form-input" />
                </div>
                
                <div class="form-group">
                  <label>Category</label>
                  <select bind:value={newArticle.category} class="form-input">
                    <option value="Getting Started">Getting Started</option>
                    <option value="Account">Account</option>
                    <option value="Billing">Billing</option>
                    <option value="Technical">Technical</option>
                    <option value="Troubleshooting">Troubleshooting</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="checkbox-label inline">
                    <input type="checkbox" bind:checked={newArticle.published} />
                    <span>Published</span>
                  </label>
                </div>
                
                <div class="form-group full-width">
                  <label>Tags</label>
                  <div class="tags-input">
                    <input type="text" bind:value={articleTagInput} placeholder="Add tags (comma separated)" class="form-input" on:keypress={(e) => e.key === 'Enter' && addTag()} />
                    <button class="btn-secondary btn-sm" on:click={addTag}>Add</button>
                  </div>
                  <div class="tags-list">
                    {#each newArticle.tags as tag}
                      <span class="tag">{tag} <button on:click={() => removeTag(tag)}>×</button></span>
                    {/each}
                  </div>
                </div>
                
                <div class="form-group full-width">
                  <label>Content</label>
                  <textarea bind:value={newArticle.content} placeholder="Write your article content..." class="form-input" rows="8"></textarea>
                </div>
              </div>
              
              <div class="form-actions">
                <button class="btn-secondary" on:click={resetArticleForm}>Cancel</button>
                <button class="btn-primary" on:click={saveArticle} disabled={saving || !newArticle.title || !newArticle.content}>
                  {saving ? 'Saving...' : 'Save Article'}
                </button>
              </div>
            </div>
          {/if}
          
          <div class="items-list">
            {#if kbArticles.length === 0}
              <div class="empty-state">
                <p>No articles yet. Create documentation to help your customers.</p>
              </div>
            {:else}
              {#each kbArticles as article}
                <div class="list-item">
                  <div class="item-icon">📄</div>
                  <div class="item-content">
                    <div class="item-header">
                      <h4>{article.title}</h4>
                      <span class="category-badge">{article.category}</span>
                      {#if !article.published}
                        <span class="status-badge status-draft">Draft</span>
                      {/if}
                    </div>
                    <p class="item-description">{article.content.substring(0, 150)}...</p>
                    {#if article.tags?.length}
                      <div class="tags-list small">
                        {#each article.tags as tag}
                          <span class="tag">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <div class="item-actions">
                    <button class="btn-icon" on:click={() => editArticle(article)} title="Edit">✏️</button>
                    <button class="btn-icon danger" on:click={() => deleteArticle(article._id || '')} title="Delete">🗑️</button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Live Chat Tab -->
      {#if currentTab === 'chat'}
        <div class="content-section">
          <h2>Live Chat Settings</h2>
          <p class="section-description">Configure real-time chat support for your customers.</p>
          
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={chatSettings.enabled} />
                <span class="toggle-switch"></span>
                <div class="toggle-content">
                  <span class="toggle-title">Enable Live Chat</span>
                  <span class="toggle-description">Show chat widget on customer portal</span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label>Welcome Message</label>
              <textarea bind:value={chatSettings.welcomeMessage} placeholder="Hello! How can we help?" class="form-input" rows="2"></textarea>
            </div>
            
            <div class="form-group full-width">
              <label>Offline Message</label>
              <textarea bind:value={chatSettings.offlineMessage} placeholder="We're offline, leave a message..." class="form-input" rows="2"></textarea>
            </div>
            
            <div class="form-group full-width">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={chatSettings.operatingHours.enabled} />
                <span>Set Operating Hours</span>
              </label>
            </div>
            
            {#if chatSettings.operatingHours.enabled}
              <div class="form-group">
                <label>Start Time</label>
                <input type="time" bind:value={chatSettings.operatingHours.start} class="form-input" />
              </div>
              
              <div class="form-group">
                <label>End Time</label>
                <input type="time" bind:value={chatSettings.operatingHours.end} class="form-input" />
              </div>
            {/if}
            
            <div class="form-group full-width">
              <h4>Auto Responses</h4>
            </div>
            
            <div class="form-group full-width">
              <label>Greeting Message</label>
              <textarea bind:value={chatSettings.autoResponses.greeting} class="form-input" rows="2"></textarea>
            </div>
            
            <div class="form-group full-width">
              <label>Away Message</label>
              <textarea bind:value={chatSettings.autoResponses.away} class="form-input" rows="2"></textarea>
            </div>
            
            <div class="form-group full-width">
              <label>Closed Message</label>
              <textarea bind:value={chatSettings.autoResponses.closed} class="form-input" rows="2"></textarea>
            </div>
          </div>
          
          <div class="form-actions">
            <button class="btn-primary" on:click={saveChatSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Chat Settings'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {/if}
</TenantGuard>

<style>
  .portal-admin-page {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;
  }
  
  .header-left {
    flex-shrink: 0;
  }
  
  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .back-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }
  
  .header-content {
    flex: 1;
    text-align: center;
  }
  
  .page-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }
  
  .tab-navigation {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 2rem;
    overflow-x: auto;
    padding-bottom: 0;
  }
  
  .tab-btn {
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    white-space: nowrap;
    transition: all 0.2s;
  }
  
  .tab-btn:hover {
    color: var(--text-primary);
  }
  
  .tab-btn.active {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
  }
  
  .tab-content {
    min-height: 500px;
  }
  
  .content-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 2rem;
  }
  
  .billing-portal-sections { margin-top: 1.5rem; }
  .billing-subsection {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }
  .billing-subsection:last-of-type { border-bottom: none; }
  .billing-subsection h3 { font-size: 1.125rem; margin-bottom: 0.75rem; color: #374151; }

  .content-section h2 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .section-description {
    color: var(--text-secondary);
    margin: 0 0 2rem 0;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .form-group.full-width {
    grid-column: 1 / -1;
  }
  
  .form-group label {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .form-input {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1rem;
    width: 100%;
  }
  
  .form-input:focus {
    outline: none;
    border-color: var(--brand-primary);
  }
  
  textarea.form-input {
    resize: vertical;
    min-height: 80px;
  }
  
  .readonly-value {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
  }
  
  .url-value {
    font-family: monospace;
    color: var(--brand-primary);
  }
  
  .help-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .color-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .color-picker {
    width: 50px;
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
  }
  
  .color-text {
    flex: 1;
  }
  
  .logo-preview {
    margin-top: 0.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    text-align: center;
  }
  
  .logo-preview img {
    max-height: 60px;
    max-width: 200px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }
  
  .checkbox-label.inline {
    flex-direction: row;
  }
  
  .feature-toggles {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .feature-toggle {
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    padding: 1rem 1.5rem;
  }
  
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
  }
  
  .toggle-label input[type="checkbox"] {
    display: none;
  }
  
  .toggle-switch {
    width: 48px;
    height: 24px;
    background: var(--border-color);
    border-radius: 12px;
    position: relative;
    transition: background 0.2s;
  }
  
  .toggle-switch::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }
  
  .toggle-label input:checked + .toggle-switch {
    background: var(--brand-primary);
  }
  
  .toggle-label input:checked + .toggle-switch::after {
    transform: translateX(24px);
  }
  
  .toggle-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .toggle-title {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .toggle-description {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--gradient-primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
  
  .btn-icon {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 1.1rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .btn-icon:hover {
    opacity: 1;
  }
  
  .btn-icon.danger:hover {
    color: var(--danger);
  }
  
  .form-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .form-card h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
  }
  
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .list-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }
  
  .item-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  
  .item-content {
    flex: 1;
    min-width: 0;
  }
  
  .item-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  
  .item-header h4 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .item-description {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  
  .item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-active {
    background: var(--success-light);
    color: var(--success);
  }
  
  .status-resolved {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }
  
  .status-scheduled {
    background: var(--warning-light);
    color: var(--warning);
  }
  
  .status-draft {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }
  
  .category-badge {
    padding: 0.25rem 0.75rem;
    background: var(--brand-primary-light);
    color: var(--brand-primary);
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .tags-input {
    display: flex;
    gap: 0.5rem;
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .tags-list.small {
    margin-top: 0.75rem;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  .tag button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1;
  }
  
  .tag button:hover {
    color: var(--danger);
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .alert {
    padding: 1rem;
    border-radius: var(--border-radius);
    margin-bottom: 1.5rem;
  }
  
  .alert-error {
    background: var(--danger-light);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
  
  .alert-success {
    background: var(--success-light);
    color: var(--success);
    border: 1px solid var(--success);
  }
  
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(59, 130, 246, 0.1);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @media (max-width: 768px) {
    .portal-admin-page {
      padding: 1rem;
    }
    
    .page-header {
      flex-direction: column;
      gap: 1rem;
    }
    
    .form-grid {
      grid-template-columns: 1fr;
    }
    
    .tab-navigation {
      gap: 0;
    }
    
    .tab-btn {
      padding: 0.75rem 1rem;
      font-size: 0.9rem;
    }
    
    .list-item {
      flex-direction: column;
    }
    
    .item-actions {
      align-self: flex-end;
    }
  }
</style>
