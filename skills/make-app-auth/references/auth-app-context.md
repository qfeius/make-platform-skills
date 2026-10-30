# Service Make App Context

Every frontend-driven Make request receives the configured App context at the Service-to-Gateway boundary, including auth/oauth and business calls. Internal Service calls use the same rule. This parameter does not change authentication, permission or OAuth recipient trust. Keep the host's existing layers and forwarding helper rather than generating a second proxy implementation.

## One injection point

- Load and trim `MAKE_APP_KEY` once in the Service config entry. Missing or blank values stop startup with a non-secret configuration error. Do not fall back to browser input, a hostname or a production default.
- Apply one shared URL decorator in the Service gateway client to every Make request: browser auth/oauth proxies, explicit business adapters and internal calls all set exactly one outer query `appKey` from `config.appKey`. Do not limit injection to auth/oauth or only to browser route handlers. Use `URLSearchParams.set` for GET/POST alike and overwrite browser values, including duplicates.
- The browser SDK does not read deployment configuration or need a new appKey argument. Do not parse or rewrite the request body: a same-named body/header field must not override the outer App context in receiving endpoints.
- Preserve the decoded values of `code`, `state`, `login_ticket`, `return_url`, `redirect_uri` and every other query parameter. Encoding may normalize; never recurse into nested URLs or add appKey to the fixed Org callback URI.
- Preserve request method, body, Content-Type, login Cookie, established bearer context, return-context headers and trusted forwarded host/proto, plus response status, Location and every Set-Cookie. Forward the request AbortSignal. Keep `redirect: 'manual'`. Native Node Fetch requires `duplex: 'half'` when forwarding a body stream; do not buffer the body to avoid that requirement.
- Keep namespace boundaries and existing preview guards. This does not authorize a broad `/api/make/**` passthrough or changes to business payloads. Locally answered preview routes have no upstream request to decorate.
- Keep existing route validation and configured business-body appKey generation unchanged. A protocol's required selector-equality checks still run before URL decoration; injection is not a reason to skip them. Do not assume query/body binding precedence. Health/config responses, static resources and non-Make upstream calls are outside this Gateway parameter contract.

## Executable proxy seam

The following Fetch-style seam is exercised by `scripts/test-auth-app-context.mjs`. Adapt it inside the host's shared proxy and central config, not as a replacement Service project. The HTTP adapter owns serialization of the returned Response, including all Set-Cookie values. Reuse the host's established forwarding-header helper for auth and business calls; the compact helper below illustrates its trusted Host boundary.

Call `loadAuthAppConfig` at Service startup. Pass an explicit scope: published uses a strict internal gateway origin plus `/make`; local-preview forwarding uses its resolved public origin plus `/api/make`. Do not infer the runtime mode from a hostname.

<!-- executable-auth-proxy -->
```js
export function loadAuthAppConfig(env) {
  const appKey = env.MAKE_APP_KEY?.trim();
  if (!appKey) throw new Error('MAKE_APP_KEY is required');
  return Object.freeze({ appKey });
}

export function withMakeAppContext(input, config) {
  const url = new URL(input);
  if (/^\/(?:api\/)?make(?:\/|$)/u.test(url.pathname)) {
    url.searchParams.set('appKey', config.appKey);
  }
  return url;
}

export function createAuthProxy({ config, gatewayOrigin, gatewayScope, fetchImpl = globalThis.fetch }) {
  const origin = new URL(gatewayOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('gatewayOrigin must be a bare HTTP(S) origin');
  }
  if (!['/make', '/api/make'].includes(gatewayScope)) throw new Error('Invalid gateway scope');
  return async function proxyAuth(request) {
    const incoming = new URL(request.url);
    if (!/^\/api\/make\/(?:auth|oauth)(?:\/|$)/u.test(incoming.pathname)) {
      return new Response(null, { status: 404 });
    }
    const routeUrl = new URL(gatewayScope + incoming.pathname.slice('/api/make'.length), origin);
    routeUrl.search = incoming.search;
    const upstreamUrl = withMakeAppContext(routeUrl, config);

    const headers = new Headers();
    for (const name of ['cookie', 'authorization', 'content-type', 'accept', 'user-agent', 'origin', 'referer',
      'x-make-return-url', 'traceparent', 'x-log-id']) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const host = request.headers.get('host') || incoming.host;
    headers.set('x-forwarded-host', host);
    headers.set('x-forwarded-proto', /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u.test(host) ? 'http' : 'https');

    return fetchImpl(upstreamUrl, {
      method: request.method,
      headers,
      body: request.body,
      ...(request.body ? { duplex: 'half' } : {}),
      signal: request.signal,
      redirect: 'manual',
    });
  };
}
```

In the existing shared Make client, apply the same `withMakeAppContext` after constructing the URL from the trusted gateway origin and explicit mode scope, before every normal fetch. Reuse it in auth proxies, business adapters and internal callers. Keep the client's Cookie, trusted host/proto, AbortSignal and response handling. The decorator clones the URL and changes only the outer appKey; it is not an SDK export, transport, route registration or new broad proxy. The auth proxy above deliberately remains auth-only; business routes keep their existing explicit handlers.

## Identity and OAuth boundaries

App context is not a credential. A consuming endpoint validates resources within the verified tenant and keeps IAM enforcement; it must not substitute query `appKey` for verified user/tenant/userType. Identity-only endpoints may ignore the parameter. Direct-gateway and Console requests do not automatically pass through an App Service, so do not make this parameter mandatory for their identity checks.

The current-context response retains the historical field name `appId`, filled from the Service-injected `appKey` as App context, not proof of App ownership or permission. Missing/null/blank appId from an older identity response must not block an already authenticated user: use configured `MAKE_APP_KEY` for the business IAM scope. Reject a non-empty conflicting App or a malformed non-string App value, following `service-fronted-mode.md#current-context-consumption`. Keep the existing `env`, `roles`, `permissions` and `grantVersion` response mapping and compatibility rules unchanged; this migration does not clear or remove those fields.

Org's fixed Gateway callback bypasses the App Service. If a backend consumes appKey during login, validate/bind it when creating the challenge and recover it from server-side transaction/ticket state later. Do not require Org to add it, change redirect_uri during token exchange, or select a different App from a later query parameter.

The receiving endpoint decides whether to consume appKey. Adding the parameter does not move an endpoint, remove existing backend checks or prove deployment. Updating this Skill does not update already generated/deployed Services or install these changes into another Skill copy.

For an existing App iteration, inspect both UI startup and Service identity consumers. Make the smallest adjustment needed for optional App context and shared injection; do not rewrite working OAuth, force an unrelated SDK/runtime migration, fabricate an appId in the authenticated identity, or skip IAM. Retain session and business-denial handling and test that unbound context still receives the actual IAM denial.

## Verification

Run behavior tests against the shared gateway client for auth/oauth, business and future Make paths, including internal calls. Cover no query, existing query, duplicate/forged appKey, GET/POST body and Content-Type, opaque nested URLs and OAuth values, 302/Location/multiple Cookie preservation, missing/blank startup config, explicit published/preview scopes, non-Make calls unchanged and no broad proxy expansion. Include one real Node HTTP POST, not only a mocked fetch, plus absent/empty App context reaching IAM and non-empty conflicts stopping before it.

The audit's `auth_app_key_context_not_obvious` warning only detects an obvious `searchParams.set('appKey', ...)`; it cannot prove the value's source, route coverage or runtime behavior. Resolve it with source tracing and tests, not comments. Verify a deployed Service separately before claiming live login readiness.
