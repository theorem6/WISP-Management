# Connect management.wisptools.io to the app site

The app (WISP Management) is deployed to the **wisptools-management** Firebase Hosting site. For **management.wisptools.io** to show the app, the custom domain must be attached to **that** site, not the default one.

## Steps in Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Hosting**.
2. You should see **two sites**:
   - **wisptools-production** (default) → wisptools.io landing page
   - **wisptools-management** → WISP Management app
3. Click the **wisptools-management** row (or its name) to open that site.
4. In that site’s settings, click **Add custom domain**.
5. Enter **management.wisptools.io** and follow the DNS verification steps (add the TXT and A/AAAA records Firebase shows).
6. After verification, Firebase will serve the app on management.wisptools.io.

## If management.wisptools.io shows the landing page or 404

- **Landing page:** The domain is likely attached to **wisptools-production**. Remove it from that site and add it to **wisptools-management** (step 3 above).
- **404:** The domain may not be connected to any site, or DNS is still propagating. Add the domain to **wisptools-management** and wait for DNS (up to 24–48 hours, often minutes).

## Verify without custom domain

- **App (management site):** https://wisptools-management.web.app  
- **Landing (default site):** https://wisptools-production.web.app  

If the app loads at wisptools-management.web.app but not at management.wisptools.io, the fix is connecting management.wisptools.io to the **wisptools-management** site as above.
