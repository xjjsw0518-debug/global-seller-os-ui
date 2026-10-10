# AI provider/model logo inventory

Scope audited: 12 static demo rows in modelQuotaAdapter.js. This list is not a live/dynamic registry.

| Asset / fallback | Use | Source | Version | License / status |
| --- | --- | --- | --- | --- |
| anthropic-symbol-ivory.svg | Anthropic Provider fallback | Legacy local file; source URL unavailable | Unknown | Unverified; UI must not call official |
| google.ico | Google Provider fallback | Legacy local file; source URL unavailable | Unknown | Unverified; UI must not call official |
| deepseek.ico | DeepSeek Provider fallback | Legacy local file; source URL unavailable | Unknown | Unverified; UI must not call official |
| alibaba-cloud.ico | Alibaba Cloud Provider fallback | Legacy local file; source URL unavailable | Unknown | Unverified; UI must not call official |
| openai-temporary.svg | Generic AI fallback only | Project-authored generic SVG; explicitly not OpenAI mark | Local v1, 2026-10-01 | Project-internal |
| Cloud glyph | Microsoft Azure generic fallback only | @phosphor-icons/react package | 2.1.10 | MIT (installed LICENSE); not a Microsoft Azure logo |
| SquaresFour glyph | Unknown Provider/Other generic fallback | @phosphor-icons/react package | 2.1.10 | MIT (installed LICENSE); not a brand mark |
| User image | Model-specific override | User file input, PNG/JPEG/WebP; no network URL fetch | User supplied | Local-memory mock only; provider fallback used if load fails |

OpenAI official brand guidance says use marks only when directly related and follow its usage terms; it warns against implying endorsement or changing marks: https://openai.com/brand/. The official downloadable package is a ZIP and the browser tool could not materialize it in this environment, so no official OpenAI logo was copied.

Microsoft Learn describes Azure icons as intended for architecture diagrams/training/documentation, with other uses reserved absent explicit permission: https://learn.microsoft.com/en-us/azure/architecture/icons/. This prototype uses a generic Cloud glyph instead of those restricted product icons.

Four legacy image files currently lack traceable origin, version, and license. Their UI labels are intentionally marked unverified. Do not claim they are official or fully rights-cleared until provenance is recovered/replaced.

Safety: local image assets only; generic fallbacks are inline package glyphs. No remotely hosted images, SVG scripts, external references, or trackers. Model-specific user uploads take precedence; invalid/unavailable custom image falls back to the provider image or generic glyph.

Coverage: 12 mock rows in the checked dataset only. No dynamic Provider/Model registry is connected; coverage beyond those mock records is not verified.


## Legacy asset identity and source research (checked 2026-10-01)

The following SHA-256 values bind this inventory to the files currently in this folder. Hash identity does not establish authorship, source, brand fidelity, version, or permission:

| File | Bytes | SHA-256 | Source / rights result |
| --- | ---: | --- | --- |
| anthropic-symbol-ivory.svg | 340 | 38FC06D8E9390654CC4E96AA53691E2E78D929667C0034805B6D1B3891BA22DD | No file provenance, version, or permission evidence recovered; UI label remains unverified |
| google.ico | 5,430 | 6DA5620880159634213E197FAFCA1DDE0272153BE3E4590818533FAB8D040770 | No file provenance, version, or permission evidence recovered; UI label remains unverified |
| deepseek.ico | 209,762 | 30A4420E6E4DCB17FD7DE560C5004346C2BC8CD971D2D5F5EE15326603E51321 | No file provenance, version, or permission evidence recovered; UI label remains unverified |
| alibaba-cloud.ico | 1,406 | 12A8E74153C9331DFB091E086A88A20F8B417399D86ADF5D18202B095E4D15B5 | No file provenance, version, or permission evidence recovered; UI label remains unverified |

### Candidate-source findings

- Simple Icons publishes its artwork under CC0, but expressly says the CC0 grant does not convey trademark or patent rights and asks users to seek brand permission: [license](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md), [disclaimer](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md). We did not copy assets from it.
- The Simple Icons DeepSeek request reports no official icon resource and is labeled permission-required: [DeepSeek icon request #12828](https://github.com/simple-icons/simple-icons/issues/12828). No DeepSeek replacement was adopted.
- Alibaba Group's media library says its media images are editorial-only for accredited media and other uses require written permission: [News and Media Resources](https://www.alibabagroup.com/resource-logos). This does not establish the provenance of the existing ICO file or permit its app use.
- Consequently A11 source/version/license validation for these four legacy files is still OPEN. We retain file identity hashes, label them unverified in UI, and keep generic fallback support. Azure uses a generic Phosphor Cloud glyph (package MIT v2.1.10), not an Azure brand mark.

## A11 source re-check (2026-10-01)

This check re-examined the four legacy files and official brand-source options. Existing file hashes above remain unchanged. No image was downloaded or changed in this pass.

| Existing file | Confirmed facts | Usable replacement path / present fallback |
| --- | --- | --- |
| `anthropic-symbol-ivory.svg` (340 B; prior SHA retained above) | File is a small ivory geometric “A”-like path; original source/version/license still unknown, so identity as official Anthropic artwork is unproven. | Anthropic says its Brandfolder is the official asset source and marks a Newsroom collection of 13 assets as publicly accessible for use subject to the guidelines. This is a credible candidate source; this text-only inspection could not enumerate the individual assets or verify which is the current provider mark. Replace only after selecting the exact item, saving its source/version/usage terms and checking appearance. Until then keep the current explicit source-unverified UI label or generic fallback. |
| `google.ico` (5,430 B; prior SHA retained above) | Origin/version/license and relation to current Google identity remain unknown. | Google Brand Resource Center links product-specific resources and general product-icon/trademark guidance; Google Cloud separately provides an official icon library for diagrams/documentation. A Google mark may be used only in the applicable product context and without suggesting endorsement. The Cloud icon pack is not automatically a general-purpose provider logo license. Safer immediate fallback: generic licensed Phosphor glyph plus the plain-text Provider name. |
| `deepseek.ico` (209,762 B; prior SHA retained above) | Origin/version/license and official identity remain unknown. Simple Icons’ request #12828 lists no official icon/color resource and “permission required”; Simple Icons’ CC0 for its project artwork does not waive a brand owner’s trademark. | DeepSeek’s official Terms of Use §6.2 prohibit use of DeepSeek marks/logos/brand features without permission. Without permission, use neutral generic glyph plus the text “DeepSeek”; do not substitute a third-party downloaded brand mark. |
| `alibaba-cloud.ico` (1,406 B; prior SHA retained above) | Origin/version/license and whether it is specifically an Alibaba Cloud mark remain unknown. | Alibaba Cloud’s official site visibly identifies the Provider, but I found no dedicated logo asset license for reuse in this UI. The Alibaba Group media-library restriction applies specifically to images in that media library (editorial use by accredited media, other use by written permission); it does **not** establish that every Alibaba Cloud logo source is prohibited. Until an Alibaba Cloud asset source/permission is documented, use generic Cloud glyph plus the Provider’s text name. |

### Scope correction: provider mark vs model mark

- Historical `AiProvider` has `logo_asset` (`String(512)`); the candidate Provider create/patch/response schemas expose `logo_asset`. The candidate model registry class `AiModelPricing` has no model-logo field, and its `AiModelConfigResponse` adds capabilities only. Thus the historical candidate supports an optional Provider-level path but not persisted model-specific artwork.
- Current local `ProviderLogo` uses a hard-coded map for the four legacy files; it does not consume dynamic Provider `logo_asset`. A user-selected model image is validated PNG/JPEG/WebP and remains memory-only; it overrides Provider artwork while loaded, then falls back to Provider/generic if invalid/unavailable. There is no model-specific logo field for the 12 static mock rows.
- Remaining dynamic-catalog contract: define stable Provider identity (`provider_id`/`provider_code`), display label, optional Provider logo asset reference and safe-loading policy; separately define optional model logo asset reference keyed by Provider+model ID. For each served asset retain owner/source URL, source revision or effective date, license/permission status, and fallback state; do not embed arbitrary remote URLs without an origin/type policy. Keep Provider logo and Model logo distinct; `model_id` is not a logo asset.
- Until that contract and per-brand usage permission are confirmed, the reliable current fallbacks are the project generic AI SVG (explicitly not OpenAI), Phosphor Cloud for Azure/Cloud-like fallback, and Phosphor SquaresFour for Other/unknown; Phosphor React 2.1.10 MIT. These glyphs are generic artwork and do not assert vendor endorsement.

### Primary brand references reviewed

- Anthropic official Brandfolder: https://brandfolder.com/anthropic (official source, public Newsroom collection; follow its usage guidelines).
- Google Brand Resource Center: https://about.google/brand-resource-center/products-and-services/ and https://about.google/brand-resource-center/guidance/ (product-specific resources, no implied affiliation/endorsement, check the relevant product rules).
- Google Cloud product icon library: https://cloud.google.com/icons (official icons for diagrams, technical documentation and more; not presumed to grant unrelated mark usage).
- DeepSeek Terms of Use: https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html (last update shown March 27, 2026; §6.2 mark/logo restriction without permission).
- Simple Icons Disclaimer: https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md and DeepSeek request #12828: https://github.com/simple-icons/simple-icons/issues/12828 (per-icon licensing/guidelines can vary; trademark rights are not granted by project artwork licensing; this request is permission-required).
- Alibaba Group media resource page: https://www.alibabagroup.com/en-US/resource-logos (restriction applies to assets in that media library specifically). Alibaba Cloud official site: https://www.alibabacloud.com/.

Status remains PARTIAL: four existing assets' provenance is not repaired, and the prospective sources above are not copied into the project. The UI fallback labels remain important. Static audit coverage is limited to 12 mock records; dynamic Provider/model catalog coverage remains unverified.

## A11 provider fallback update (2026-10-01)

Inventory confirmed seven visible provider labels across 12 static rows: OpenAI (2), Anthropic (2), Google (2), DeepSeek (2), Alibaba Cloud (1), Microsoft Azure (1), and Other (2). Six correspond to named vendors. Four local images exist and visually match the expected vendor identities, but remain source-unverified; their hashes and limits above are unchanged. No model-specific logo exists in the static rows, so those rows use the provider-level image where one is mapped.

OpenAI and Microsoft Azure have no verified local image in this folder. Their AI-tree row fallback now uses the vendor name text, not a generic AI or cloud glyph. This is a clearly labeled interim alternative, not the requested official logo. The standalone generic AI SVG remains on disk but is no longer presented as OpenAI by ProviderLogo. Other/unknown vendors continue to use the neutral generic glyph.

Candidate reference pages were identified for possible static follow-up: Google “G” logo (Wikimedia Commons; public-domain simple-geometric mark with trademark caveat): https://commons.wikimedia.org/wiki/File:Google_%22G%22_logo.svg; DeepSeek logo icon (Wikimedia Commons; source/terms remain on file page): https://commons.wikimedia.org/wiki/File:DeepSeek-logo-icon.svg; Alibaba Cloud text logo (Commons page lists source Alibaba Cloud / author Alibaba Group and notes simple-geometric/text-logo status): https://commons.wikimedia.org/wiki/File:AlibabaCloudLogo.svg; Anthropic logo (Commons listing): https://commons.wikimedia.org/wiki/File:Anthropic_logo.svg. For Azure, candidate file: https://commons.wikimedia.org/wiki/File:Microsoft_Azure_Logo.svg. For OpenAI, the official brand page links its own downloadable asset bundle and usage guidance: https://openai.com/brand/.

No candidate file was copied into this project during this pass: the execution environment exposes no safe local materialization path for these static assets, and it would be wrong to label the old files verified based only on visual resemblance. The visual QA scope remains pending in the shared browser; the component fallback and resolver tests cover only their local contract. No external permission was sought, no remote image is loaded by the UI, and no download script was added.

## A11 public-file re-check (2026-10-01 15:50 UTC)

Direct file-page inspection established the following candidates and concrete cautions. These page reviews do not change the provenance of the local files listed in the hash table above.

| Provider | Candidate and page facts | Use decision |
| --- | --- | --- |
| OpenAI | `OpenAI logo 2025 (wordmark).svg`, 512×138, 2 KB; Commons page names the official primary wordmark (in use since 2025-02-05), source openai.com, author OpenAI. Commons classifies it PD-textlogo and explicitly notes trademark restrictions. https://commons.wikimedia.org/wiki/File:OpenAI_logo_2025_(wordmark).svg | Suitable static candidate for provider identification; keep the mark unchanged and do not combine with the Blossom contrary to the page's quoted brand guidance. Not materialized because the ordinary local socket request was denied. |
| Microsoft Azure | `Microsoft Azure Logo.svg`, 187×54; page names Microsoft source/author and file history shows 2021 versions. Commons classifies it PD-textlogo and retains trademark caveat. https://commons.wikimedia.org/wiki/File:Microsoft_Azure_Logo.svg | Suitable static candidate for identification; not materialized because the ordinary local socket request was denied. |
| Google | Existing `google.ico` visually matches the old segmented G. The 2015 page says there is a Gradient version (2025–present). Candidate `Google Favicon 2025.svg`, 512×523; Commons page describes the icon released 2025-05-12 and offers CC0 for the vectorization; the original logo is separately described as a trademark. https://commons.wikimedia.org/wiki/File:Google_Favicon_2025.svg | Replace the outdated ICO only after materializing this exact static SVG; current source was blocked. |
| DeepSeek | Existing `deepseek.ico` visually shows the blue whale icon, but has no source record. Candidate `DeepSeek-icon.svg`, 512×512, page cites chat.deepseek.com as source and includes an MIT license with DeepSeek copyright notice. https://commons.wikimedia.org/wiki/File:DeepSeek-icon.svg | Candidate appears to be the same provider mark and has a concrete permissive license record; retain attribution/notice when copied. Current source was blocked. |
| Anthropic | Existing `anthropic-symbol-ivory.svg` is an ivory A-like geometric mark, but source is unknown. Commons candidate `Anthropic logo.svg`, 1024×115, is a wordmark attributed to Anthropic and marked PD text-logo; the page's source field says “Own work” and it has no separate trademark note in the licensing block. https://commons.wikimedia.org/wiki/File:Anthropic_logo.svg | Candidate is a distinct wordmark rather than the local symbol. Do not claim existing symbol has this provenance; replace only after obtaining and checking the exact file. |
| Alibaba Cloud | Candidate `AlibabaCloudLogo.svg` (512×65) names Alibaba Cloud as source / Alibaba Group author, and labels the logo PD text-logo, but its file-history entry also contains `Non-free logo` with rationale. https://commons.wikimedia.org/wiki/File:AlibabaCloudLogo.svg | Conflicting source-page signals; do not adopt this candidate. Keep the local ICO unverified and use a concrete vendor-name fallback until a consistent official source file is found. |

Download attempt: one normal `Invoke-WebRequest` to the public OpenAI Commons static file URL, targeting the approved local task evidence directory, failed with `An attempt was made to access a socket in a way forbidden by its access permissions.` No output file was created. No elevated network request, alternate endpoint, proxy, or other access route was attempted. Consequently none of the six candidates is reported as locally installed or visually verified. Existing provider display paths remain the four hard-coded local asset URLs in `ProviderLogo.jsx`, while OpenAI and Azure use the explicit text fallback. This state is PARTIAL, not A11 complete.

## A11 installed static files (2026-10-01 16:09 UTC; supersedes the earlier PARTIAL download note above)

The normal direct socket request failed, but an explicit one-command standard execution approval then succeeded for each of five exact static Wikimedia `Special:Redirect/file/` URLs. Those commands wrote only SVG files into this AI provider-logo folder. No ZIP, script, proxy, mirror, or website access restriction was used. The source-file pages and license findings are itemized above. Downloading is not a claim of endorsement or broader trademark license.

| Local file | Source page / recorded version | SHA-256 | License/usage note |
| --- | --- | --- | --- |
| `openai-wordmark-2025.svg` | https://commons.wikimedia.org/wiki/File:OpenAI_logo_2025_(wordmark).svg; official 2025 primary wordmark, source OpenAI | `6E4C87D52178F47077B698CED2FB181A8B0115E031CCE42F62C6CA7C83D46B9D` | PD text-logo on Commons; trademark remains. Keep unaltered; do not combine with Blossom. |
| `microsoft-azure-logo.svg` | https://commons.wikimedia.org/wiki/File:Microsoft_Azure_Logo.svg; Microsoft source/author, 2021 file revision | `8EA658A5B8DCC92ADBF83BA60DF4D7209B60FF1331D64B86C9D2DDE96EB6BFC4` | PD text-logo on Commons; trademark remains. |
| `google-g-icon-2025.svg` | https://commons.wikimedia.org/wiki/File:Google_Favicon_2025.svg; 2025-05-12 icon | `A3FEAC5510A973157E3FF3D5E7933CC8BFD56835C43820B952866AB4D34303A8` | CC0 for the vectorization; source brand mark remains a trademark. |
| `deepseek-icon.svg` | https://commons.wikimedia.org/wiki/File:DeepSeek-icon.svg; source cited as chat.deepseek.com, DeepSeek copyright, 2023-09-11 | `5AFE2E9FB26ACFF7359763B694EB3577F7A9098DEC1257A3FC6DA1A4D52C050F` | MIT/Expat; complete copyright and permission notice follows. |
| `anthropic-wordmark.svg` | https://commons.wikimedia.org/wiki/File:Anthropic_logo.svg; Anthropic author, 2023-07-01 | `C89653A9EDD5CB712368CDE82196CD50914FB9E28A77CB5723A7F71A60AC5FC0` | PD text-logo marked by Commons; local asset is the wordmark and does not establish provenance for the previous ivory symbol. |

DeepSeek icon MIT/Expat notice, retained from the source file page:

> Copyright © DeepSeek. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. The Software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the Software or the use or other dealings in the Software.

The four old local vendor assets were not overwritten or removed. Their former display paths are replaced for Anthropic, Google and DeepSeek by the source-recorded SVG files above; Alibaba Cloud still uses its provider-name text fallback because the candidate Commons page has conflicting licensing history and the official announcement did not expose a static file. The temporary OpenAI generic SVG also remains on disk but is not the provider display asset.

## A11 final provider-map update (2026-10-01 16:10 UTC)

The official Alibaba Cloud website's footer configuration exposed its current static logo URL. The page includes a `footerLogo.img` reference to `https://img.alicdn.com/imgextra/i4/O1CN01cMRNZN1Q3rqeuFGkP_!!6000000001921-55-tps-296-37.svg`; this exact public asset was fetched without authentication into `alibaba-cloud-official-footer.svg`. The downloaded SVG shows Alibaba Cloud's orange symbol/wordmark. The official source page copyright notice is retained in context; no separate file license statement was exposed, so the asset is used unchanged solely to identify the provider in this local noncommercial research mock. No endorsement or partnership is implied.

Current `ProviderLogo.jsx` mapping now uses the six local SVGs below; the four original unverified assets remain on disk but are no longer displayed. `Other` remains the neutral generic provider glyph. Candidate `AlibabaCloudLogo.svg` from Commons was not copied because its page has a PD text-logo label alongside a Non-free-logo file-history rationale.

| Provider | Actual displayed file | Source / version | SHA-256 | File note |
| --- | --- | --- | --- | --- |
| OpenAI | `openai-wordmark-2025.svg` | Official 2025 wordmark, Commons page sourced to OpenAI | `6E4C87D52178F47077B698CED2FB181A8B0115E031CCE42F62C6CA7C83D46B9D` | PD text-logo; trademark caveat; no Blossom combination. |
| Anthropic | `anthropic-wordmark.svg` | Commons says author Anthropic; 2023-07-01 | `C89653A9EDD5CB712368CDE82196CD50914FB9E28A77CB5723A7F71A60AC5FC0` | PD text-logo on file page; different from retained old ivory symbol. |
| Google | `google-g-icon-2025.svg` | 2025-05-12 current-gradient G icon file | `A3FEAC5510A973157E3FF3D5E7933CC8BFD56835C43820B952866AB4D34303A8` | CC0 for vectorization, trademark caveat. |
| DeepSeek | `deepseek-icon.svg` | Commons cites chat.deepseek.com; Copyright DeepSeek, 2023 icon | `5AFE2E9FB26ACFF7359763B694EB3577F7A9098DEC1257A3FC6DA1A4D52C050F` | MIT/Expat notice included above; DeepSeek Open Platform Terms §5.2 separately restrict marks/logos related to its services without permission. This local fixture performs no DeepSeek API/service call and displays the mark only for provider identification; no claim of endorsement. |
| Alibaba Cloud | `alibaba-cloud-official-footer.svg` | Public static asset directly referenced by official Alibaba Cloud website footer; fetched 2026-10-01 | `69DFA82BD1E8172451D61D0921C04B1478DB38BE6856C96F8D3FA953B22A8B33` | No separate file license metadata; unchanged local copy for provider identification only. |
| Microsoft Azure | `microsoft-azure-logo.svg` | Commons lists Microsoft source/author; 2021 revision | `8EA658A5B8DCC92ADBF83BA60DF4D7209B60FF1331D64B86C9D2DDE96EB6BFC4` | PD text-logo; trademark caveat. |

Offline check at 16:10 UTC: focused `modelLogoContract.test.js` PASS 6/6, including existence of all six mapped SVGs, no SVG scripts/foreignObject/event-handler attributes, internal-only fragment references, and retention of the DeepSeek MIT notice. `ProviderLogo.jsx` esbuild transform PASS. Browser display/screenshot is deliberately left to the parent Worker; no visual-pass claim is made here. Full Vite build remains subject to the recorded sandbox root-config read block.

## AI-018 Phase B — required Model Vendor logo provenance (checked 2026-10-05)

The Step 1 `MODEL_VENDOR` catalog uses these local, versioned-by-check-date assets. Files are displayed unchanged. Official-host provenance establishes where a file was served; it does not claim a standalone logo license or imply vendor endorsement. Use is limited to accurately identifying the model vendor, subject to each brand's current terms. Unknown/custom/private/local identities keep neutral category icons.

| Canonical vendor key | Model Vendor IDs / aliases | Local asset | Official or authoritative source | Source status / usage note |
| --- | --- | --- | --- | --- |
| OpenAI | `OPENAI` | `openai-wordmark-2025.svg` | https://commons.wikimedia.org/wiki/File:OpenAI_logo_2025_(wordmark).svg | Commons source page verified; 2025 wordmark; trademark remains; do not combine with Blossom. |
| Anthropic | `ANTHROPIC` | `anthropic-wordmark.svg` | https://commons.wikimedia.org/wiki/File:Anthropic_logo.svg | Commons source page verified; 2023-07-01; trademark status not stated on file page. |
| Google | `GOOGLE_GEMINI` | `google-g-icon-2025.svg` | https://commons.wikimedia.org/wiki/File:Google_Favicon_2025.svg | Commons source page verified; 2025-05-12; Google brand mark identifies Gemini vendor. |
| DeepSeek | `DEEPSEEK` | `deepseek-icon.svg` | https://commons.wikimedia.org/wiki/File:DeepSeek-icon.svg | Source cites chat.deepseek.com; MIT/Expat notice retained in this README above; trademark terms remain. |
| Qwen | `QWEN` | `qwen-official-icon.png` | https://qwen.ai | Official Qwen website links the local image from its site/CDN; checked 2026-10-05. Separate from Alibaba Cloud Access Provider. |
| Kimi | `KIMI`, `MOONSHOT` | `kimi-official-app-icon.png` | https://kimi.moonshot.cn | Official Kimi site PWA app icon; checked 2026-10-05. |
| Zhipu AI | `ZHIPU`, `GLM` | `zai-glm-official-logo.svg` | https://z.ai | Official Z.ai/GLM static logo asset; checked 2026-10-05. |
| MiniMax | `MINIMAX` | `minimax-official-favicon.ico` | https://www.minimax.io/favicon.ico | Official MiniMax site favicon; checked 2026-10-05; exact asset retained. |
| xAI | `XAI`, `GROK` | `grok-official-favicon.svg` | https://grok.com/images/favicon.svg | Official Grok site favicon; checked 2026-10-05; displayed unchanged. xAI brand guide: https://x.ai/legal/brand-guidelines. |
| Mistral AI | `MISTRAL` | `mistral-official-gradient-icon.webp` | https://mistral.ai/brand/ | Asset is served by the official Mistral brand page; checked 2026-10-05; original gradient icon is not recolored. |
| Cohere | `COHERE` | `cohere-official-nav-icon.svg` | https://cohere.com/nav_icon.svg | Official Cohere site navigation mark; checked 2026-10-05; original dark mark is placed on a light feature-local badge. |
| Meta Llama | `META`, `LLAMA` | `meta-ai-official-mark.svg` | https://meta.ai/images/meta-ai-orbit-logo-gradient-3d_light.svg | Official Meta AI hosted mark; checked 2026-10-05; displayed unchanged as Meta family identification, not a Llama-specific logo. |
| Doubao | `DOUBAO`, `BYTEDANCE` | `doubao-official-favicon.png` | https://www.doubao.com | Exact official-site favicon asset; checked 2026-10-05. |
| Hunyuan | `HUNYUAN` | `hunyuan-official-favicon.png` | https://hunyuan.tencent.com | Exact official Hunyuan site favicon asset; checked 2026-10-05. |

The separate Access Provider mark `Alibaba Cloud` continues to use `alibaba-cloud-official-footer.svg` from https://www.alibabacloud.com/en/news/product/supports-scc-hl2?_p_lc=1; it is not used as the Qwen Model Vendor logo. Azure remains an Access/Deployment Provider and is not included in `MODEL_VENDOR`.

Color treatment is feature-local only: low-contrast original dark marks use a light badge and light marks use a dark badge. Source artwork itself is not recolored or stretched. The Mistral official brand-page artwork is used with a centered crop to expose its official icon at the small tile size; source pixels and colors remain unchanged.


### xAI / Grok browser-render capture

- File: `grok-official-site-screenshot.png`. It is a 512×512 Chromium screenshot of the unchanged local copy of Grok's official favicon source (`https://grok.com/images/favicon.svg`), captured 2026-10-05 after the vendor kit download endpoint refused access. No logo elements, colors, or geometry were edited. See `outputs/AI018/grok_official_render_proof.json` for content hashes. This is an official-source render capture, not a claim of trademark license.
