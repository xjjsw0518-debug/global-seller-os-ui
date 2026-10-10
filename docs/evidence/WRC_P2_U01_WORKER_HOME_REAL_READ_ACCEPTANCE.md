# WRC-P2-U01 Worker homepage read acceptance evidence

## Controller-attested identity and scope

- Repository / Issue: xjjsw0518-debug/global-seller-os-ui#21.
- Exact base SHA: `32c3d23d9ecbe1d2064f921f3af4c5c512084cc9`.
- RUN_ID: `gso-21-1791662741018-642881d6`.
- LEASE_ID: `783788d75d0772dacc04629c78ec5aca`.
- Authorization ID: `gh-comment-6101610200-20261011`.
- Manifest SHA-256: `990c7922a9b89bf755ef0ad7ef518dd17d0a7b6afc72ef02b57c59d6edea22aa`.
- Prompt SHA-256: `c270d566fcff291d9aa96c6ae69a8726430a73e5b6a9539ed2c6302653553367`.
- Controller-attestation SHA-256: `daaeb731e66535974f25cf8ac4bc96ca104b23f32b6d25c41803a577eaec8b9e`.
- Attempt kind: `NEW_ATTEMPT`; controller-attested admission state: `NEW_ATTEMPT_READY`.
- Admitted one-file scope: `docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md`.

These facts come from the controller-attested packet. The model did not independently query GitHub or verify controller-only admission facts. READY describes the sufficiency of this proposed artifact, not a Gate or Issue status.

## Preserved prior BLOCKED lineage

The packet preserves prior state `BLOCKED`, RUN_ID `gso-21-1791654820670-73a624e9`, LEASE_ID `ef1e890864010e857f9b663e2d8d52e7`, authorization ID `gh-comment-6100321725-20261011`, and prior base SHA `22157e2fe8d56346495637a8fc90e4262869e3c4`. The prior attempt used one model run. This new attempt does not claim that the historical BLOCKED state was cleared.

## Bounded source evidence

Source 1: `src/workerResourceReadAdapter.js`.
SHA-256: `567f3b134b73a51071a5638d8c37931ada78f5a53fdc44dafc7d8c2811fd83d5`.

Exact bounded excerpts from the packet:

- Line 2: `const WORKER_API_PREFIX = "/__worker_staging/api/v1";`
- Line 3, overview candidate fragment: `overview:WORKER_API_PREFIX+"/worker-ops/overview"`
- Line 3, map-data candidate fragment: `mapData:WORKER_API_PREFIX+"/worker-ops/map-data"`
- Line 88, GET transport fragment: `map(await transport.get(path,{signal}),id)`
- Line 88, overview binding fragment: `getOverview:({signal}={})=>read(WORKER_READ_CANDIDATE_PATHS.overview,mapWorkerOverviewDto,null,signal)`
- Line 88, map-data binding fragment: `getMapData:({signal}={})=>read(WORKER_READ_CANDIDATE_PATHS.mapData,mapWorkerMapDataDto,null,signal)`
- Line 88, authority fragment: `contractAuthority:"UNVERIFIED_CANDIDATE_SNAPSHOT"`

These excerpts establish the two homepage GET candidates and their injected transport bindings. Authentication is supported by the packet's accepted historical session evidence below; these source fragments alone do not prove authentication or current endpoint availability.

Source 2: `public/dev-status.json`.
SHA-256: `4e5e8f9665e8f38696d787d7bcca46c806d14186281de37f8059f886b2d1f02a`.

Exact bounded excerpts from the packet:

- Line 159: `"id": "WRC-P2-U00D",`
- Line 160: `"name": "Grant audited read-only privileges for Worker staging role",`
- Line 161: `"status": "PASS",`
- Line 163: `"evidence": "overview=200；map-data=200；health=200；ready=200",`

This is a historical source citation. No modification to `public/dev-status.json` is proposed.

## Historical accepted recovery evidence

The packet classifies both records below as historical accepted recovery evidence, not current live verification. Each records an established authenticated session, `overview=200`, `map-data=200`, `health=200`, and `ready=200`, with no business data written.

1. https://github.com/xjjsw0518-debug/global-seller-os-ui/issues/11#issuecomment-6096811756
2. https://github.com/xjjsw0518-debug/global-seller-os-ui/issues/12#issuecomment-6096811856

The authenticated homepage GET candidates are supported by this historical evidence together with the source bindings above. No new HTTP response or current acceptance result is asserted.

## Current verification and deferred observation

Current live verification was not performed in this unit. The packet reports no current statuses and states that server or network reverification was not authorized for this evidence-only unit.

The historical `resource-list=404` observation is deferred and outside this homepage read contract. It was not rechecked in this unit.

## Execution boundary

No server, database, container, login, business-write, production, or secret operation was performed in this unit. The model proposed structured output only; it did not write files or run tests. The controller-applied evidence file at the admitted path is the only candidate change. This proposal makes no claim that the file has already been written, committed, pushed, or accepted by Gate.
