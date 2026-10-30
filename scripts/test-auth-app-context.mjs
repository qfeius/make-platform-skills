import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

async function example() {
  const guide = await readFile(new URL('../skills/make-app-auth/references/auth-app-context.md', import.meta.url), 'utf8')
    .catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  const code = guide.match(/<!-- executable-auth-proxy -->\s*```js\n([\s\S]*?)\n```/u)?.[1];
  assert.ok(code, 'the current auth reference must expose an executable shared-proxy example');
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

for (const route of [
  '/auth/current-context', '/auth/runtime-view', '/auth/app-administrators',
  '/auth/logout', '/auth/session/complete', '/auth/future-endpoint',
  '/oauth/challenge', '/oauth/token/exchange', '/oauth/future-callback',
]) {
  test(`one configured outer appKey for ${route}, with opaque OAuth values`, async () => {
    const { createAuthProxy, loadAuthAppConfig } = await example();
    let captured;
    const proxy = createAuthProxy({ config: loadAuthAppConfig({ MAKE_APP_KEY: ' configured-app ' }),
      gatewayOrigin: 'http://gateway.test', gatewayScope: '/make',
      fetchImpl: async (url, init) => { captured = { url: new URL(url), init }; return new Response('{}'); } });
    const query = new URLSearchParams([
      ['appKey', 'forged'], ['appKey', 'second'], ['state', 'opaque+state/='],
      ['code', 'opaque+code/='], ['login_ticket', 'opaque+ticket/='],
      ['return_url', 'https://customer.test/home?appKey=nested&value=a+b#fragment'],
      ['redirect_uri', 'https://gateway.test/callback?fixed=a+b'],
    ]);
    const response = await proxy(new Request(`https://customer.test/api/make${route}?${query}`, {
      headers: { host: 'customer.test', cookie: 'make_app_session=fixture', 'x-forwarded-host': 'forged.test' },
    }));
    assert.equal(response.status, 200);
    assert.equal(captured.url.pathname, `/make${route}`);
    assert.deepEqual(captured.url.searchParams.getAll('appKey'), ['configured-app']);
    for (const key of ['state', 'code', 'login_ticket', 'return_url', 'redirect_uri']) {
      assert.equal(captured.url.searchParams.get(key), query.get(key));
    }
    assert.equal(captured.init.headers.get('cookie'), 'make_app_session=fixture');
    assert.equal(captured.init.headers.get('x-forwarded-host'), 'customer.test');
    assert.equal(captured.init.headers.get('x-forwarded-proto'), 'https');
    assert.equal(captured.init.redirect, 'manual');
  });
}

test('the explicit local-preview scope remains public without rewriting nested URLs', async () => {
  const { createAuthProxy, loadAuthAppConfig } = await example();
  let url;
  const proxy = createAuthProxy({ config: loadAuthAppConfig({ MAKE_APP_KEY: 'preview-app' }),
    gatewayOrigin: 'https://public-gateway.test', gatewayScope: '/api/make',
    fetchImpl: async value => { url = new URL(value); return new Response('{}'); } });
  await proxy(new Request('http://localhost:3000/api/make/oauth/future-callback?state=opaque%2Bstate'));
  assert.equal(url.pathname, '/api/make/oauth/future-callback');
  assert.equal(url.searchParams.get('state'), 'opaque+state');
  assert.equal(url.searchParams.get('appKey'), 'preview-app');
});

for (const value of [undefined, '', '   ']) {
  test(`missing MAKE_APP_KEY fails during configuration (${JSON.stringify(value)})`, async () => {
    const { loadAuthAppConfig } = await example();
    assert.throws(() => loadAuthAppConfig({ MAKE_APP_KEY: value }), /MAKE_APP_KEY is required/);
  });
}

test('configuration is immutable and independent of later environment/browser selectors', async () => {
  const { createAuthProxy, loadAuthAppConfig } = await example();
  const env = { MAKE_APP_KEY: ' original ' };
  const config = loadAuthAppConfig(env);
  env.MAKE_APP_KEY = 'changed';
  assert.ok(Object.isFrozen(config));
  let captured;
  const proxy = createAuthProxy({ config, gatewayOrigin: 'http://gateway.test', gatewayScope: '/make',
    fetchImpl: async url => { captured = new URL(url); return new Response('{}'); } });
  await proxy(new Request('https://customer.test/api/make/auth/logout?appKey=forged'));
  assert.deepEqual(captured.searchParams.getAll('appKey'), ['original']);
});

test('unknown business and prefix-lookalike paths never become a broad proxy', async () => {
  const { createAuthProxy, loadAuthAppConfig } = await example();
  let calls = 0;
  const proxy = createAuthProxy({ config: loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' }),
    gatewayOrigin: 'http://gateway.test', gatewayScope: '/make',
    fetchImpl: async () => { calls++; return new Response('{}'); } });
  for (const path of ['/api/make/data/v1/record', '/api/make/authenticate', '/api/make/oauth-other']) {
    assert.equal((await proxy(new Request(`https://customer.test${path}`))).status, 404);
  }
  assert.equal(calls, 0);
});

test('session complete preserves 302, Location and all Set-Cookie values', async () => {
  const { createAuthProxy, loadAuthAppConfig } = await example();
  const location = 'https://customer.test/home?keep=a%2Bb';
  const cookies = ['make_app_session=fixture; HttpOnly; Path=/', 'make_csrf=second; Path=/'];
  const proxy = createAuthProxy({ config: loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' }),
    gatewayOrigin: 'http://gateway.test', gatewayScope: '/make',
    fetchImpl: async (_url, init) => {
      assert.equal(init.redirect, 'manual');
      return new Response(null, { status: 302, headers: [['location', location], ...cookies.map(value => ['set-cookie', value])] });
    } });
  const response = await proxy(new Request('https://customer.test/api/make/auth/session/complete?login_ticket=fixture'));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), location);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
});

test('native Node HTTP POST preserves body and Content-Type without buffering', async () => {
  const { createAuthProxy, loadAuthAppConfig } = await example();
  const body = JSON.stringify({ code: 'opaque+code', state: 'opaque/state', appKey: 'body-is-not-context' });
  let captured;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    captured = { body: Buffer.concat(chunks).toString(), contentType: request.headers['content-type'],
      url: new URL(request.url, 'http://gateway.test') };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const proxy = createAuthProxy({ config: loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' }),
      gatewayOrigin: `http://127.0.0.1:${server.address().port}`, gatewayScope: '/make' });
    const response = await proxy(new Request('https://customer.test/api/make/oauth/token/exchange', {
      method: 'POST', headers: { 'content-type': 'application/json', host: 'customer.test' }, body,
    }));
    await response.text();
    assert.equal(response.status, 200);
    assert.equal(captured.body, body);
    assert.equal(captured.contentType, 'application/json');
    assert.deepEqual(captured.url.searchParams.getAll('appKey'), ['configured-app']);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('no-query login bootstrap keeps return-context headers and cancellation', async () => {
  const { createAuthProxy, loadAuthAppConfig } = await example();
  const returnUrl = 'https://customer.test/objects/order?tab=mine';
  const request = new Request('https://customer.test/api/make/auth/current-context', {
    headers: { host: 'customer.test', referer: returnUrl, 'x-make-return-url': returnUrl,
      origin: 'https://customer.test', authorization: 'Bearer fixture' },
  });
  let captured;
  const proxy = createAuthProxy({ config: loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' }),
    gatewayOrigin: 'http://gateway.test', gatewayScope: '/make',
    fetchImpl: async (url, init) => { captured = { url: new URL(url), init }; return new Response('{}'); } });
  await proxy(request);
  assert.equal(captured.url.searchParams.get('appKey'), 'configured-app');
  assert.equal(captured.init.headers.get('referer'), returnUrl);
  assert.equal(captured.init.headers.get('x-make-return-url'), returnUrl);
  assert.equal(captured.init.headers.get('origin'), 'https://customer.test');
  assert.equal(captured.init.headers.get('authorization'), 'Bearer fixture');
  assert.equal(captured.init.signal, request.signal);
});

for (const scope of ['/make', '/api/make']) {
  for (const path of ['/auth/current-context', '/oauth/future-callback']) {
    test(`internal Service call decorates ${scope}${path} without the browser proxy`, async () => {
      const { withMakeAppContext, loadAuthAppConfig } = await example();
      assert.equal(typeof withMakeAppContext, 'function', 'all Service gateway calls need one shared URL decorator');
      const original = new URL(`https://gateway.test${scope}${path}?appKey=forged&appKey=second&state=opaque%2Bvalue`);
      const result = withMakeAppContext(original, loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' }));
      assert.deepEqual(result.searchParams.getAll('appKey'), ['configured-app']);
      assert.equal(result.searchParams.get('state'), 'opaque+value');
      assert.equal(result.pathname, original.pathname);
      assert.deepEqual(original.searchParams.getAll('appKey'), ['forged', 'second'], 'the URL decorator must not mutate caller state');
    });
  }
}

for (const scope of ['/make', '/api/make']) {
  for (const path of ['/meta/v1/schema', '/data/v1/record', '/app/ai/v1/chats', '/future/service']) {
    test(`business namespace ${scope}${path} receives the configured App context`, async () => {
      const { withMakeAppContext, loadAuthAppConfig } = await example();
      const original = new URL(`https://gateway.test${scope}${path}?appKey=forged&appKey=second&filter=opaque%2Bvalue`);
      const result = withMakeAppContext(original, loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' }));
      assert.deepEqual(result.searchParams.getAll('appKey'), ['configured-app']);
      assert.equal(result.searchParams.get('filter'), 'opaque+value');
      assert.equal(result.pathname, original.pathname);
      assert.deepEqual(original.searchParams.getAll('appKey'), ['forged', 'second']);
    });
  }
}

test('the shared decorator leaves non-Make and prefix-lookalike requests unchanged', async () => {
  const { withMakeAppContext, loadAuthAppConfig } = await example();
  assert.equal(typeof withMakeAppContext, 'function');
  const config = loadAuthAppConfig({ MAKE_APP_KEY: 'configured-app' });
  for (const path of ['/health', '/api/config', '/maker/data/v1/record', '/api/maker/auth', '/other/auth/current-context']) {
    const original = new URL(`https://gateway.test${path}?appKey=business-contract&state=opaque%2Bvalue`);
    assert.equal(withMakeAppContext(original, config).href, original.href);
  }
});

for (const mode of ['published', 'local-preview']) {
  test(`${mode} documentation calls inject App context for auth and business alike`, async () => {
    const { withMakeAppContext } = await example();
    const guide = await readFile(new URL('../skills/make-app-auth/references/service-fronted-mode.md', import.meta.url), 'utf8');
    const start = mode === 'published' ? 'const makeAuthBaseUrl =' : 'const publicGatewayOrigin =';
    const source = [...guide.matchAll(/```ts\n([\s\S]*?)\n```/gu)].map(match => match[1])
      .find(code => code.startsWith(start));
    assert.ok(source, `the ${mode} upstream example must remain executable`);
    const config = { appKey: 'configured-app' };
    const calls = [];
    const fetch = async (url, init) => { calls.push({ url: new URL(url), init }); return new Response('{}'); };
    const recordPayload = { appKey: config.appKey, entityKey: 'Record', fields: [], pagination: {} };
    const dependencies = mode === 'published'
      ? { config, withMakeAppContext, fetch, entityKey: 'Record', fields: [], pagination: {},
        authHeaders: new Headers(), businessHeaders: new Headers() }
      : { config, fetch, recordPayload, makecliTokenHeaders: {},
        readMakecliResolveJson: () => ({ make_api_origin: 'https://gateway.test' }),
        makeFetch: (url, init) => fetch(withMakeAppContext(url, config), init) };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(...Object.keys(dependencies), source)(...Object.values(dependencies));
    assert.equal(calls.length, 2);
    for (const call of calls) assert.deepEqual(call.url.searchParams.getAll('appKey'), [config.appKey]);
    assert.equal(calls.at(-1).init.body, JSON.stringify(recordPayload));
  });
}
