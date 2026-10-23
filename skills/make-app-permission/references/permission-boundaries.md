# Permission boundaries

Use this reference before choosing scope, resource, permissionKey, Schema collection, or field access state.

## Contents

- Front-end App scope
- Single-App operations and resources
- Independent field dimensions
- Schema and permission intersection
- Matching semantics
- Route and backend boundaries
- Common mistakes

Read [design and protocol profiles](design-and-protocol-profiles.md) before applying these rules: v3 final Decision semantics, raw principal compatibility, and legacy create are different contracts.

## Front-end App scope

This skill only consumes the front-end App permission response. Request the exact App scope `make://<tenantId>/meta/app/<appKey>` and use only the rows needed for this App's `data.record.*`, `meta.entity.*`, `meta.field.*`, and supported wildcard decisions. Do not use tenant-root or unrelated permission results to authorize App routes, fields, buttons, or records.

## Permission-row selection

Validate the response envelope and derive the current App from `scope` first. Then classify each permission row before strict row validation; do not use a broad namespace-prefix heuristic.

| Resource classification | Key classification | Result |
| --- | --- | --- |
| `*`, or a documented canonical/namespace-alias resource for the current tenant and App | Exact supported key, or a valid three-part wildcard matching at least one supported key | Select and validate strictly. |
| `*`, or a documented canonical/namespace-alias resource for the current tenant and App | Structurally valid three-part key that matches no supported decision, such as `data.record.export`, `meta.field.custom`, `iam.permission.read`, `make.platform.admin`, or `meta.app.read` | Clearly unrelated: ignore without validating `effect` or `fieldAccess`; it must never grant or deny an App capability. |
| `*`, or a documented canonical/namespace-alias resource for the current tenant and App | Non-string key, or malformed/truncated key in a supported namespace such as `data.record` or `meta.field` | Select and fail closed during strict validation. |
| Tenant-root `make://<tenantId>`, or a structurally valid documented App resource for another tenant/App | Any key | Clearly unrelated: ignore without validating row fields. |
| Missing, malformed, arbitrary-namespace, or wildcard-tenant/App resource | Any key | Unclassifiable: select and fail closed. |
| Null, primitive, or array row | N/A | Unclassifiable: select and fail closed. |

Supported decisions are `data.record.read`, `data.record.create`, `data.record.update`, `data.record.bulkUpdate`, `data.record.delete`, `meta.entity.read`, and `meta.field.read`. Metadata writes such as `meta.field.create`, `meta.field.update`, and `meta.field.delete` exist but are outside this business App helper set. A valid wildcard is supported only when it matches at least one item in that list; `*.*.*` is therefore supported. Unknown decisions are not future-proof grants: when a new business decision is introduced, update this list, its matching helper, and the conformance cases together.

This local response tolerance does not alter the upstream query: Service still requests only the exact App scope and no platform permission filter. IAM should correct surplus response rows separately.

## Single-App operations and resources

Common record keys:

```text
data.record.read
data.record.create
data.record.update
data.record.bulkUpdate
data.record.delete
data.record.*
*.*.*
```

Entity metadata key:

```text
meta.entity.read
```

Normal edit/cell edit uses `data.record.update`; batch edit uses `data.record.bulkUpdate`. Keep all operation keys independent.

Common resources:

```text
make://<tenantId>/meta/app/<appKey>
make://<tenantId>/meta/app/<appKey>/entity/<entityKey>
make://<tenantId>/meta/app/<appKey>/entity/*
make://<tenantId>/*/app/<appKey>
make://<tenantId>/*/app/<appKey>/entity/<entityKey>
make://<tenantId>/*/app/<appKey>/entity/*
*
```

The namespace `*` in `make://<tenantId>/*/app/<appKey>` represents the same App family as response scope `make://<tenantId>/meta/app/<appKey>`; it is not tenant-wide platform permission.

## Entity metadata, table structure, and record data

The object, its visible columns, and its record values are three independent read surfaces:

| Surface | Required permission | Behavior when denied |
| --- | --- | --- |
| Sidebar/navigation and object route | `meta.entity.read` | Hide the entity and reject its dynamic object route. |
| Table shell and headers | `meta.entity.read` plus `fields ∩ meta.field.read` | Keep only the authorized field headers; an empty visible-field set uses the host's zero-column state. |
| List rows, record details, pagination, and any record-backed header action | `data.record.read`; each value is additionally bounded by its `fieldAccess` | Do not issue a record request and do not render record values. |

Schema membership remains an upper bound: an entity must exist in the permission-aware Schema before it can be displayed in navigation or entered by route. Within that bound, do not let `data.record.read` decide entity navigation or table-header visibility, and do not let `meta.entity.read` or `meta.field.read` authorize a record request.

For an entity that has `meta.entity.read` and readable fields but lacks `data.record.read`, mount the normal table shell with `visibleFieldsForEntity(...)` as its columns, provide an empty row array, and use a clear no-record-access state if the host has one. Derive the table rows as `canReadRecords ? sourceRows : []`, or clear the record store that actually supplies the table rows before render; disabling only the next request is insufficient because previously loaded rows may remain cached. Do not replace the table with a forbidden page or remove its headers. Record-backed controls such as load-more, detail opening, filtering, sorting, grouping, or selection remain disabled unless their own record-read contract is satisfied.

## Independent field dimensions

以下新建字段维度与交集描述普通无有效审批配置的场景。审批新建按 [审批发起合同](../../make-app-approval/references/initiation-contract.md) 使用启动配置的 `readable/editable`；不再与这里的 `createFields`/IAM 字段集合求交。对象与操作权限、普通列表/详情字段和已有记录编辑仍遵守本文件。

Metadata access and business-value access are separate decisions. `meta.field.read`, `meta.field.create`, `meta.field.update`, and `meta.field.delete` read/create/update/delete field definitions; `meta.field.update` does not edit a record's field value. `meta.field.create` exists, but does not authorize new business records.

| Surface | Schema upper bound | Operation / field evaluation |
| --- | --- | --- |
| Ordinary create (legacy only) | `createFields` | `data.record.create` gate; historical create states from matched `meta.field.read`: `creatable`, `readonly`, `editable`, `partialMask`, `fullMask`, `*` |
| Table headers / definitions | `fields` | `meta.field.read` metadata visibility |
| List/detail/filter values | metadata-visible `fields` | `data.record.read` gate plus effective readable/masked field states |
| Edit/cell edit | readable fields | `data.record.update` gate plus effective writable state and editor capability |
| Batch edit | readable fields | independent `data.record.bulkUpdate` gate plus the same conservative field-state checks and batch capability |

Existing-record effective write restrictions include applicable `meta.field.read` and record read/write allow rows; do not pick only the current operation's permissive `fieldAccess` property. Metadata update is not a business-write gate. No independent `data.field.update` prerequisite is defined in the cited design. Record operations remain independent; an allow for update cannot grant bulkUpdate or delete.

`readonly`, `hidden`, `partialMask`, and `fullMask` all deny existing-record writes; any such applicable array state wins over `editable` or compatibility `*`. Only the legacy create profile retains its historical create-state evaluation. It does not redefine v3, whose five field states exclude `creatable`.

## Schema and permission intersection

Treat the permission-trimmed Schema collections as separate contracts:

- `fields`: visible structural upper bound for list, detail, filter, and edit.
- `createFields`: create structural upper bound; missing or invalid means empty, with no fallback to `fields`.
- `editableFields`: currently ignored. Preserve unknown response fields when appropriate, but do not consume this collection for edit behavior.

Compute the field-set intersections below using the permission keys and allowed `fieldAccess` states in the table above. A permission key is an identifier; the matched result's `fieldAccess` property describes field access and is not part of that identifier.

```text
entity = permission-aware Schema entity ∩ meta.entity.read
headers = fields ∩ metadata-visible fields
create = createFields ∩ fields allowed by the legacy meta.field.read create-state profile ∩ create-capable UI fields
display = headers ∩ fields allowed for reading business values
edit = display ∩ effectively writable fields under the single-update gate ∩ edit-capable UI fields
batchEdit = display ∩ effectively writable fields under the independent bulk-update gate ∩ batch-capable UI fields
records = data.record.read ? field-authorized/masked rows : []
```

ID and audit fields listed by `system-field-contract.md` must not enter the create set. An audit field may remain editable when it is in visible `fields`, has update permission, and has a supported editor.

Schema membership never replaces principal permission checks, and principal permission never permits fields outside the relevant Schema upper bound.

## Matching semantics

- Match exact permission keys, `data.record.*`, `meta.field.*`, `*.*.*`, and valid three-part wildcards.
- Validate the envelope before selecting rows: the current scope must be an exact `make://<tenantId>/meta/app/<appKey>` App scope, and an extra `appResource` value must exactly equal that scope; explicit `null`, blank, non-string-equivalent, or conflicting values fail closed. Apply the permission-row selection table before strict row validation. Every selected or unclassifiable row must have exactly three non-empty `permissionKey` segments and an `allow` or `deny` effect; one malformed row poisons the whole access snapshot. Never drop a malformed selected row while retaining sibling allows.
- Treat requested entity and field keys as concrete string identifiers, not policy patterns. Non-strings (including `null`, numbers, arrays, and objects), blank/whitespace strings, and the literal `*` must fail closed before resource or field wildcard matching; `*` is valid only inside permission statements.
- A selected row may use only the documented permission resource families: global `*`, or the current tenant/App with namespace `meta` or IAM alias `*`, optionally followed by an exact or wildcard entity. Do not treat arbitrary namespaces or wildcard tenant/App segments as App permission. A resource that cannot be classified as clearly unrelated must remain selected and fail closed rather than being guessed away.
- Keep the fixed resource order `global * < current App < entity/* < exact entity` for legacy create range selection; canonical and namespace-alias resources at the same level have equal specificity. Legacy create retains most-specific allows, same-level unions and its existing named-over-baseline behavior. Do not apply that widening algorithm to existing-record field restrictions.
- Operation gates match the requested permission only; explicit matching `effect: deny` wins over allow. Missing operation grants remain denied. A deny for single update does not itself deny an independently allowed bulkUpdate; field-only restrictions use access states rather than an operation deny statement.
- Under v3, named fields override the baseline inside one Statement, then different Statements merge by strictness: `hidden > fullMask > partialMask > readonly > editable`. Raw principal rows do not reliably retain Statement grouping. A single raw row may aggregate several Statements. Without confirmed grouping or authoritative pre-expanded field states, existing-record checks conservatively retain restrictions from both the baseline and named entries, then keep all applicable metadata-read and record read/write restrictions across rows and resource levels. Named-over-baseline applies only to confirmed Statement groups; a final Decision map is already resolved. Never use a named editable row to erase another row's baseline restriction or claim to have reconstructed final v3 evaluation.
- An empty/omitted raw `fieldAccess` contributes no field restriction. For existing records, this default is usable only under the requested allowed operation, visible/readable Schema bounds and host capability. It never overrides a restrictive sibling row or grants a missing operation. The legacy create profile retains its existing unrestricted representation. Neither rule defines a final Data API write decision's empty-container semantics.
- Distinguish an omitted or empty `fieldAccess` from a malformed value. An omitted property or empty object is the intentional unrestricted form; explicit `null`, a non-object, an array, a blank field key, an empty state list, an unknown state, or a state list containing non-strings is invalid IAM data and the access snapshot must fail closed instead of being normalized to `{}`. Null/primitive envelopes or rows and non-array `permissions` must return denied access without throwing.

`fieldAccess` is a result property; its values are states, not permission keys. The current raw profile accepts scalar strings and state arrays, with `*` as compatibility unrestricted. For existing-record writes, combine restrictions rather than allowing any editable state. `creatable` is accepted only for legacy compatibility and never itself grants existing-record writing.

## Route and backend boundaries

- Protect App, object, create, and fixed routes; require `meta.entity.read` inside the dynamic object route as well as navigation, because menu hiding is insufficient and direct URLs bypass the sidebar.
- Do not load list/detail without `data.record.read`; this must stop record requests and rows without hiding an entity-authorized table shell or its `meta.field.read` headers.
- Recheck create/update/delete/cell/batch handlers immediately before mutation.
- Let backend record APIs enforce row-level `dataCondition` and final write authorization. Reject an entire existing-record mutation when any submitted field is restricted; retain the draft/selection, report failure and never silently trim forbidden changes into a success.
- Do not cache permission-trimmed Schema across principals. Refresh permission and Schema together when access is refreshed.

## Common mistakes

- Using tenant-root scope or a platform filter for App permissions.
- Using `data.record.read` as the left-navigation, object-route, table-shell, or table-header gate.
- Removing authorized table headers when record read is denied instead of rendering the authorized columns with no rows.
- Rendering create forms from `fields` or `editableFields`.
- Falling back from missing `createFields` to visible `fields`.
- Treating `creatable` as readable or transferring a state between permission dimensions.
- Using or requiring `meta.field.create` for a create form.
- Requiring a metadata-write or invented data-field-update gate for business values, ignoring metadata-read/record-field restrictions, or choosing one editable row to bypass a restrictive sibling.
- Migrating legacy create fields or tightening create states as a side effect of the edit correction.
- Hiding create/edit because no writable field exists.
- Filtering visible controls but submitting the complete form store.
- Refreshing permissions without invalidating permission-trimmed Schema.
