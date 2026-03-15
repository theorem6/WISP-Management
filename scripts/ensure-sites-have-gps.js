#!/usr/bin/env node
/**
 * Ensure All Sites Have GPS Coordinates
 * 
 * This script:
 * 1. Finds all sites missing GPS coordinates
 * 2. Attempts to geocode addresses for sites with addresses but no coordinates
 * 3. Reports sites that need manual coordinate entry
 */

const mongoose = require('mongoose');
const { UnifiedSite } = require('../models/network');
const appConfig = require('../config/app');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || '';

// Geocoding configuration
const arcgisConfig = appConfig?.externalServices?.arcgis || {};
const geocodeUrl = arcgisConfig.geocodeUrl;
const apiKey = arcgisConfig.apiKey;

/**
 * Geocode an address using ArcGIS or Nominatim
 */
async function geocodeAddress(address) {
  // Try ArcGIS first if configured
  if (geocodeUrl && apiKey) {
    try {
      const params = new URLSearchParams({
        f: 'json',
        singleLine: address,
        outFields: 'Match_addr,Addr_type'
      });
      params.set('token', apiKey);

      const response = await fetch(`${geocodeUrl}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
          const best = data.candidates[0];
          return {
            latitude: best?.location?.y,
            longitude: best?.location?.x,
            address: best?.address || best?.attributes?.Match_addr
          };
        }
      }
    } catch (error) {
      console.warn(`[Geocode] ArcGIS failed for "${address}":`, error.message);
    }
  }

  // Fallback to Nominatim
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      format: 'jsonv2',
      q: address,
      addressdetails: '1',
      limit: '1'
    }).toString()}`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'WISP-Management-Site-Geocoder/1.0 (support@wisptools.io)',
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results[0];
        return {
          latitude: best.lat ? Number(best.lat) : undefined,
          longitude: best.lon ? Number(best.lon) : undefined,
          address: best.display_name || address
        };
      }
    }
  } catch (error) {
    console.warn(`[Geocode] Nominatim failed for "${address}":`, error.message);
  }

  return null;
}

/**
 * Build address string from site location object
 */
function buildAddressString(location) {
  if (!location) return null;
  
  const parts = [];
  if (location.address) parts.push(location.address);
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (location.zipCode) parts.push(location.zipCode);
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Ensuring all sites have GPS coordinates...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all sites
    const allSites = await UnifiedSite.find({}).lean();
    console.log(`📊 Found ${allSites.length} total sites\n`);

    // Categorize sites
    const sitesWithCoords = [];
    const sitesWithoutCoords = [];
    const sitesWithAddressOnly = [];

    for (const site of allSites) {
      const hasCoords = site.location?.latitude && 
                       site.location?.longitude &&
                       typeof site.location.latitude === 'number' &&
                       typeof site.location.longitude === 'number' &&
                       site.location.latitude !== 0 &&
                       site.location.longitude !== 0;

      if (hasCoords) {
        sitesWithCoords.push(site);
      } else {
        sitesWithoutCoords.push(site);
        
        // Check if site has address information
        const addressStr = buildAddressString(site.location);
        if (addressStr) {
          sitesWithAddressOnly.push({ site, address: addressStr });
        }
      }
    }

    console.log('📈 Site Analysis:');
    console.log(`   ✅ Sites with GPS coordinates: ${sitesWithCoords.length}`);
    console.log(`   ❌ Sites without GPS coordinates: ${sitesWithoutCoords.length}`);
    console.log(`   📍 Sites with address (can geocode): ${sitesWithAddressOnly.length}\n`);

    if (sitesWithoutCoords.length === 0) {
      console.log('✅ All sites already have GPS coordinates!\n');
      await mongoose.disconnect();
      return;
    }

    // Geocode sites with addresses
    console.log('🌍 Geocoding addresses...\n');
    let geocoded = 0;
    let failed = 0;
    const needsManualEntry = [];

    for (const { site, address } of sitesWithAddressOnly) {
      try {
        console.log(`   Geocoding: ${site.name} - ${address}`);
        const result = await geocodeAddress(address);
        
        if (result && result.latitude && result.longitude) {
          // Update site with coordinates
          await UnifiedSite.updateOne(
            { _id: site._id },
            {
              $set: {
                'location.latitude': result.latitude,
                'location.longitude': result.longitude,
                'location.address': result.address || address,
                updatedAt: new Date()
              }
            }
          );
          geocoded++;
          console.log(`   ✅ Updated: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}\n`);
        } else {
          failed++;
          needsManualEntry.push({ site, reason: 'Geocoding failed' });
          console.log(`   ❌ Geocoding failed\n`);
        }

        // Rate limiting for Nominatim (1 request per second)
        if (!geocodeUrl || !apiKey) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        failed++;
        needsManualEntry.push({ site, reason: error.message });
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

    // Report sites that still need manual entry
    const sitesWithoutAddress = sitesWithoutCoords.filter(site => {
      return !sitesWithAddressOnly.some(item => item.site._id.toString() === site._id.toString());
    });

    needsManualEntry.push(...sitesWithoutAddress.map(site => ({ 
      site, 
      reason: 'No address information available' 
    })));

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully geocoded: ${geocoded}`);
    console.log(`   ❌ Failed or needs manual entry: ${needsManualEntry.length}\n`);

    if (needsManualEntry.length > 0) {
      console.log('⚠️  Sites that need manual GPS coordinate entry:\n');
      needsManualEntry.forEach(({ site, reason }, index) => {
        console.log(`   ${index + 1}. ${site.name} (ID: ${site._id})`);
        console.log(`      Tenant: ${site.tenantId}`);
        console.log(`      Reason: ${reason}`);
        if (site.location?.address) {
          console.log(`      Address: ${site.location.address}`);
        }
        console.log('');
      });
    }

    // Final count
    const finalCheck = await UnifiedSite.countDocuments({
      $or: [
        { 'location.latitude': { $exists: false } },
        { 'location.longitude': { $exists: false } },
        { 'location.latitude': 0 },
        { 'location.longitude': 0 },
        { 'location.latitude': null },
        { 'location.longitude': null }
      ]
    });

    console.log(`\n✅ Final status: ${finalCheck} sites still need GPS coordinates\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { geocodeAddress, buildAddressString };
