# UI permission runtime

Use this reference for UI consumption and lifecycle. Compute all authorization with [permission boundaries](permission-boundaries.md), and use [system-field-contract.md](system-field-contract.md) for exact capability guards.

## Contents

- Provider and data sources
- Permission model
- Route and operation gates
- Create flow
- Read/edit flow
- Special fields and Lookup
- Refresh generation

## Provider and data sources

Mount identity, permission, permission-aware Schema, then router/pages:

```jsx
<AuthGate>
  <PermissionProvider>
    <SchemaProvider>
      <AppRouter />
    </SchemaProvider>
  </PermissionProvider>
</AuthGate>
```

The global error outlet must remain mounted outside conditional `PermissionProvider` and `SchemaProvider` success branches, under its shared error-state owner. It must still receive the first permission request failure when `AppRouter` and the page Shell have not mounted. Keep the provider order above for authorization and Schema loading; placing the outlet in a persistent app-root layer does not change that order.

Use the host API adapter for `/app/principal/permission`; never raw-fetch IAM from UI.

When permission or permission-aware Schema loading fails, keep a safe structured request error in Provider state through the error outlet: `kind/status/title/description/traceId`. The status is optional when no HTTP response exists, and description may be absent. Preserve the request Trace ID even on the first load, when the page route has not mounted yet. The error title and description must already be safe user text; do not pass a raw Error, upstream response body, or stack to the UI. Continue to fail closed for authorization, but render the failure through the shared `make-app-observability` card. Ordinary permission denial stays a forbidden state and does not acquire a synthetic Trace ID. If nearby copy tells users to provide a Trace ID, confirm the card actually receives and displays a valid one.

## Permission selectors

Consume the validated `{ principal, scope, appResource, permissions }` model and independent Schema collections from [permission boundaries](permission-boundaries.md); do not duplicate its normalization or matching algorithm in components. Keep pure selectors (or equivalent existing helpers):

- `canUseEntityOperation(access, entityKey, permissionKey)`
- `canCreateEntityField` / `creatableFieldKeysForEntity` for legacy create
- `visibleFieldsForEntity` for metadata headers
- `canReadEntityField` / `recordReadableFieldsForEntity` for business values
- `canUpdateEntityField` / `editableFieldKeysForEntity` for effective single-update capability
- equivalent operation-aware bulk selectors when batch editing is supported

Names describe behavior, not mandatory new production exports. Thin conformance wrappers are specified in [testing](testing-and-audit.md).

## Route and operation gates

- Validate App entry and dynamic entity membership against permission-aware Schema, and require `meta.entity.read` before exposing an entity in left navigation or entering its dynamic object route. The route itself must return the host forbidden result before it mounts the object page; hiding the sidebar is not a route guard. When a host `ProtectedRoute`/`RouteGuard` is used instead of an explicit forbidden branch, return that guard from the dynamic route and bind it to the resolved current `entityKey`; merely declaring an unrelated guard does not protect the object page.
- Bind fixed routes to an entity and permissionKey.
- Require `data.record.read` before list/detail loading. It only gates record requests and values; it must not gate an entity-authorized navigation entry, table shell, or column headers.
- Require `data.record.create` for create routes, create entry, open handler, and submit.
- Consume the ordinary-create legacy selector or approval-start field selector defined in permission boundaries; keep the create operation check separate.
- Require `data.record.update` for edit routes/entry/submit/cell commit.
- Keep delete and bulkUpdate independent.
- Do not use field-count conditions to hide create or normal edit entries.
- Recheck each handler before its protected read or mutation.

If create is allowed but no creatable fields remain, keep the create entry and render a “暂无可新建字段” empty state. Disable save unless the documented business API explicitly supports empty-record creation.

## Entity navigation and table surface

Derive the object surface in three independent steps:

```text
canViewEntity = canUseEntityOperation(access, entityKey, 'meta.entity.read')
visibleFields = visibleFieldsForEntity(access, entityKey, entity.properties.fields ?? [])
canReadRecords = canUseEntityOperation(access, entityKey, 'data.record.read')
sourceRows = recordState.items
tableRows = canReadRecords ? sourceRows : []
```

Render navigation/the dynamic route only for a Schema-present, entity-authorized object. Return the resolved entity route guard before mounting the page. Render headers from `visibleFields`; gate requests, details, pagination and record-backed controls with `canReadRecords`. Apply current effective field restrictions before displaying values; retain masks and omit denied raw values.

On absent/revoked record read, supply `rows={tableRows}` (or the Canvas equivalent) with explicit `[]`, retain metadata-authorized headers, and skip `onDataLoad`. Either derive rows from current access as above or clear the actual row store before render: changing query `enabled` alone cannot remove cached rows. Use a no-record-access/empty state instead of removing the table.

## Create flow

先判断普通新建或审批新建。以下计算、提交步骤及普通 create 的就绪检查适用于无有效 `bpmDefinitionKey` 的场景；有效审批的新建字段、附件和 Lookup 源字段白名单按 [审批发起合同](../../make-app-approval/references/initiation-contract.md) 切换，UI/Service 同步执行，不能把本文件的普通源字段交集再次套到审批字段。目标对象授权、类型能力与已有记录编辑规则保持不变。

Compute create fields only from the create collection and create permission:

```text
createSchemaFields = entity.properties.createFields ?? []
creatableKeys = creatableFieldKeysForEntity(access, entityKey, createSchemaFields)
createFormFields = createSchemaFields
  .filter(field => creatableKeys.has(field.key))
  .filter(supportsCreateInput)
```

Do not require the field to be in visible `fields`, readable, or editable. A create-only invisible field must render and accept a value in create mode, then disappear from list/detail/edit.

Before submit:

1. Use the latest access generation and recheck `data.record.create` for the operation.
2. Re-read latest `createFields` and recompute legacy creatable keys from matched `meta.field.read` results using the retained historical profile.
3. Validate only authorized, rendered fields, including `validations.isRequired` and type-specific validation.
4. Build an allowlist payload from those fields; never spread all form values.
5. Build relation/Lookup payloads from the same allowlist.
6. Reject DevTools-injected, stale, hidden, or unauthorized values before the request.

Created-record metadata mapping may use visible `fields`; returned business values must also satisfy current effective read restrictions, including the matched `data.record.read` result's `fieldAccess`. Do not use either read set to filter the create request data.

## Read/edit flow

Use:

```text
headers = visibleFieldsForEntity(access, entityKey, entity.properties.fields ?? [])
readable = recordReadableFieldsForEntity(access, entityKey, headers)
editable = editableFieldKeysForEntity(access, entityKey, readable)
  .filter(isEditCapableField)
```

- Render table headers from `headers`; render business values and record-backed field controls only from `readable`, preserving masks from the record-read dimension.
- Mark visible non-editable form fields readonly/disabled.
- Do not attach cell editors or required validation to non-editable fields.
- Build update payloads from rendered fields, then validate every attempted field against current effective restrictions in UI and Service. If any is restricted, stale or unauthorized, reject the whole mutation, retain the draft and report failure; never silently drop that field and show success.
- Consume the effective edit selector from permission boundaries; ignore backend `editableFields` and keep single/bulk operation contexts separate.
- A create revoke closes create only. An update revoke closes edit only. A `data.record.read` revoke closes detail/edit and stops reads while retaining entity-authorized navigation and headers; it must not close a still-create-authorized create surface. A `meta.entity.read` revoke closes the object route and removes the navigation entry.

## Special fields and Lookup

Apply the exact ID/audit/process-field guards in [system-field-contract.md](system-field-contract.md) after the mode-specific field selector.

**File (`Make.Field.File`)** is a host capability. Declare one supported contract: persisted-record routes (`POST .../records/:recordID/files/:fieldKey`) require an existing record and are create-incapable; an explicitly documented pre-upload/direct-create contract may accept only the backend-approved attachment array without `recordID`. Never infer pre-upload from required metadata, createFields or permission. For persisted-record-only files, omit create rendering, required validation and payload; read/edit still uses current authorization, record identity and edit capability.

**Lookup (`Make.Field.Lookup`)** is writable only with relation metadata and a complete host mutation contract; otherwise render readonly/unsupported. Load candidates via the dedicated route (normally `GET .../lookup-options?sourceEntityKey=&lookupFieldKey=&keyword=&page=&size=`), never an unrestricted target list. Ordinary-create source definitions resolve visible `fields`, then `createFields` for create-only sources. Approval-create sources use authorized start-config definitions even when an ordinary visible key matches. Target entity/display fields always come from visible target `fields`, with target effective read restrictions applied to labels/values; target `createFields` cannot bypass visibility. Candidate values are exact target `recordID` strings; labels/option objects are presentation only.

Keep ordinary data and Lookup values separate:

| Operation | UI-Service payload | Service requirements |
| --- | --- | --- |
| Create `POST .../records` | `{ data: ordinaryAllowlistedData, relations: { [lookupFieldKey]: recordID \| recordID[] \| null \| [] } }` | Exclude Lookup keys from ordinary data. Reauthorize source keys by the current ordinary-create or approval-start allowlist; validate metadata, cardinality, target visibility/existence and exact identity; synthesize Make `data.qfei_relation: [{ entityKey, id }]`. |
| Edit `PATCH .../records/:recordID/lookup-relations` | `{ values: { [lookupFieldKey]: recordID \| recordID[] \| null \| [] }, data?: ordinaryAllowlistedData }` | Validate **all** attempted relation/ordinary fields against current effective restrictions before payload construction. Read the exact current source record; reject malformed unrelated relation entries, preserve unrelated relations, and synthesize the complete `qfei_relation`. |

Reject client raw `qfei_relation`, Lookup keys hidden in ordinary data, non-allowlisted fields, invalid cardinality, invisible targets and missing/mismatched identities. Existing-record violations reject the whole request and preserve the draft. Because Make relation items contain only `{ entityKey, id }`, multiple independently writable relations to the same target entity are ambiguous: fail closed unless a documented/tested backend contract disambiguates them.

## Refresh generation

Permission changes are refresh-based, but permission and permission-trimmed Schema must refresh together:

```text
nextAccess = await refreshPermissions()
invalidateSchemaCache()
nextSchema = await refreshSchema()
advanceAccessGeneration(nextAccess, nextSchema)
closeOrRecomputeOpenSurfaces()
refreshDataOnlyIfReadAllowed()
```

An equivalent query-cache/provider design is valid when it guarantees:

- Schema cache identity includes principal/tenant/App or an access generation;
- old permission, Schema, record, candidate, and form async results cannot overwrite the new generation;
- newly granted create/read fields appear on page refresh;
- revoked fields/actions disappear before mutation;
- submission is disabled during access refresh.

Treat `nextAccess` as a candidate until `nextSchema` succeeds. At refresh start, the previous authorization must no longer be usable for protected reads or writes. Publish the new permission and Schema atomically; never expose “new permission + old Schema”. If either refresh fails, remain fail-closed rather than restoring a possibly revoked old generation.

Fail closed when either permission or Schema refresh fails.

Before completion, run the [behavior and lifecycle checks](testing-and-audit.md); component visibility alone does not prove authorization.
