---
name: make-app-permission
description: "Use when generating, refactoring, reviewing, or debugging Make App single-app permission enforcement: /principal/permission, App-scoped IAM matching, permission-aware Schema, entity/field/operation guards, or permission refresh. Triggered by 单应用权限, 权限范围, 字段可新建、可见、可编辑, creatable, createFields, data.record.*, meta.entity.*, meta.field.*, route guards, or URL bypass. Use make-app-actions for selection and batch actions. Does not own platform-admin permissions, auth, generic Service APIs, UI layout, CanvasTable internals, DSL, deployment, or runtime packaging."
metadata:
  version: 0.3.5
---

# make-app-permission

Use this skill when a request creates, changes, reviews, or debugs Make App single-app permission enforcement. It must be enabled by default for every generated or refactored Make App. Do not omit the IAM proxy, route guards, permission-aware Schema, or permission audits merely because the request focuses on UI, Service, Schema, or runtime work.

This skill owns permission semantics. Use `make-app-auth` for login/session, `make-app-service` for Service and Schema transport, `makeui` for rendering, `canvas-table-integration` for cell-editor mechanics, and `make-app-runtime` for packaging/runtime.

## Quick start

1. Inspect `apps/docs/api.md`, Service/UI schema adapters and types, principal-permission code, providers, router, object pages, create/edit forms, submit builders, refresh flow, and tests.
2. Read `references/design-and-protocol-profiles.md` for v3.0.0 sources, raw-principal compatibility, and the retained legacy create profile; read `references/permission-boundaries.md` before selecting scope, permissionKey, schema collection, or field access state.
3. Read `references/service-principal-permission.md` before changing `/principal/permission` or interpreting IAM `fieldAccess`.
4. Read `references/ui-permission-runtime.md` before changing route/action gates, create/read/update field sets, payload filtering, or refresh.
5. Read `references/system-field-contract.md` before implementing ID/audit create or edit capability.
6. Read `references/testing-and-audit.md` before implementation and before reporting completion.
7. Implement tests first, then the Service/schema boundary, permission pure model, route/action gates, field-set consumers, submit allowlists, and refresh invalidation.
8. Run host tests, the behavioral conformance suite, and `node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>`. Wire both permission checks into the host's default test, CI, or publish gate; a one-off local run is not a continuous gate.
9. When publishing or installing this Skill, run `check-installed-skill-sync.mjs` with explicit source and installed directories. When the release changes shared Make response/auth/permission guidance, publish the platform package, run `npx skills update qfeius/make-platform-skills`, then run the repository-wide `check-installed-make-platform-skills-sync.mjs` with explicit source and installed Skill roots. Keep these local release checks out of portable host CI.

## Required contract

Existing-record editing uses the requested record operation gate plus effective field state, following PermissionDesign v3.0.0 (2026-08-04) within the current raw-principal compatibility profile. Read [design and protocol profiles](references/design-and-protocol-profiles.md) first. Do not require `meta.field.update` or `data.field.update` for business values, and do not mistake raw principal rows for final Decision output.

普通新建保留 legacy profile：`data.record.create` 控制操作，字段由 `createFields` 与 `meta.field.read` 匹配结果中历史 create-state 集合所允许字段取交集；本轮不迁移新建字段维度或收紧状态。v3 不定义 `creatable`。有效审批新建按 [make-app-approval](../make-app-approval/SKILL.md) 使用启动配置授权字段，保留应用、对象和新建操作资格，配置失败不回退普通字段。

- Expose `/api/make/app/principal/permission`; have Service call `/api/make/iam/v1/principal/permission` with App scope, `MakeService.GetResource`, and the established login context. This is a direct Make proxy: return every completed IAM response unchanged, including 2xx/4xx/5xx status, Content-Type, and body. Do not request tenant-root scope or upstream platform permission filters. Before strict normalization, classify rows with `references/permission-boundaries.md`: ignore only clearly unrelated rows, and fail closed for every selected or unclassifiable row.
- Match exact, wildcard, parent, App, entity, IAM namespace-wildcard App resources, and deny correctly. Use most-specific allow field ranges and same-level unions only for the retained legacy-create profile; existing-record field checks preserve all applicable restrictions across rows and resource levels. Matching operation deny wins.
- Permission keys identify operations; `fieldAccess` is a separate property on a matched IAM permission result, and values such as `creatable`, `editable`, and `readonly` are access states. Never append `fieldAccess` to a permission key.
- Keep create, visibility, and editability separate:
  - ordinary create: the legacy `createFields` intersection and historical create-state set described in the profile reference;
  - table headers: Schema `fields` filtered by metadata visibility (`meta.field.read`);
  - business values: metadata-visible fields under the record-read gate and effective field restrictions, preserving masks;
  - single/bulk editing: the independently requested update/bulkUpdate gate plus metadata-visible, readable fields whose effective state permits writing, and host capability. Merge applicable metadata-read and record read/write restrictions conservatively; never authorize from just one permissive operation row.
- Keep entity navigation, table headers, and record data independent: `meta.entity.read` controls whether a Schema-present entity appears in navigation and can enter its object route; both the navigation and the dynamic route must reject the entity when this permission is absent. `meta.field.read` controls the authorized columns/table headers; `data.record.read` controls record/detail requests, rows, and business-value field access. Metadata authorization never grants record values. When record read is denied or revoked but entity and fields are authorized, keep the navigation item and table shell with authorized headers, skip every record request, and render an explicit empty row set so cached values cannot remain visible.
- Preserve every access state returned for a field. Current IAM responses may use arrays such as `["creatable", "readonly"]` or scalar strings; normalize a supported scalar string to a one-element array. Existing-record writes reject every applicable readonly/hidden/mask state even when another state is editable or compatibility `*`; the retained legacy create profile keeps its historical evaluator and hidden-exception handling. Never coerce an array with `String(value)` or template interpolation.
- Treat missing `createFields` as empty. Never fall back to `fields`, and do not consume `editableFields` for current edit behavior.
- Gate the create entry and submit operation with `data.record.create`; 普通新建 retains legacy fields from `meta.field.read` and `createFields`, while 审批新建 uses authorized 启动配置 fields. `meta.field.create`, `meta.field.update`, and `meta.field.delete` concern field definitions. `data.field.update` is not a prerequisite in the cited design/profile. Keep update/delete/bulkUpdate operation gates independent while merging applicable field restrictions across their raw allow rows.
- Recompute current field authorization before submit. Build payloads from rendered fields, and reject the entire existing-record write if any attempted field is now restricted, stale or unauthorized; preserve the draft and never silently trim a forbidden update then report success.
- Exclude ID and system audit fields from create capability. Keep existing audit-field edit capability when the field is visible, update-authorized, and supported by the host editor.
- Keep create-only invisible fields available only in create mode. A `creatable` access state is not readable or editable.
- Add App/object/fixed-route guards; hiding menus or buttons is not authorization. Recheck handlers before reads and mutations.
- Refresh permission and permission-trimmed Schema in one access generation before data refresh. Invalidate stale permission, Schema, form, and record work; do not close a still-authorized create surface merely because read is revoked.
- Fail closed on permission or Schema failure. Leave row-level `dataCondition` enforcement to backend APIs.
- Permission and Schema request failures must retain the safe structured `kind/status/title/description/traceId` from the shared request adapter through Provider state to the error outlet. Use `make-app-observability` for request-error classification and card presentation; do not reduce these failures to a plain string or expose raw upstream errors. A denied permission result is still a forbidden state, not a fabricated request failure.
- Add Service/schema, permission-model, route/page, payload, special-field, refresh, and negative audit tests.

## Reference map

| Task | Read |
| --- | --- |
| Versioned design, raw principal vs Decision, legacy create and conservative write restrictions | `references/design-and-protocol-profiles.md` |
| Platform vs App scope, create/read/update field surfaces, Schema collections, matching | `references/permission-boundaries.md` |
| Service endpoint, IAM request/response, metadata vs record `fieldAccess` | `references/service-principal-permission.md` |
| Providers, helpers, routes, create/edit flow, payload, refresh, Lookup | `references/ui-permission-runtime.md` |
| Exact ID/audit create exclusions and edit compatibility | `references/system-field-contract.md` |
| Required tests, audit signals, completion blockers | `references/testing-and-audit.md` |
| Auth/session | Use `make-app-auth` |
| Schema/API transport and cache | Use `make-app-service` |
| Form/empty-state presentation | Use `makeui` |
| Table/cell-editor mechanics | Use `canvas-table-integration` |
| Selection, row precheck, batch actions | Use `make-app-actions` |
| Runtime gateway and packaging | Use `make-app-runtime` |

## Audit

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
```

Treat failures as blockers and warnings as review items. The audit is heuristic and never replaces runtime tests.
It rejects obvious `fieldAccess` state-array coercion through `String(...)`, text helpers, template interpolation, `.toString()`, or `.join()` when the coerced value affects normalization output or permission evaluation, including direct control-flow conditions. Diagnostic-only logging, comments, and string literals inside a named normalization helper must not fail the audit, regardless of whether the parameter uses a generic or `fieldAccess`-specific name. The executable behavior contract remains authoritative.

Also expose a thin host adapter and run the executable behavior contract:

```bash
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <host-adapter-module>
```

If the adapter is TypeScript, run the same command through the host's existing TypeScript runner. Do not add a runtime dependency only for this check. The adapter must delegate to the production permission helpers and create-capability guard; it must not reimplement them in the test.
Keep the audit and conformance runner project-local or install them through a versioned dependency before making them a host gate. Do not hardcode another workspace checkout or a developer home-directory Skill path into portable CI.

For local Skill install/release verification, compare the complete source and installed directories:

```bash
node skills/make-app-permission/scripts/check-installed-skill-sync.mjs \
  skills/make-app-permission <installed-skill-dir>
```

The checker reports source-only, installed-only, and content-mismatch files. Pass an explicit install directory; do not embed a developer home path in the Skill or in host CI.

For a release that changes the shared Service/auth/permission contract, update the
installed platform package first, then verify all affected Make App Skills:

```bash
npx skills update qfeius/make-platform-skills
node scripts/check-installed-make-platform-skills-sync.mjs \
  skills <installed-skills-dir>
```

Run this only after the source revision has been published through the platform
Skill release flow. It is a local release verification, not portable host CI.
