---
name: make-app-permission
description: "Implement or review Make App 单应用权限: IAM principal permissions, entity/route/action guards, 字段可新建、可见、可编辑, createFields, and permission refresh. Does not own login, UI layout, platform administration, DSL, or deployment."
metadata:
  version: 0.3.5
---

# Make App permissions

This skill must be enabled by default for every generated or refactored Make App. It owns permission decisions and their enforcement at Service, route, form and mutation boundaries.

## Working approach

Inspect the host's API contract, permission helpers and affected consumers before changing them. Read [permission boundaries](references/permission-boundaries.md) when changing authorization; use the task map below for integration details. Load only the references needed for the task.

Write regression tests for the affected behavior first. Reuse existing production helpers through thin adapters rather than adding parallel permission logic or mandatory export names.

## Core invariants

- Request principal permissions through the App-scoped Service proxy. Preserve completed upstream responses; keep metadata navigation, table headers and record-data access independent.
- A business write needs its requested record-operation permission, effective field access, Schema membership and editor capability. Keep update, delete and bulkUpdate independent. Field-definition write permissions grant no business-value edits; field counts do not grant or revoke an operation.
- Interpret raw principal rows with the supported compatibility rules in the boundary reference. Preserve applicable restrictions; raw rows are not final Decision output. `fieldAccess` is a result property, not a permission point. Invalid selected inputs fail closed.
- Ordinary create uses the legacy `createFields` contract. Approval create uses authorized Workflow start-config fields through [make-app-approval](../make-app-approval/SKILL.md). Preserve each mode's field source, system-field exclusions and create-only fields.
- Recheck current authorization before reads and mutations. Reject an entire existing-record write containing a restricted or unauthorized attempted field; retain the draft. Do not silently trim it into a success.
- Refresh permissions and permission-trimmed Schema as one access generation. Prevent stale data or asynchronous results from surviving revocation. Keep safe structured failures visible through the shared error outlet.

## Task map

| Task | Resource |
| --- | --- |
| Permission keys, resources, field states, raw/Decision boundary, ordinary-create compatibility | [Permission boundaries](references/permission-boundaries.md) |
| Principal proxy, IAM request, identity forwarding and response example | [Service principal permission](references/service-principal-permission.md) |
| Providers, navigation, forms, payloads, File/Lookup and refresh | [UI permission runtime](references/ui-permission-runtime.md) |
| Exact ID/audit capability rules | [System fields](references/system-field-contract.md) |
| Host tests, adapters, CI gates; Skill maintainer install/release checks | [Testing and audit](references/testing-and-audit.md) |
| Selection, row precheck and batch actions | Use [make-app-actions](../make-app-actions/SKILL.md) |
| Login/session or Schema/API transport | Use [make-app-auth](../make-app-auth/SKILL.md) or [make-app-service](../make-app-service/SKILL.md) |
| Form presentation or request-error cards | Use [makeui](../makeui/SKILL.md) or [make-app-observability](../make-app-observability/SKILL.md) |

## Validation

Run affected host tests and both permission checks against the host's production helpers:

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <host-adapter-module>
```

The audit is heuristic; investigate findings and use runtime tests to verify behavior. The conformance adapter delegates to production code. Report actual pass/skip counts and distinguish checker self-tests from host and backend/browser acceptance. Adapter capabilities, required flags and portable gate setup are in [testing and audit](references/testing-and-audit.md).
