# Service principal permission

Use this reference for the current principal permission Service route and IAM response interpretation.

## Contents

- UI-Service endpoint
- IAM request
- Identity and forwarding
- Response and field access
- Failure behavior

## UI-Service endpoint

Expose for Service-fronted Apps:

```text
GET /api/make/app/principal/permission
```

Call it through the host auth/API adapter, usually `auth.api.get("/app/principal/permission")`. Do not call IAM directly from UI. Keep a legacy `/api/principal/permission` route only when the deployed host contract requires it.

Keep the Service route thin: log safe entry context, derive request context, and call the IAM adapter. This is a direct Make proxy: when the IAM request completes, preserve the upstream HTTP status, response body, and Content-Type unchanged for every status, including 2xx, 4xx, and 5xx. Do not map an IAM failure to a Service error envelope, replacement status, or generic message such as `Make request failed (403)`.

## IAM request

Call Make IAM through the gateway:

```text
POST <gateway-origin>/api/make/iam/v1/principal/permission
X-Make-Target: MakeService.GetResource
Content-Type: application/json
Accept: application/json
```

Default body:

```json
{
  "scope": "make://<tenantId>/meta/app/<appKey>"
}
```

Do not add a tenant-root scope or platform permission filter. Only add a safe `permissionKey in [...]` expression for an explicitly requested diagnostic/constrained query.

Published IAM uses `/api/make/iam/**`; do not rewrite it to `/make/iam/**`. Other published Service-to-gateway Meta/Data/Auth paths may use `/make/**`, while local preview uses the host public `/api/make/**` contract.

## Identity and forwarding

Resolve `appKey` from trusted runtime config such as `MAKE_APP_KEY`, never from browser input.

Resolve `tenantId` from trusted config, trusted request context, or an authenticated current-context request using the same login context. Parse known tenant/org fields or a trusted Make scope.

Forward the established login context:

- Cookie for cookie sessions;
- Authorization only when the host already uses bearer auth;
- `X-Make-Target: MakeService.GetResource`;
- trusted tenant/operator headers when available;
- derived `X-Forwarded-Host` and host-correct `X-Forwarded-Proto`.

Never log Cookie, Authorization, token, API key, or full signed URL values.

## Response and field access

Preserve the stable IAM response envelope and select/normalize App permission rows at the UI boundary. A representative response is:

```json
{
  "principal": "user:<principalId>",
  "scope": "make://<tenantId>/meta/app/<appKey>",
  "permissions": [
    {
      "permissionKey": "meta.entity.read",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": {}
    },
    {
      "permissionKey": "data.record.create",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": { "create_only_field": "creatable" }
    },
    {
      "permissionKey": "meta.field.read",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": {
        "visible_field": "readonly",
        "editable_field": "readonly"
      }
    },
    {
      "permissionKey": "data.record.read",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": { "visible_field": "readonly", "editable_field": "readonly" }
    },
    {
      "permissionKey": "data.record.update",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": {
        "editable_field": "editable"
      }
    }
  ]
}
```

Consume `fieldAccess` by permission dimension:

- `meta.entity.read`: entity metadata permission only; use it to include a Schema-present entity in navigation and allow its object route. It does not grant field visibility or record values.
- `meta.field.read`: field-definition/Schema/table-header visibility only. It never grants record values or business writes.
- `meta.field.create/update/delete`: existing field-metadata permissions for creating/updating/deleting field definitions. They do not authorize new records or record-field value changes; ordinary App data helpers need not consume them.
- `data.record.read`: authorize list/detail/pagination operations and apply its `fieldAccess` readable states to business values inside the metadata-visible Schema field set. Preserve masked states. It must not remove metadata-authorized headers when record access is denied.
- `data.record.create`: authorize create route/entry/handler/submit and intersect its `fieldAccess(creatable|*)` with `createFields` for ordinary create. Approval create uses Workflow start-config field authorization instead, retaining its operation gate.
- `data.record.update`: single-edit operation and `fieldAccess(editable|*)` for already-readable business-value fields.
- `data.record.bulkUpdate`: independent batch-edit operation and its own `fieldAccess(editable|*)`; never borrow `data.record.update` field authorization.
- Operation and field evaluation share the matching record permission decision, but remain separate checks: an operation allow cannot bypass a named field restriction or the relevant Schema upper bound.

In this App-scoped principal snapshot, an allow row with empty `fieldAccess` is unrestricted for that permissionKey at its resolved resource specificity. A matching deny wins. Named field entries override a wildcard field baseline. This principal-snapshot convention does not imply that an empty final Data API write decision allows submitted fields; the backend remains the final authority.

Do not make the UI readiness transition depend on every row returned by IAM. Apply the deterministic selection table in `permission-boundaries.md` before strict row validation: only clearly unrelated rows may be ignored, while selected and unclassifiable rows fail closed. Ignored rows must never grant or deny App access or block the subsequent Schema request. Keep the Service request App-scoped; local response selection is not a reason to add a tenant-root scope or upstream platform permission filter.

For selected current-App business rows, keep an omitted/empty `fieldAccess` distinct from malformed IAM data. An omitted property or empty object is unrestricted; explicit `null`, a non-object, an array, a blank field key, an empty state list, an unknown state, or a state list containing non-strings is invalid and must fail the whole access snapshot closed at the Service validation or UI normalization boundary. Do not silently discard a malformed selected row while keeping sibling allows. Also reject a selected row with an invalid effect, non-three-part permissionKey, arbitrary namespace, or wildcard tenant/App resource instead of guessing intent. Null/primitive payloads or rows and non-array `permissions` must produce a denied snapshot without throwing.

The Service preserves resources such as `make://<tenantId>/*/app/<appKey>`; UI segment matching treats that namespace wildcard as the same current App family represented by response scope.

## Failure behavior

When IAM returns a response, return its status, Content-Type, and body unchanged so the UI receives the real backend result, including its error code and message. UI must still fail closed: clear protected access, avoid protected reads/mutations, invalidate permission-dependent Schema, and render a visible retry/error/forbidden state from that real response. Only a transport failure with no IAM response may use a documented Service-generated error.
