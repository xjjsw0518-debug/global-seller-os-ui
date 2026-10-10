# WRC-P2-U00F — Standalone resource-list API contract decision

## Decision

The standalone `resource-list` endpoint remains **DEFERRED** for the current Worker Phase 2. The live UI continues to read resource data from authenticated `worker-ops/overview` and `worker-ops/map-data` through the existing Vite staging proxy.

The observed `resource-list=404` is therefore an unregistered candidate route, not a current UI read-path failure. No backend route or frontend path change is authorized by this unit.

## Future contract (when separately authorized)

- Method/path: `GET /api/v1/worker-ops/resources` (candidate only; not registered).
- Query: `page` (1-based), `page_size` (bounded), `q`, `country_code`, `city`, `status`, `resource_type`, `sort`, and `order`.
- Pagination: response must include `page`, `page_size`, `total`, and `has_next`; default and maximum page sizes must be documented before implementation.
- Sorting: only an allow-listed field set; default ordering must be deterministic and stable across pages.
- Response: `{ data: Resource[], page, page_size, total, has_next, generated_at }`; each resource uses the same normalized identity and status fields as the overview/map-data contracts.
- Empty result: HTTP 200 with an empty `data` array, never 404.
- Errors: 401 for absent/invalid session, 403 for insufficient role, 422 for invalid query, 429 for rate limiting, and 5xx only for an unexpected server failure with a correlation id.
- Authorization: authenticated Worker session and the same read-only role boundary as overview/map-data; no API key requirement is introduced.

## Acceptance criteria for a future implementation unit

1. A separate scoped Issue explicitly authorizes backend route and/or frontend path changes.
2. Contract tests cover query validation, stable pagination, empty results, auth errors, and response compatibility.
3. The existing overview/map-data path remains green and unchanged unless a separately approved migration plan exists.
4. Full GSO Gate and evidence artifacts pass; no Backstop baseline or Gate threshold changes are allowed.

## Current status

`WRC-P2-U00F=PASS` as a contract-decision unit. `resource-list=404` remains deferred; no code fix is required in this phase.
