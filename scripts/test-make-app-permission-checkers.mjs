#!/usr/bin/env node
// Exercise permission checkers through the existing CI test discovery.
await import('../skills/make-app-permission/scripts/test-audit-make-app-permission.mjs');
await import('../skills/make-app-permission/scripts/test-permission-conformance-suite.mjs');
