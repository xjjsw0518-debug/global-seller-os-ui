# Global Seller OS UI_MASTER_V2 — Worker Resource Center

This is a preview-only Vite implementation based on the supplied Global Seller OS, global resource map, Indonesia/Jakarta drill-down, and Add Resource references.

## Start

```bash
npm install
npm run dev
```

Preview: `http://127.0.0.1:5173/ui-v2/worker-resources`

## Preview routes

- `/ui-v2/worker-resources` — global resource center.
- `/ui-v2/worker-resources/country/indonesia` — Indonesia drill-down.
- `/ui-v2/worker-resources/city/jakarta` — Jakarta drill-down.
- `/ui-v2/worker-resources/add/vps` — two-step VPS resource flow.
- `/ui-v2/worker-resources/add/mobile` — two-step mobile RPA flow without ADB or RDP.
- `/ui-v2/worker-resources/package/browser` — VPS software Package configuration and simulated install progress.
- `/ui-v2/worker-resources/package/mobile` — mobile software Package configuration without USB, scrcpy, ADB, or RDP.
- `/ui-v2/worker-resources/bulk-import` — bulk import and validation preview.
- `/ui-v2/worker-resources/bulk-progress` — per-resource simulated import/installation progress, detail, retry, command copy/download.
- `/ui-v2/worker-resources/ready/vps` — VPS RPA ready-for-business result.
- `/ui-v2/worker-resources/ready/mobile` — mobile RPA ready-for-business result.

In development, the bottom-left `DEV PREVIEW` switcher opens the main, country, city, add, Package, bulk, progress, and ready states. The map interaction order is Global → country → city → resource detail. Add flow: basic info → Agent/runtime → Package configuration → ready.

## Implementation map

- Shared shell and interaction components: `src/App.jsx`, `src/ui/index.jsx`.
- Theme V2 tokens: `src/ui/theme-v2.css`.
- Preview mock data and Package Profiles: `src/mock/workerResources.js`.
- Country-only drill-down silhouettes: `src/CountryOutlineMap.jsx` using Natural Earth country boundaries redistributed by `world-atlas`; curated city centers are in `src/mock/cityCoordinates.js`. Global status points use explicit country ownership and anchors calibrated to the bundled world map image. These are preview positions, not server geolocation.
- Network-sourced provider logos: `public/assets/brand/` (Simple Icons CDN assets plus provider favicons where no matching Simple Icon exists).
- Searchable ISO country/territory list: `src/mock/countries.js`; full-color flags use FlagCDN's published `https://flagcdn.com/{code}.svg` URL, with existing local preview assets as fallback for featured countries.
- Bulk Excel template and browser-only validation: `src/BulkImportV3.jsx` (`provider_name`, `provider_console_url`, `provider_logo_url`, country code/name and VPS/mobile connection fields).
- Package configuration UI: `src/PackageConfig.jsx`. Its installation states/logs are simulated and must not be interpreted as real installation results.
- Ready-page software rows reuse `PackageLogo` from Package configuration, including internal Browser Extension, Worker, Agent and MCP assets. The RPA plan uses a distinct plan icon.
- Bulk progress UI: `src/BulkProgress.jsx`. It uses browser-only rows and preview Mock statuses.
- Ready VPS illustration: `public/assets/vps-ready-illustration.png`; Chrome, Playwright and Stagehand marks: `public/assets/brand/googlechrome.svg`, `public/assets/brand/playwright.svg`, and `public/assets/brand/stagehand.svg`. Playwright and Stagehand marks were sourced from their official GitHub repositories; Chrome uses the published Simple Icons rendering.
- Responsive presentation: `src/styles.css`.
- Visual QA record: `design-qa.md`.

## Responsive rules

The shell keeps the sidebar/header geometry at desktop widths. The layout supports 2560, 1920, and 1440 desktop compositions without `transform: scale()`. The Worker home map sits in a dedicated center column so summary/ranking cards never cover map points. Dense tables use horizontal scrolling at smaller desktop widths; the preview does not use screenshot backgrounds or canvas replacements for the UI.

## API handoff

`PREVIEW_ONLY = true` and `BUSINESS_BACKEND_CONNECTED = NO`. Replace the mock module with API adapters only after UI_LOCKED is explicitly confirmed by the user. Production routes, backend, database, API contracts, Worker/Runtime/RPA, and AI Center are out of scope for this batch. The RDP test is format-only; Zero-Touch commands are display/copy/download prototypes and are not run by the UI.

Global, country and city maps can be dragged in four directions. Starting a drag at 1× zooms to 1.25× so the map never exposes a blank edge. Map controls still provide zoom and resource focus. Country view draws only the selected country; city dots use curated locations and Chinese display names. Edits to the preview resource form are reflected in the local resource list, filter/search, map rows and detail during the current browser session only. This is not persistent storage.

The resource list paginates actual loaded preview rows and distinguishes them from illustrative KPI totals. Client-side delete/export, account popover, log filtering/download, Zero-Touch command copy/regenerate/download, and bulk Excel revalidation respond in the browser. These do not delete business records or install packages. The resource detail remote button explains why an authorized Windows desktop helper is required; it does not open a live session in Preview.
