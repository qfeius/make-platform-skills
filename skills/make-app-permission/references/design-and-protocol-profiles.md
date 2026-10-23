# Permission design and protocol profiles

## Sources and scope

The existing-record edit guidance follows [PermissionDesign.md](https://git.qtech.cn/make/AgenticDSL/-/blob/4afc22a4a2797b86d6174121014f23bee8bb587d/Design/PermissionDesign.md), **v3.0.0, 2026-08-04**, especially “FieldCondition”, “字段级 / 行级合并语义” and “字段策略后处理”. The supplied [incident report](https://ysi13ckdb9.feishu.cn/docx/A0ZNdm5vFoNHrdxcwdPc5NYsn7d), revision 12 (2026-10-23), documents the current principal-response compatibility boundary. The commit pins the design actually read; future changes require their own verified profile.

The incident report describes separate application verification. Its online evidence is background, not validation of this Skill PR, other applications, production, or all platform versions. Report checker fixtures, real host adapters, backend checks and browser saves separately. Do not change roles, add administrator permission, or invent field-update permissions to make a test pass.

## v3 Decision / Plan semantics

- Record operation gates and field access are separate layers. Explicit deny wins; no record allow means denied. Field defaults never bypass the gate, entity/Schema bounds, record scope or backend checks.
- Field states are exactly `hidden`, `fullMask`, `partialMask`, `readonly`, `editable`. Within an allowed record scope the default is `editable`; v3 does **not** define `creatable` or access state `*`.
- Within one Statement, its named field replaces that Statement's `*` baseline. Across Statements, take the strictest effective state: `hidden > fullMask > partialMask > readonly > editable`.
- Final Decision/Plan `fieldAccess` maps each field to one effective state; `readonlyFields` includes every non-editable field. Update/bulkUpdate submissions hitting a restricted field are rejected as a whole (the design specifies 422), never silently trimmed and reported successful.
- The design's no-update downgrade and read/update field aggregation describe authoritative Decision evaluation. They do not authorize a client to infer a new `data.field.update` gate or collapse independent update/delete/bulkUpdate operations.

## Current raw principal-response compatibility

This Skill keeps the existing App-scoped `/principal/permission` proxy. It does not migrate the host to `/decision` or `/decision/plan`, invent those response fields on a raw row, or claim complete v3 evaluation in the browser.

Current `permissions` rows may contain scalar or array `fieldAccess` states, use `*` as a compatibility unrestricted state, and omit Statement identity/grouping. Treat them as raw authorization inputs, not final Decision output.

For existing-record editing:

1. Check the requested operation gate (`data.record.update` or `data.record.bulkUpdate`) independently. Missing/denied single update must not close an independently allowed bulk operation, or the reverse; delete is independent as well.
2. Require metadata-visible, business-readable Schema fields and a supported editor. Collect applicable field restrictions from `meta.field.read` and record read/write allow rows, including `data.record.read`, `data.record.update`, and `data.record.bulkUpdate`. Absence of another operation's allow is not a new gate; its field restrictions, when present and applicable, still cannot be bypassed by choosing a different operation row.
3. Apply named-over-baseline only when Statement provenance/grouping or authoritative pre-expanded states are confirmed. One raw row may itself combine multiple Statements: without that provenance, retain restrictions from both its baseline and named entry. Never use a named `editable` in the same or another raw row to erase a `readonly`/mask/hidden baseline. Do not discard a broader applicable restriction merely because a more-specific allow exists. Since raw rows may have lost Statement grouping, conservatively merge all applicable restrictions, accepting possible false denials instead of widening access; do not claim this reconstructs the exact final v3 Decision. A confirmed final Decision map is already resolved and must not be reinterpreted as raw principal rows.
4. A `readonly`, `hidden`, `partialMask`, or `fullMask` anywhere in the applicable effective states denies writing, even alongside `editable` or compatibility `*`. Empty/omitted field restrictions contribute no restriction; if all applicable raw rows have no restrictions, fields already within the visible/readable Schema and editor bounds default writable under the allowed requested operation. Do not require a named editable entry or a separate field-permission allow as an additional write gate. These defaults never create a missing operation grant. Malformed selected inputs still fail the access snapshot closed. A legacy `creatable` alone is not an existing-record write grant.
5. Recheck the current operation and effective restrictions before submit and at the Service boundary. Any submitted restricted, stale, unknown or unauthorized field rejects the **whole** mutation. Preserve the draft and selection, display the error, and do not report partial success or automatically replay on permission restoration. Construct ordinary payloads from rendered fields, but never silently remove a field the user tried to write to hide a permission failure.

## Legacy ordinary-create profile retained

This edit correction does not establish a new same-environment create contract. Retain the repository's existing ordinary-create profile: the `data.record.create` gate is independent; fields come from `createFields` intersected with fields allowed by the matched `meta.field.read` result using the historical create-state set `creatable|readonly|editable|partialMask|fullMask|*`. This is a **legacy compatibility profile**, not v3 field-state semantics and not a grant to create field definitions.

Missing `createFields` remains empty, Schema and host capability bounds remain, and create-only invisible fields remain create-only. Keep this profile's existing resource-specificity, same-level allow-union and named-field behavior separate from conservative existing-record write restriction merging. Do not migrate create fields to the create-operation row, tighten its states, or infer new create rules from this edit fix without an independently verified target-environment contract.

Approval create remains a separate branch: authorized Workflow start-config fields replace the ordinary field intersection while App/entity/create-operation qualification and target-read/capability checks remain. A failed approval config never falls back to ordinary fields.
