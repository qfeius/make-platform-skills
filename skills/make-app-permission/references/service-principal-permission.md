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

Preserve the stable IAM response envelope and select/normalize App permission rows at the UI boundary. The following is a **raw legacy principal-profile example**, not a final v3 Decision; `creatable` belongs only to the retained ordinary-create profile:

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
      "fieldAccess": {}
    },
    {
      "permissionKey": "meta.field.read",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": {
        "create_only_field": "creatable",
        "visible_field": "readonly",
        "editable_field": "editable"
      }
    },
    {
      "permissionKey": "data.record.read",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": { "visible_field": "readonly", "editable_field": "editable" }
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

`permissionKey` holds a permission-point identifier such as `data.record.read`.
`fieldAccess` is a sibling property on that permission result, mapping field keys
to access-state strings or arrays. States such as `readonly` and `editable` are
property values; neither `fieldAccess` nor these states extend the permission key.

Read [design and protocol profiles](design-and-protocol-profiles.md) for the v3.0.0 (2026-08-04) source and the current raw-row compatibility boundary. Preserve this principal proxy; do not fabricate a Decision response or infer exact Statement grouping from a permission row.

- `meta.entity.read`: entity metadata navigation/route gate, bounded by Schema; no record operation grant.
- `meta.field.read`: Schema/header visibility and applicable field restrictions. Under the retained **legacy ordinary-create** profile only, its historical `creatable|readonly|editable|partialMask|fullMask|*` states select fields inside `createFields`.
- `meta.field.create`, `meta.field.update`, and `meta.field.delete`: field-definition permissions. They are not business-record write prerequisites; the cited design likewise does not require `data.field.update`.
- `data.record.read`: record request gate plus applicable field restrictions; never hide authorized metadata headers merely because rows are denied.
- `data.record.create`: create route/entry/handler/submit gate. This edit correction retains legacy create field selection from `meta.field.read`, instead of moving it into this operation row or narrowing states. Approval create still uses authorized Workflow start-config fields with the operation gate.
- `data.record.update`, `data.record.bulkUpdate`, `data.record.delete`: independent operation gates. Existing-record editing additionally uses effective field states from applicable metadata-read and record read/write rows, Schema, and editor capability. Never choose one operation row's editable state to defeat another applicable readonly/hidden/mask restriction.

For existing-record writes, conservatively merge baseline and named restrictions from raw rows without confirmed Statement provenance, including restrictive array entries. Any applicable readonly/hidden/mask rejects writing even alongside editable or compatibility `*`. Empty/omitted raw field restrictions add no restriction; they do not grant a missing operation or cancel a sibling restriction. Legacy create retains its prior range/union/named-field behavior separately. An authoritative v3 Decision's field map is already final; do not run raw-row inference over it.

The Service must reject the entire update/bulk mutation if any attempted field is restricted or unauthorized, retaining the user's draft and never silently trimming the change into a success. Backend row conditions and final authorization remain authoritative; the design's final `readonlyFields` contract must not be invented on a raw principal response.

Do not make the UI readiness transition depend on every row returned by IAM. Apply the deterministic selection table in `permission-boundaries.md` before strict row validation: only clearly unrelated rows may be ignored, while selected and unclassifiable rows fail closed. Ignored rows must never grant or deny App access or block the subsequent Schema request. Keep the Service request App-scoped; local response selection is not a reason to add a tenant-root scope or upstream platform permission filter.

For selected current-App business rows, keep an omitted/empty `fieldAccess` distinct from malformed IAM data. An omitted property or empty object adds no restriction from that row and does not cancel sibling restrictions; explicit `null`, a non-object, an array, a blank field key, an empty state list, an unknown state, or a state list containing non-strings is invalid and must fail the whole access snapshot closed at the Service validation or UI normalization boundary. Do not silently discard a malformed selected row while keeping sibling allows. Also reject a selected row with an invalid effect, non-three-part permissionKey, arbitrary namespace, or wildcard tenant/App resource instead of guessing intent. Null/primitive payloads or rows and non-array `permissions` must produce a denied snapshot without throwing.

The Service preserves resources such as `make://<tenantId>/*/app/<appKey>`; UI segment matching treats that namespace wildcard as the same current App family represented by response scope.

## Failure behavior

When IAM returns a response, return its status, Content-Type, and body unchanged so the UI receives the real backend result, including its error code and message. UI must still fail closed: clear protected access, avoid protected reads/mutations, invalidate permission-dependent Schema, and render a visible retry/error/forbidden state from that real response. Only a transport failure with no IAM response may use a documented Service-generated error.
