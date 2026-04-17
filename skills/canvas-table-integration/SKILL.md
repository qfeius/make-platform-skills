---
name: canvas-table-integration
description: Use when the user wants to integrate `@qfei/canvas-table` into an existing app or page, including basic local tables, paginated virtual tables, grouped tables, and meta-to-columns scenarios. Read the installed package AI docs first, choose the correct recipe, use only the public consumer-facing API, and verify the integration after editing.
version: 0.1.0
metadata:
  homepage: https://github.com/qfeius/make-platform-skills
---

# canvas-table-integration

Use this skill only for consumer-side integration of `@qfei/canvas-table`.

Typical requests:

- 在页面里接入 `@qfei/canvas-table`
- 把现有列表替换成 canvas table
- 接后端分页表格
- 接分组表格
- 把 JSON meta 转成 `IColumn[]`

Do not use this skill for:

- publishing `@qfei/canvas-table`
- editing the table library itself
- maintaining `package.ai.json`, `recipes.json`, or examples inside the library repo
- configuring private npm registries

## Pre-flight check

Before editing code:

1. Confirm `@qfei/canvas-table` is installed in the current project.
2. If it is not installed, stop and tell the user to install the package first.
3. Do not auto-install the dependency unless the user explicitly asks for that action.

## Required read order

Prefer reading from the installed package:

1. `node_modules/@qfei/canvas-table/package.ai.json`
2. `node_modules/@qfei/canvas-table/docs/agent-usage.md`
3. `node_modules/@qfei/canvas-table/recipes.json`
4. `node_modules/@qfei/canvas-table/capabilities.json`
5. `node_modules/@qfei/canvas-table/PUBLIC_API.md`

If the project is working directly inside the `@qfei/canvas-table` monorepo, use the source paths instead:

1. `packages/table/package.ai.json`
2. `packages/table/docs/agent-usage.md`
3. `packages/table/recipes.json`
4. `packages/table/capabilities.json`
5. `packages/table/PUBLIC_API.md`

If any required file is missing, stop and tell the user exactly which file is missing.

## Scenario mapping

Choose one primary path first:

- `basic local table`
  Use when the page already has all rows in client memory.

- `virtual remote table`
  Use when rows come from a paginated backend API or the dataset is too large to load at once.

- `group table`
  Use when users browse groups first, then expand into child groups or leaf rows.

- `meta -> columns`
  Use when column configuration comes from JSON/meta instead of handwritten `IColumn[]`.

If the page mixes patterns, pick the dominant path first, then add other behavior only if required by the page.

## Hard rules

Always follow these rules:

- browser / client-only; never instantiate during SSR
- use a real DOM container with explicit width and height
- use only documented public APIs
- never import from `src` or `dist`
- for normal tables, use `setData(rows)`
- when `virtualOptions.enabled === true`, listen to `data:load` and use `setData(rows, page)`
- for grouped tables, use `GroupTableComponent` and handle both `group:load` and `group:expand`
- never pass raw meta directly into the table runtime
- convert meta into `IColumn[]` before creating the table
- use `table.tableId` as the namespace key for `globalEventBus.onWithNamespace(...)`

## Implementation workflow

1. Check that the package is installed.
2. Read the package docs in the required order.
3. Identify the scenario that matches the current page.
4. Read the matching recipe in `recipes.json`.
5. Open the corresponding minimal example.
6. Adapt that example to the current project with the smallest reasonable diff.
7. Preserve the project's existing framework and state-management patterns.
8. Avoid unrelated refactors.
9. Run at least one concrete verification step if the environment allows it.

## Example priority

Use these example files as the preferred starting point:

- `examples/react/basic-canvas-table.tsx`
- `examples/react/virtual-canvas-table.tsx`
- `examples/react/group-canvas-table.tsx`
- `examples/react/meta-adapter-table.tsx`

If the local project is not React, still use them as behavioral references and adapt them to the local framework.

## Required output

After finishing, report:

- which scenario was selected
- which recipe was used
- which files were changed
- any important pagination, grouping, or meta-conversion constraints
- what was verified
- whether anything is still blocked by missing data or APIs
