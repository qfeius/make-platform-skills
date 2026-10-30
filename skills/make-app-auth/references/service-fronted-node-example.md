# Service-fronted Node example

Use this compact example after reading `service-fronted-mode.md`. It illustrates
the route ownership and test seams; it is not a project template and must not
replace the host's established Service layering.

## Reference shape

```text
apps/ui/src/auth.ts                 # unified-login SDK bootstrap
apps/ui/src/makeApi.ts              # auth.api calls to /app/**
apps/service/src/routes.ts          # narrow browser-route dispatcher
apps/service/src/makeGatewayProxy.ts # auth/business proxy adapter
apps/service/src/makecliPreview.ts  # local-preview adapter only
```

Keep all browser business calls behind `auth.api` and the Service-owned
`/api/make/app/**` namespace. `requestWithTrace` is the App-owned shared adapter
from `request-adapter.md`, not an auth SDK export; it creates the request Trace
headers before calling `auth.api`:

```ts
export const auth = createMakeAppAuth({
  gatewayBaseUrl: '/api/make',
  unifiedLogin: true,
  apiAuthRedirect: true,
});

export const loadSchema = () => requestWithTrace((traceHeaders) =>
  auth.api.get('/app/schema', {
    credentials: 'include',
    headers: traceHeaders,
  }));

export const listRecords = (entityKey: string, payload: unknown) =>
  requestWithTrace((traceHeaders) =>
    auth.api.post(`/app/records/${entityKey}`, payload, {
      credentials: 'include',
      headers: { 'X-Make-Target': 'MakeService.ListResources', ...traceHeaders },
    }));
```

## Route ownership

- `/api/make/auth/**` and `/api/make/oauth/**` forward to the published
  make-gateway auth namespace. Preserve the upstream status, `Set-Cookie`, and
  `Location`; use manual redirect handling.
  The shared proxy injects one configured outer query `appKey` as described and
  tested in `auth-app-context.md`; do not rewrite OAuth values or request bodies.
  Reuse that URL decorator in all business adapters and internal Service Make
  calls too; internal callers do not pass through the browser route dispatcher.
- `/api/make/app/**` contains explicitly registered Service business routes.
  Do not create a broad `/api/make/**` passthrough; unmatched paths fail closed.
- `MAKE_APP_LOCAL_PREVIEW=true` may provide only the documented local preview
  handlers. Its makecli token and resolved gateway origin stay inside Service.
  When the flag is absent, `current-context` and `runtime-view` continue through
  the published auth proxy.

For every upstream request, forward the browser Cookie and derive
`X-Forwarded-Host` from inbound `Host`; add `X-Forwarded-Proto`. Do not trust a
client-provided forwarded-host header.

## Required tests

- Published `session/complete` returns the upstream `302`, `Set-Cookie`, and
  `Location` unchanged.
- Local-preview paths use `makecli configure resolve` and server-side credentials
  only; published paths use the internal `/make/**` scope.
- Query strings do not bypass the local-preview path guard.
- Forged/duplicate appKey values cannot override `MAKE_APP_KEY`; GET and native
  Node HTTP POST keep all other OAuth values, body bytes and Content-Type.
- An unbound/empty login appId still reaches IAM using configured appKey; a
  non-empty conflicting appId fails closed, and IAM denial is never bypassed.
- Unknown `/api/make/**` routes return a closed failure response.

Read `service-fronted-mode.md` for the full local-preview matrix, proxy rules,
attachment handling, and validation checklist.
