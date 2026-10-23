# Permission boundaries

Single source for permission semantics. Use [Service principal permission](service-principal-permission.md) for proxy transport, [UI runtime](ui-permission-runtime.md) for consumers, and [testing](testing-and-audit.md) for verification.

## Design and protocol boundary

Source: [PermissionDesign.md](https://git.qtech.cn/make/AgenticDSL/-/blob/4afc22a4a2797b86d6174121014f23bee8bb587d/Design/PermissionDesign.md), **v3.0.0, 2026-08-04**, sections FieldCondition, 字段级 / 行级合并语义 and 字段策略后处理. The [compatibility incident report](https://ysi13ckdb9.feishu.cn/docx/A0ZNdm5vFoNHrdxcwdPc5NYsn7d), revision 12 (2026-10-23), describes the current raw principal response. Its separate application verification is background, not evidence that another host or platform version passed.

| Profile | Contract |
| --- | --- |
| v3 Decision / Plan | Record gate plus final five-state field map; Statement grouping is known to the evaluator. |
| Current raw principal | Existing App-scoped `/principal/permission` response; scalar/array states and compatibility `*`; Statement identity may be lost. |
| Legacy ordinary create | Retains `createFields` and historical `meta.field.read` create-state selection, independently gated by `data.record.create`. |

Keep the principal proxy. Do not migrate to `/decision` or `/decision/plan`, fabricate final Decision fields on raw rows, coerce a pure Decision envelope into principal permissions, or claim complete v3 evaluation in the browser. A confirmed final Decision map is already resolved and must not be reinterpreted as raw rows. Future protocol changes require an independently verified profile.

`permissionKey` identifies an operation; `fieldAccess` is a sibling result property mapping field keys to access states, never a permission-key suffix or a field set itself. `meta.field.read`, `meta.field.create`, `meta.field.update` and `meta.field.delete` concern field definitions. `meta.field.create` exists; neither metadata update nor `data.field.update` is a business-value editing prerequisite in this profile.

## App scope and row selection

Request exactly `make://<tenantId>/meta/app/<appKey>`, without tenant-root scope or platform permission filters. Supported decisions are `data.record.read`, `data.record.create`, `data.record.update`, `data.record.bulkUpdate`, `data.record.delete`, `meta.entity.read`, and `meta.field.read`. Match exact keys and valid three-part wildcards (`data.record.*`, `meta.field.*`, `*.*.*`, including segment wildcards); a wildcard is supported only if it matches a supported decision. Metadata writes are outside these business helpers; unknown keys are not future-proof grants.

Validate the envelope/scope before classifying rows, then validate selected rows strictly:

| Resource | Key | Result |
| --- | --- | --- |
| Global `*` or current App's documented resource | Supported exact key or supported three-part wildcard | Select; validate strictly. |
| Same resource | Valid three-part unrelated key, e.g. `data.record.export`, `meta.field.custom`, `iam.permission.read`, `make.platform.admin`, `meta.app.read` | Ignore before validating effect/fieldAccess. Never grants, denies or blocks App readiness. |
| Same resource | Non-string or malformed supported-namespace key, e.g. `data.record`, `meta.field` | Select; fail closed. |
| Tenant-root `make://<tenantId>` or valid other tenant/App resource | Any key | Ignore before row validation. |
| Missing, malformed, arbitrary-namespace or wildcard tenant/App resource | Any key | Unclassifiable: select; fail closed. |
| Null, primitive or array row | N/A | Unclassifiable: select; fail closed. |

Strict validation:

- Scope is the exact App resource. If independently supplied, `appResource` must exactly equal scope; null/blank/non-string-equivalent/conflicting values deny.
- Selected rows require three non-empty key segments, `effect: allow|deny`, and a supported resource family. One malformed selected/unclassifiable row poisons the entire snapshot; never discard it while retaining sibling allows.
- Omitted/empty-object `fieldAccess` is intentional. Explicit null, non-object/array containers, blank field keys, empty state lists, unknown states or mixed non-string state lists are malformed. Preserve supported scalar strings as one-element arrays and all returned states; never stringify state arrays.
- Null/primitive envelopes or rows and non-array `permissions` deny without throwing.
- Requested entity/field identifiers must be concrete strings: reject null, numbers, objects, arrays, blank/whitespace and literal `*` before matching. Wildcards belong to policy statements only.

This response tolerance does not widen the upstream query. Surplus IAM rows are a separate upstream issue.

## Resources and operation gates

Supported resource families:

```text
*
make://<tenantId>/meta/app/<appKey>
make://<tenantId>/meta/app/<appKey>/entity/*
make://<tenantId>/meta/app/<appKey>/entity/<entityKey>
make://<tenantId>/*/app/<appKey>
make://<tenantId>/*/app/<appKey>/entity/*
make://<tenantId>/*/app/<appKey>/entity/<entityKey>
```

Namespace alias `*` represents the same App family as canonical `meta`; it is not tenant-wide permission. Arbitrary namespaces and wildcard tenant/App segments are invalid. Named-entity grants/restrictions never leak to another entity.

Record gates use only the requested operation: explicit matching deny wins, otherwise at least one matching allow is required. Keep create/read/update/delete/bulkUpdate independent. Single edit/cell edit uses `data.record.update`; batch edit uses `data.record.bulkUpdate`. Missing/denied update does not close an independently allowed bulk operation, or the reverse; delete implies neither. Field defaults never supply a missing gate or bypass backend row-level `dataCondition`.

## Effective existing-record field states

The v3 vocabulary is `hidden`, `fullMask`, `partialMask`, `readonly`, `editable`; default editable is bounded by the allowed record scope. It defines neither `creatable` nor access state `*`.

V3 evaluation has two phases: within a confirmed Statement, its named field overrides its own `*` baseline; across Statements the strictest wins:

```text
hidden > fullMask > partialMask > readonly > editable
```

The final Decision/Plan maps each field to one state; `readonlyFields` includes every non-editable field. Its no-update downgrade and read/update aggregation describe authoritative evaluation, not a new independent field-update gate or a reason to couple the current update/bulkUpdate gates.

Current raw compatibility evaluation:

1. Under the requested allowed operation, collect applicable field restrictions from **allow rows** for `meta.field.read`, `data.record.read`, `data.record.update`, and `data.record.bulkUpdate`, including matching wildcard keys and broader applicable resources. Another operation's missing allow is not an extra gate; its applicable field restrictions still participate when present.
2. Raw rows may aggregate Statements. Without confirmed provenance/grouping or authoritative pre-expanded states, retain both named and baseline restrictions **within and across rows**. Do not pick an editable operation row, drop a broader restriction for a more-specific allow, or let named editable erase a readonly/mask/hidden baseline. Conservative false denials are preferable to widening access; this does not reconstruct an exact v3 Decision.
3. For writing, any applicable `readonly`, `hidden`, `partialMask` or `fullMask` denies, even beside `editable` or compatibility `*` in an array. For reading, hidden suppresses the value; masks stay masked. A `creatable`-only field remains create-only, unreadable and unwritable in existing-record consumers.
4. Empty/omitted field restrictions, or no restriction for the requested field, add no restriction. An already visible/readable Schema field defaults writable under the requested allowed operation and host editor capability; no named editable or separate field-permission allow is required. This never cancels a sibling restriction, grants a missing operation or defines final backend empty-container behavior.
5. Check every attempted existing-record field again before mutation and at the Service boundary. Any restricted, stale, unknown or unauthorized field rejects the **whole** update/bulk mutation. Preserve draft and selection, report failure, never silently trim into success, and never auto-replay after permission restoration. The v3 backend contract specifies 422 when a submitted field hits `readonlyFields`.

## Legacy ordinary create and approval create

Ordinary create retains the historical profile: operation gate `data.record.create`, plus `createFields` intersected with fields selected from matched `meta.field.read` results using `creatable|readonly|editable|partialMask|fullMask|*`. This is compatibility behavior, not v3 field semantics or permission to create field definitions. Do not move create fields into the create-operation row or tighten states without a verified target-environment contract.

Legacy matching retains the fixed specificity `global * < App < entity/* < exact entity`; canonical and namespace aliases at the same level are equal. Use most-specific allow ranges, same-level allow unions and named-over-wildcard/empty baselines across those ranges. If a named entry exists, do not fall back to another row's baseline; named hidden wins over permissive named states. Empty most-specific allow restrictions remain unrestricted within the Schema bound. These widening rules do **not** apply to existing-record restriction merging.

Approval create with a valid `bpmDefinitionKey` uses [authorized Workflow start-config fields](../../make-app-approval/references/initiation-contract.md), without intersecting ordinary `createFields`/IAM fields. Keep App/entity/create-operation eligibility and target-read/type-capability checks. Configuration failure never falls back to ordinary fields. This exception does not alter existing-record editing.

## Schema and independent surfaces

`fields` bounds visible list/detail/filter/edit structure; `createFields` separately bounds ordinary create and missing/null/invalid becomes empty, never falls back to `fields`. Current edit behavior ignores `editableFields`. Schema membership never replaces principal checks; principal permissions cannot add fields outside the relevant Schema collection.

| Surface | Required result |
| --- | --- |
| Navigation and dynamic object route | Schema entity plus `meta.entity.read`; absent permission hides navigation and rejects direct URL before page mount. |
| Table shell/headers | Metadata-visible Schema fields; independent of record read. |
| Rows/detail/pagination and record-backed controls | `data.record.read` gate plus effective field restrictions. |
| Ordinary create | Legacy-authorized `createFields` plus create capability. Create-only invisible fields remain create-only. |
| Single/bulk edit | Visible/readable fields plus the requested independent gate, effective writable state and matching editor capability. |

If record read is absent/revoked but entity/headers remain authorized, keep navigation and the table shell, provide explicit empty rows, skip requests and disable record-backed controls. Disabling only future requests cannot leave cached values visible. Do not hide create/normal edit entries because writable-field count is zero; create shows “暂无可新建字段” and disables unsupported empty submission. Batch-action field-count behavior belongs to `make-app-actions`.

ID/audit capability rules are exact in [system-field-contract.md](system-field-contract.md). Protect App/object/create/fixed routes and handlers, preserve backend row/final authorization, isolate Schema caches by principal/tenant/App/access generation, and publish refreshed permission plus Schema atomically before protected data. UI lifecycle details are in [UI runtime](ui-permission-runtime.md).
