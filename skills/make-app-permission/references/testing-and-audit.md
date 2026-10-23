# Testing and audit

Verify the [permission boundaries](permission-boundaries.md), UI lifecycle and Service transport with production selectors and host tests. Tests must precede implementation. Do not satisfy permission tests by changing roles, adding administrator grants or inventing field-update permissions.

## Executable checks

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <adapter-module>
```

The audit is heuristic: failures block completion; resolve each warning. It checks App-scoped proxy usage, consumed navigation/route guards, independent table headers and cleared rows, legacy createFields/payload contracts, extra field-update gates, effective permission helpers, state-array preservation and coupled refresh. It does not replace behavioral, UI or backend verification. An unrelated guard/row clear or a helper name that always returns true is not evidence of enforcement.

### Adapter: seven core exports plus two extensions

Create a thin adapter that imports production behavior and exports:

```text
normalizeAccess
canUseEntityOperation
canCreateEntityField
canReadEntityField
canUpdateEntityField
isCreateCapableField
isEditCapableField
```

Do not duplicate permission logic in the adapter or add new production exports just to satisfy names. Existing selectors can be wrapped. Use the host's existing TypeScript runner for TS adapters; no additional runtime dependency is required solely for verification.

Optional thin wrappers:

| Export | When tested | Force coverage |
| --- | --- | --- |
| `canReadEntityFieldMetadata` | Automatically when exported | `--require-field-metadata` |
| `canBulkUpdateEntityField` | Automatically when exported; required in a batch-edit host's CI/publish gate | `--require-bulk-update` |

Missing optional wrappers produce explicit `SKIP`, excluded from the passed count. Require flags fail if their extension is missing; a provided non-function extension is invalid. Unknown flags fail usage validation. Core create/read/update checks always run. A host without batch editing need not supply the bulk extension.

```bash
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <adapter-module> \
  --require-field-metadata --require-bulk-update
```

`isEditCapableField` must be the production guard consumed by edit rendering, cell editors, validation and update payloads: reject both ID types, while preserving authorized audit-field compatibility. Exact keys/types are in [system-field-contract.md](system-field-contract.md).

## Permission regression matrix

Use the executable suite and mutation tests for pure model behavior; add host integration cases for the actual form, route, payload and Service consumers.

| Area | Required cases / expected boundary |
| --- | --- |
| Key/resource matching | Exact, global and segment key wildcards; App/parent/entity/*/exact resources; namespace aliases at equal specificity; named-entity isolation; concrete requested identifiers reject non-strings, blanks and literal wildcard. |
| Row selection | Ignore malformed tenant-root/other-App rows and valid unknown current-App keys before effect/field validation; malformed supported current-App or unclassifiable resources fail the whole snapshot closed. Surplus rows cannot block Schema readiness. |
| Envelope/row validation | Missing/non-App scope; conflicting/null/blank/non-string-equivalent appResource; invalid effect/truncated key/namespace/wildcard tenant or App; null/primitive/array row and non-array permissions; malformed fieldAccess containers/keys/empty or unknown/mixed states. Deny without throwing; never drop a selected malformed row while retaining sibling allows. |
| Legacy ordinary create | Historical meta.field.read create states and `createFields`; independent create gate. Preserve specificity, same-level union, named-over-baseline and hidden exceptions. Empty createFields stays empty; operation rows cannot invent fields; creatable-only remains create-only. |
| Existing-record gates | Console-style record wildcard plus visible Schema fields allows editing without meta.field.update/data.field.update. Update/delete/bulkUpdate allow/missing/deny combinations remain independent. Revoke/restore rechecks the current gate. |
| Effective restrictions | Metadata-read and every applicable record read/write source; arrays mixing editable/compatibility `*` with readonly/hidden/fullMask/partialMask deny writing. Keep same-row and cross-row baseline/named restrictions without Statement provenance; broader restrictions survive more-specific allows. Unrelated-entity restrictions do not leak. |
| Defaults/protocols | No field restriction defaults writable inside the requested allowed operation and Schema/editor bounds, without a named editable grant. Restrictions never cancel siblings. Legacy creatable-only is unreadable/unwritable for existing records. Pure Decision envelopes cannot be coerced into raw principal inputs. Confirmed Statement specificity/final Decision maps are distinct from raw inference. |
| Read behavior | Entity metadata, headers and record read independent; denied/hidden values absent, masks preserved, no extra read granted by metadata write. |
| System fields | Exact ID/audit create exclusions, ID edit exclusions, similarly named business fields preserved, authorized audit fields remain editable, process status/lock never written. |

Preserve scalar/array states without coercion, explicit deny precedence, and all current suite/audit regression cases. Report actual pass/skip counts; totals vary with suite revision and extensions.

## Host integration and lifecycle matrix

| Surface | Required verification |
| --- | --- |
| Service proxy | Correct route, App scope, IAM path, target header, trusted tenant/app identity, login forwarding and runtime-mode scope. Every completed upstream response preserves HTTP status, Content-Type and body, including 2xx/4xx/5xx; only no-response transport failure may use a documented local error. |
| Schema | Preserve `fields`/`createFields` independently through Service/shared types/UI. Missing/null/invalid createFields is empty, never falls back to fields; editableFields does not change edit behavior. Caches and in-flight requests are isolated by principal/tenant/App/access generation. |
| Navigation/rows | Entity permission hides navigation and blocks direct routes before mount. Record-read revoke skips every list/detail/pagination/control request and supplies empty rows to the actual table, retaining authorized headers; disabled queries cannot leave cached values. Metadata-only headers never expose denied raw values, filters, Lookup labels or edit fields. |
| Create | Ordinary create-only invisible fields render/submit only there; fields outside createFields or hidden by legacy selection remain absent. Zero-field create retains entry, shows “暂无可新建字段” and blocks unsupported empty submission. Validate only rendered authorized fields using `validations.isRequired` and type rules, never an alternate Schema required key. |
| Approval create | [Start-config fields](../../make-app-approval/references/initiation-contract.md) absent from ordinary createFields still render/save when authorized. UI/Service switch together, retain App/entity/create qualification, never reapply ordinary field intersections or fall back after config failure. Include Lookup/File start fields: latest source config, visible/existing targets and confirmed upload capability. |
| Edit/submit | Metadata-visible/readable fields and effective writable state control form/cell editors, required validation and payloads. Recompute current authorization in UI and Service: one restricted/stale/unknown/injected attempted field rejects the whole single/bulk mutation, preserves draft/selection, reports failure and never silently trims into success. Restoration does not auto-replay. |
| File | Persisted-record-only File absent from create render/required/payload. Explicit pre-upload/direct-create mode includes only approved attachment arrays without recordID; read/edit retains existing identity and capability checks. |
| Lookup | Dedicated candidates and effective target reads; no target createFields visibility bypass. Create `{ data, relations }` and snapshot-preserving edit `{ values, data? }` contracts reauthorize all keys, synthesize full qfei_relation, preserve unrelated relations and reject raw/hidden keys, invalid cardinality or identities, ambiguous relations and malformed snapshots. |
| Refresh | Permission → invalidate/reload Schema → atomic generation publish → recompute surfaces → data only if read allowed. Disable protected old access/submission from refresh start; never publish new permission with old Schema or restore old access after failure. Ignore old permission/Schema/record/candidate/form results. Grants appear on refresh; revokes close only affected surfaces, preserving authorized create/navigation/headers and rejected drafts. |
| Errors | Permission/Schema failure fails closed and retains safe `kind/status/title/description/traceId` through Provider state to the shared observability card, including first load before page mount. Trace ID is visible when available; permission denial remains forbidden without a fabricated request error/Trace ID. |

## Portable host gates and evidence

- Install audit/conformance runners project-locally or through a versioned dependency. Default test, CI or publish verification must invoke both, with required extensions for exposed capabilities.
- Verify that the host gate actually executes both runners, including extension flags for exposed capabilities. Exercise regression cases rather than merely searching source text for helper or case names. A one-off successful run or change-log entry is not a continuing gate.
- Generic CI must not depend on a sibling checkout or unversioned developer-home Skill installation.
- Fixture/mutation tests prove the checker, not a business App. Report them separately from real production-helper adapters, backend enforcement and browser save/read-back. State when any layer was not exercised; background incident evidence cannot substitute for that host's validation.
- For host permission implementations, completion requires changed tests, audit (warnings resolved), production-helper conformance, portable host gates and an unchanged real reference-project audit. Skill-only maintenance uses source/checker self-tests plus metadata/cross-Skill contracts; report unavailable host/online evidence explicitly rather than manufacturing a host integration. Fresh independent review is useful for complex changes. Do not label unrun acceptance as passed.

## Maintainer only: installation and release synchronization

These are local maintainer release checks, not App runtime requirements or portable host CI. An ordinary source review does not publish or overwrite installed copies.

For an explicitly requested local installation or release, compare the complete source and installed directories:

```bash
node skills/make-app-permission/scripts/check-installed-skill-sync.mjs \
  skills/make-app-permission <installed-skill-dir>
```

The checker must fail on source-only, installed-only and content-mismatch files. Pass explicit paths; do not replace the complete comparison with a hand-maintained file list or hardcode a developer home path.

For an authorized release changing shared Service/auth/permission guidance, publish through the platform Skill release flow first, update the installed platform package, then verify all affected Skills:

```bash
npx skills update qfeius/make-platform-skills
node scripts/check-installed-make-platform-skills-sync.mjs \
  skills <installed-skills-dir>
```

Run these only after the source revision is published. Confirm source/installed synchronization before declaring that installation or release complete.
