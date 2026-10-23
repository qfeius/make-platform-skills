# Service principal permission

Use this reference for proxy transport and identity. Authorization semantics belong to [permission boundaries](permission-boundaries.md).

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

Treat this as the upstream raw principal shape. `permissionKey` and `fieldAccess` are sibling properties; never rename them, fabricate Decision fields or merge response rows in the proxy. Preserve canonical and namespace-alias resource strings unchanged. At the consumer boundary, use the [permission boundaries](permission-boundaries.md) row-selection, validation and profile rules before loading protected Schema/data. The proxy does not implement a second authorization algorithm.

## Failure behavior

When IAM returns a response, return its status, Content-Type, and body unchanged so the UI receives the real backend result, including its error code and message. UI must still fail closed: clear protected access, avoid protected reads/mutations, invalidate permission-dependent Schema, and render a visible retry/error/forbidden state from that real response. Only a transport failure with no IAM response may use a documented Service-generated error.
