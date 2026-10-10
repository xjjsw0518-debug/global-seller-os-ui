# Source-checked provider brand marks

Captured 2026-10-01 16:11 UTC from the Simple Icons color endpoint. Files are static local copies; the UI does not hotlink. This source endpoint does not expose a stable release number. Each exact retrieved SVG is pinned here by SHA-256. Simple Icons currently documents versioned jsDelivr URLs for package files, while its color endpoint returns the brand-color SVG; we retain the exact response bytes and source URLs as this dated snapshot.

The shapes are Simple Icons library assets linked to the listed brand source pages, not files downloaded directly from the vendors. Use is for personal, noncommercial product identification in the local prototype. Simple Icons' collection-level CC0 does not guarantee each icon is CC0; its disclaimer directs users to individual icon records and notes brands retain trademark rights. No endorsement or partnership is implied. Individual records currently contain no per-icon license field for these six assets.

| UI provider label | Asset | Simple Icons record/source | Official brand reference | SHA-256 | Notes |
|---|---|---|---|---|---|
| DigitalOcean | digitalocean.svg | https://cdn.simpleicons.org/digitalocean ; title DigitalOcean, #0080FF | https://www.digitalocean.com/press/ | A381454D22F05A4E7034C3E869C99BCAC9A6F915CCC00577ED131B604BAED489 | DigitalOcean press page links Brand Assets. |
| Google Cloud | googlecloud.svg | https://cdn.simpleicons.org/googlecloud ; title Google Cloud, #4285F4 | https://cloud.google.com/ | EB848405C6A1ED56510E7CC88FFE6E2E12CD8331BE4B0C8C31048D0B0E6D53A9 | Provider label remains Google Cloud. |
| Alibaba Cloud | alibabacloud.svg | https://cdn.simpleicons.org/alibabacloud ; title Alibaba Cloud, #FF6A00 | https://www.alibabagroup.com/en/ir/reports | CB21FC53F968AA327C69A21965684E3D82F87A183683611D20743FF233E3930D | Source metadata points to Alibaba Group investor reports. |
| Hetzner | hetzner.svg | https://cdn.simpleicons.org/hetzner ; title Hetzner, #D50C2D | https://www.hetzner.com/ | D3A7DC7E55D0E9008587F1407AF6C6FA197BB2B207B841A05A881D523A4C3DFB | Provider label remains Hetzner. |
| Vultr | vultr.svg | https://cdn.simpleicons.org/vultr ; title Vultr, #007BFC | https://www.vultr.com/company/brand-assets | 745A4EDE10C9F21A20E7FB3695573A457EAB1883C3FD39E971A0CB058EC357AE | Official brand-assets reference recorded. |
| Huawei Cloud | huawei.svg | https://cdn.simpleicons.org/huawei ; title Huawei, #FF0000 | https://e.huawei.com/ph/material/partner/0a72728b864949c48b22106454352483 | C5B0B049B2022D5B2391E34B7871D2580F97AD67DCAE053499DA49FF58AC27AC | Corporate Huawei mark paired with the unchanged “Huawei Cloud” provider label; not represented as the Huawei Cloud wordmark. |

## Provider coverage and remaining source gaps

The Worker UI maps 11 provider labels. Six have source-checked local marks listed above. The current mock fixture shows ten of those providers; Huawei Cloud is configured in the provider mapping but has no row in the visible fixture. Five providers remain on the neutral non-official placeholder: AWS, Microsoft Azure, Tencent Cloud, Linode, and Rackspace. The current Simple Icons slug catalog has no matching AWS, Microsoft Azure, Tencent Cloud, Linode, or Rackspace icon entry. Existing legacy files for these names remain untouched and unrendered because this project had no source/version/provenance for them.

Other visible product logos (Google Chrome, Playwright, Stagehand) and AI model-provider icons are outside this Worker-provider asset unit and still require their own source audit.

## Source pages

- Simple Icons project, versioned download documentation and repository: https://github.com/simple-icons/simple-icons
- Simple Icons legal disclaimer: https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md
- Dated icon metadata snapshot consulted 2026-10-01: https://raw.githubusercontent.com/simple-icons/simple-icons/develop/data/simple-icons.json
- Dated slug inventory consulted 2026-10-01: https://raw.githubusercontent.com/simple-icons/simple-icons/develop/slugs.md
