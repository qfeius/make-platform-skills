#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suiteScript = path.join(scriptDir, 'permission-conformance-suite.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-app-permission-conformance-'));
let suiteRunCount = 0;

try {
  const permissiveAdapter = writeAdapter('permissive.mjs', `
    export const normalizeAccess = (payload) => payload;
    export const canUseEntityOperation = () => true;
    export const canCreateEntityField = () => true;
    export const canReadEntityFieldMetadata = () => true;
    export const canReadEntityField = () => true;
    export const canUpdateEntityField = () => true;
    export const canBulkUpdateEntityField = () => true;
    export const isCreateCapableField = () => true;
    export const isEditCapableField = () => true;
  `);
  const permissiveResult = runSuite(permissiveAdapter);
  assert.notEqual(permissiveResult.status, 0);
  assert.match(permissiveResult.output, /named_entity_permission_does_not_leak/);

  const correctAdapterSource = `
    const APP = 'make://tenant-1/meta/app/TestApp';
    const knownFieldAccess = new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask', 'hidden']);
    const wildcardKeyMatches = (actual, expected) => {
      if (actual === expected || actual === '*.*.*') return true;
      if (actual === 'data.record.*' && expected.startsWith('data.record.')) return true;
      const left = actual.split('.');
      const right = expected.split('.');
      return left.length === 3 && right.length === 3 && left.every((part, index) => part === '*' || part === right[index]);
    };
    const resourceMatches = (actual, expected) => {
      if (actual === '*' || actual === expected || expected.startsWith(actual + '/')) return true;
      if (!/^make:\\/\\/[^/*]+\\/(?:meta|\\*)\\/app\\/[^/*]+(?:\\/entity\\/(?:[^/*]+|\\*))?$/.test(actual)) return false;
      const left = actual.split('/');
      const right = expected.split('/');
      return left.length <= right.length && left.every((part, index) => part === '*' || part === right[index]);
    };
    const score = (resource) => {
      if (resource === '*') return 0;
      const segments = resource.split('/');
      const entityIndex = segments.indexOf('entity');
      if (entityIndex >= 0) return segments[entityIndex + 1] === '*' ? 3 : 4;
      return segments.includes('app') ? 2 : 1;
    };
    const entityResource = (access, entityKey) => access.appResource + '/entity/' + entityKey;
    const requestedIdentifier = (value) => String(value ?? '').trim();
    const isValidRequestedIdentifier = (value) => {
      if (typeof value !== 'string') return false;
      const normalized = requestedIdentifier(value);
      return Boolean(normalized) && normalized !== '*';
    };
    const matches = (access, entityKey, permissionKey) => {
      if (!isValidRequestedIdentifier(entityKey)) return [];
      return access.permissions
        .filter((item) => wildcardKeyMatches(item.permissionKey, permissionKey))
        .filter((item) => resourceMatches(item.resource, entityResource(access, requestedIdentifier(entityKey))));
    };
    const fieldAllowed = (access, entityKey, fieldKey, permissionKey, allowedStates) => {
      if (!isValidRequestedIdentifier(fieldKey)) return false;
      fieldKey = requestedIdentifier(fieldKey);
      const matched = matches(access, entityKey, permissionKey);
      if (matched.some((item) => item.effect === 'deny')) return false;
      const allows = matched.filter((item) => item.effect === 'allow');
      const maxScore = Math.max(...allows.map((item) => score(item.resource)), -1);
      const ranges = allows.filter((item) => score(item.resource) === maxScore);
      const namedStates = ranges
        .filter((item) => Object.hasOwn(item.fieldAccess, fieldKey))
        .map((item) => item.fieldAccess[fieldKey]);
      const states = namedStates.length > 0
        ? namedStates
        : ranges.some((item) => Object.keys(item.fieldAccess).length === 0)
          ? ['*']
          : ranges.filter((item) => Object.hasOwn(item.fieldAccess, '*')).map((item) => item.fieldAccess['*']);
      const flattenedStates = states.flatMap((state) => Array.isArray(state) ? state : [state]);
      if (flattenedStates.includes('hidden')) return false;
      return flattenedStates.some((state) => allowedStates.has(state ?? ''));
    };
    export const normalizeAccess = (payload) => {
      const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
      const scope = String(source?.scope ?? '');
      const inputPermissions = source?.permissions;
      const appResourceMatches = !Object.hasOwn(source ?? {}, 'appResource') || String(source.appResource ?? '') === scope;
      const validScope = /^make:\\/\\/[^/*]+\\/meta\\/app\\/[^/*]+$/.test(scope);
      const supportedBusinessPermissionKeys = [
          'data.record.read',
          'data.record.create',
          'data.record.update',
          'data.record.bulkUpdate',
          'data.record.delete',
          'meta.entity.read',
          'meta.field.read',
      ];
      const classifyResource = (value) => {
        if (value === '*') return 'current-app';
        if (typeof value !== 'string') return 'unclassifiable';
        if (/^make:\\/\\/[^/*]+$/.test(value)) return 'unrelated';
        const scopeParts = /^make:\\/\\/([^/*]+)\\/meta\\/app\\/([^/*]+)$/.exec(scope);
        const resourceParts = /^make:\\/\\/([^/*]+)\\/(?:meta|\\*)\\/app\\/([^/*]+)(?:\\/entity\\/(?:[^/*]+|\\*))?$/.exec(value);
        if (!scopeParts || !resourceParts) return 'unclassifiable';
        return scopeParts[1] === resourceParts[1] && scopeParts[2] === resourceParts[2]
          ? 'current-app'
          : 'unrelated';
      };
      const validPermissionKey = (value) => /^(?:[A-Za-z][\\w-]*|\\*)(?:\\.(?:[A-Za-z][\\w-]*|\\*)){2}$/.test(String(value ?? ''));
      const isPotentialBusinessPermissionKey = (value) => {
        if (typeof value !== 'string') return true;
        return supportedBusinessPermissionKeys.some((expected) => wildcardKeyMatches(value, expected))
          || (/^(?:data\\.record|meta\\.(?:entity|field))(?:\\.|$)/.test(value) && !validPermissionKey(value));
      };
      const shouldSelectRow = (item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
        const resourceClassification = classifyResource(item.resource);
        if (resourceClassification === 'unrelated') return false;
        if (resourceClassification === 'unclassifiable') return true;
        return isPotentialBusinessPermissionKey(item.permissionKey);
      };
      const validResource = (value) => value === '*' || /^make:\\/\\/[^/*]+\\/(?:meta|\\*)\\/app\\/[^/*]+(?:\\/entity\\/(?:[^/*]+|\\*))?$/.test(String(value ?? ''));
      const normalizeItem = (item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        if (!['allow', 'deny'].includes(item.effect) || !validPermissionKey(item.permissionKey) || !validResource(item.resource)) return null;
        const hasFieldAccess = Object.hasOwn(item, 'fieldAccess');
        if (hasFieldAccess && (item.fieldAccess === null || typeof item.fieldAccess !== 'object' || Array.isArray(item.fieldAccess))) return null;
        const entries = Object.entries(item.fieldAccess ?? {});
        if (entries.some(([key, value]) => {
          const states = Array.isArray(value) ? value : [value];
          return !key.trim() || states.length === 0 || states.some((state) => typeof state !== 'string' || !knownFieldAccess.has(state.trim()));
        })) return null;
        return {
          effect: item.effect,
          fieldAccess: Object.fromEntries(entries.map(([key, value]) => [key.trim(), (Array.isArray(value) ? value : [value]).map((state) => state.trim())])),
          permissionKey: String(item.permissionKey),
          resource: String(item.resource),
        };
      };
      const selectedPermissions = Array.isArray(inputPermissions)
        ? inputPermissions.filter(shouldSelectRow)
        : [];
      const normalized = selectedPermissions.map(normalizeItem);
      const permissions = validScope && appResourceMatches && Array.isArray(inputPermissions) && normalized.every(Boolean)
        ? normalized
        : [];
      return {
        appResource: String(payload?.scope ?? ''),
        permissions,
        principal: String(source?.principal ?? ''),
        scope,
      };
    };
    export const canUseEntityOperation = (access, entityKey, permissionKey) => {
      const matched = matches(access, entityKey, permissionKey);
      return !matched.some((item) => item.effect === 'deny') && matched.some((item) => item.effect === 'allow');
    };
    export const canCreateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']));
    export const canReadEntityFieldMetadata = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'editable', 'readonly', 'partialMask', 'fullMask']));
    const effectiveFieldAllowed = (access, entityKey, fieldKey, operation) => {
      if (!isValidRequestedIdentifier(fieldKey) || !canUseEntityOperation(access, entityKey, operation)) return false;
      fieldKey = requestedIdentifier(fieldKey);
      const restrictionKeys = ['meta.field.read', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate'];
      const rows = restrictionKeys.flatMap((key) => matches(access, entityKey, key)).filter((row) => row.effect === 'allow');
      const groups = rows.flatMap((row) => ['*', fieldKey]
        .filter((key) => Object.hasOwn(row.fieldAccess, key))
        .map((key) => row.fieldAccess[key]));
      if (groups.some((states) => states.length > 0 && states.every((state) => state === 'creatable'))) return false;
      const states = groups.flatMap((group) => group);
      const restrictions = operation === 'data.record.read'
        ? new Set(['hidden'])
        : new Set(['hidden', 'readonly', 'partialMask', 'fullMask']);
      return !states.some((state) => restrictions.has(state));
    };
    export const canReadEntityField = (access, entityKey, fieldKey) => effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.read');
    export const canUpdateEntityField = (access, entityKey, fieldKey) => effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.update');
    export const canBulkUpdateEntityField = (access, entityKey, fieldKey) => effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.bulkUpdate');
    export const isCreateCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type) && !new Set([
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ]).has(field.key);
    export const isEditCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type);
  `;
  const correctAdapter = writeAdapter('correct.mjs', correctAdapterSource);
  const correctResult = runSuite(correctAdapter);
  assert.equal(correctResult.status, 0, correctResult.output);
  assert.match(correctResult.output, /permission conformance: PASS/);

  const coreAdapterSource = correctAdapterSource
    .replace(/^    export const canReadEntityFieldMetadata[^\n]*\n/m, '')
    .replace(/^    export const canBulkUpdateEntityField[^\n]*\n/m, '');
  const coreAdapter = writeAdapter('core-only.mjs', coreAdapterSource);
  const coreResult = runSuite(coreAdapter);
  assert.equal(coreResult.status, 0, coreResult.output);
  assert.match(coreResult.output, /permission conformance: PASS \(\d+ cases, 2 skipped\)/);
  assert.match(coreResult.output, /field_metadata_read_is_independent_from_business_values: SKIP/);
  assert.match(coreResult.output, /bulk_update_field_access_is_independent_from_single_update: SKIP/);

  for (const [flag, helper] of [
    ['--require-field-metadata', 'canReadEntityFieldMetadata'],
    ['--require-bulk-update', 'canBulkUpdateEntityField'],
  ]) {
    const missingCapability = runSuite(coreAdapter, [flag]);
    assert.notEqual(missingCapability.status, 0);
    assert.match(missingCapability.output, new RegExp(`adapter_function_missing: ${helper}`));
    const supportedCapability = runSuite(correctAdapter, [flag]);
    assert.equal(supportedCapability.status, 0, supportedCapability.output);
    const malformedAdapter = writeAdapter(`invalid-${helper}.mjs`,
      `${coreAdapterSource}\nexport const ${helper} = true;`);
    const malformedCapability = runSuite(malformedAdapter);
    assert.notEqual(malformedCapability.status, 0);
    assert.match(malformedCapability.output, new RegExp(`adapter_function_invalid: ${helper}`));
  }

  const unknownCapabilityFlag = runSuite(coreAdapter, ['--require-bulk-updat']);
  assert.equal(unknownCapabilityFlag.status, 2);
  assert.match(unknownCapabilityFlag.output, /Usage:/);

  const coreUsesRecordCreateAdapter = writeAdapter('core-uses-record-create.mjs',
    coreAdapterSource.replace(
      "'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask'])",
      "'data.record.create', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask'])",
    ));
  const coreUsesRecordCreateResult = runSuite(coreUsesRecordCreateAdapter);
  assert.notEqual(coreUsesRecordCreateResult.status, 0);
  assert.match(coreUsesRecordCreateResult.output, /operation_deny_does_not_deny_read_derived_create_field/);

  const unknownKeySelectedAdapter = writeAdapter(
    'unknown-key-selected.mjs',
    correctAdapterSource.replace(
      "return supportedBusinessPermissionKeys.some((expected) => wildcardKeyMatches(value, expected))",
      "return value.startsWith('data.record.') || supportedBusinessPermissionKeys.some((expected) => wildcardKeyMatches(value, expected))",
    ),
  );
  const unknownKeySelectedResult = runSuite(unknownKeySelectedAdapter);
  assert.notEqual(unknownKeySelectedResult.status, 0);
  assert.match(
    unknownKeySelectedResult.output,
    /unknown_current_app_permission_key_is_ignored_before_validation/,
  );

  const unclassifiableResourceIgnoredAdapter = writeAdapter(
    'unclassifiable-resource-ignored.mjs',
    correctAdapterSource.replace(
      "if (resourceClassification === 'unclassifiable') return true;",
      "if (resourceClassification === 'unclassifiable') return false;",
    ),
  );
  const unclassifiableResourceIgnoredResult = runSuite(unclassifiableResourceIgnoredAdapter);
  assert.notEqual(unclassifiableResourceIgnoredResult.status, 0);
  assert.match(
    unclassifiableResourceIgnoredResult.output,
    /unclassifiable_resource_fails_closed_before_key_is_ignored/,
  );

  const entityMetadataUsesRecordReadAdapter = writeAdapter(
    'entity-metadata-uses-record-read.mjs',
    correctAdapterSource.replace(
      "export const canUseEntityOperation = (access, entityKey, permissionKey) => {\n      const matched = matches(access, entityKey, permissionKey);",
      "export const canUseEntityOperation = (access, entityKey, permissionKey) => {\n      const matched = matches(access, entityKey, permissionKey === 'meta.entity.read' ? 'data.record.read' : permissionKey);",
    ),
  );
  const entityMetadataUsesRecordReadResult = runSuite(entityMetadataUsesRecordReadAdapter);
  assert.notEqual(entityMetadataUsesRecordReadResult.status, 0);
  assert.match(
    entityMetadataUsesRecordReadResult.output,
    /entity_metadata_read_is_independent_from_record_read/,
  );

  const noGlobalWildcardAdapter = writeAdapter(
    'no-global-wildcard.mjs',
    correctAdapterSource.replace(
      "if (actual === expected || actual === '*.*.*') return true;",
      "if (actual === '*.*.*') return false;\n      if (actual === expected) return true;",
    ),
  );
  const noGlobalWildcardResult = runSuite(noGlobalWildcardAdapter);
  assert.notEqual(noGlobalWildcardResult.status, 0);
  assert.match(noGlobalWildcardResult.output, /operation_global_permission_wildcard_allows/);

  const noStateListAdapter = writeAdapter(
    'no-state-list.mjs',
    correctAdapterSource.replace(
      "const flattenedStates = states.flatMap((state) => Array.isArray(state) ? state : [state]);",
      "const flattenedStates = states;",
    ),
  );
  const noStateListResult = runSuite(noStateListAdapter);
  assert.notEqual(noStateListResult.status, 0);
  assert.match(noStateListResult.output, /field_metadata_read_is_independent_from_business_values|operation_deny_does_not_deny_read_derived_create_field|valid_field_access_state_lists_are_preserved/);

  for (const extraFieldUpdateKey of ['meta.field.update', 'data.field.update']) {
    const extraGateAdapter = writeAdapter(`extra-gate-${extraFieldUpdateKey}.mjs`, correctAdapterSource.replace(
      "return !states.some((state) => restrictions.has(state));",
      `return canUseEntityOperation(access, entityKey, '${extraFieldUpdateKey}') && !states.some((state) => restrictions.has(state));`,
    ));
    const extraGateResult = runSuite(extraGateAdapter);
    assert.notEqual(extraGateResult.status, 0, extraFieldUpdateKey + ' must not become a required business write gate');
  }

  const operationOnlyCreateAdapter = writeAdapter('operation-only-create.mjs', correctAdapterSource.replace(
    "fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']))",
    "canUseEntityOperation(access, entityKey, 'data.record.create')",
  ));
  const operationOnlyCreateResult = runSuite(operationOnlyCreateAdapter);
  assert.notEqual(operationOnlyCreateResult.status, 0);
  assert.match(operationOnlyCreateResult.output, /invalid_requested_identifiers_fail_closed|operation_deny_does_not_deny_read_derived_create_field/);

  const noParentResourceAdapter = writeAdapter(
    'no-parent-resource.mjs',
    correctAdapterSource.replace(
      "if (actual === '*' || actual === expected || expected.startsWith(actual + '/')) return true;",
      "if (actual !== expected && expected.startsWith(actual + '/')) return false;\n      if (actual === '*' || actual === expected || expected.startsWith(actual + '/')) return true;",
    ),
  );
  const noParentResourceResult = runSuite(noParentResourceAdapter);
  assert.notEqual(noParentResourceResult.status, 0);
  assert.match(noParentResourceResult.output, /operation_record_wildcard_allows|parent_and_global_resources_match/);

  const droppedMalformedRowsAdapter = writeAdapter(
    'dropped-malformed-rows.mjs',
    correctAdapterSource.replace(
      'validScope && appResourceMatches && Array.isArray(inputPermissions) && normalized.every(Boolean)',
      'validScope && appResourceMatches && Array.isArray(inputPermissions)',
    ).replace(
      '? normalized\n        : [];',
      '? normalized.filter(Boolean)\n        : [];',
    ),
  );
  const droppedMalformedRowsResult = runSuite(droppedMalformedRowsAdapter);
  assert.notEqual(droppedMalformedRowsResult.status, 0);
  assert.match(
    droppedMalformedRowsResult.output,
    /invalid_field_access_fails_closed|blank_field_key_poison_entire_access|malformed_row_poison_entire_access|unclassifiable_resource_fails_closed_before_key_is_ignored/,
  );

  const appResourceOverrideAdapter = writeAdapter(
    'app-resource-override.mjs',
    correctAdapterSource
      .replace(
        "const appResourceMatches = !Object.hasOwn(source ?? {}, 'appResource') || String(source.appResource ?? '') === scope;",
        'const appResourceMatches = true;',
      )
      .replace(
        "appResource: String(payload?.scope ?? ''),",
        "appResource: String(payload?.appResource ?? payload?.scope ?? ''),",
      ),
  );
  const appResourceOverrideResult = runSuite(appResourceOverrideAdapter);
  assert.notEqual(appResourceOverrideResult.status, 0);
  assert.match(appResourceOverrideResult.output, /app_resource_cannot_override_scope|invalid_explicit_app_resource_fails_closed/);

  const firstAllowOnlyAdapter = writeAdapter(
    'first-allow-only.mjs',
    correctAdapterSource.replace(
      'const ranges = allows.filter((item) => score(item.resource) === maxScore);',
      'const ranges = allows.filter((item) => score(item.resource) === maxScore).slice(0, 1);',
    ),
  );
  const firstAllowOnlyResult = runSuite(firstAllowOnlyAdapter);
  assert.notEqual(firstAllowOnlyResult.status, 0);
  assert.match(firstAllowOnlyResult.output, /read_derived_create_with_named_hidden_exception|create_field_uses_meta_field_read_dimension|same_specificity_allow_fields_union/);

  const fuzzySystemFieldAdapter = writeAdapter(
    'fuzzy-system-field.mjs',
    correctAdapterSource.replace(
      "]).has(field.key);",
      "]).has(field.key) && ![\n      'create_user', 'create_time', 'update_user', 'update_time',\n      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',\n    ].some((key) => field.key.includes(key));",
    ),
  );
  const fuzzySystemFieldResult = runSuite(fuzzySystemFieldAdapter);
  assert.notEqual(fuzzySystemFieldResult.status, 0);
  assert.match(fuzzySystemFieldResult.output, /similarly_named_business_fields_remain_create_capable/);

  const missingIdEditGuardAdapter = writeAdapter(
    'missing-id-edit-guard.mjs',
    correctAdapterSource.replace(
      "export const isEditCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type);",
      'export const isEditCapableField = () => true;',
    ),
  );
  const missingIdEditGuardResult = runSuite(missingIdEditGuardAdapter);
  assert.notEqual(missingIdEditGuardResult.status, 0);
  assert.match(missingIdEditGuardResult.output, /system_id_fields_are_not_edit_capable/);

  const auditEditGuardAdapter = writeAdapter(
    'audit-edit-guard.mjs',
    correctAdapterSource.replace(
      "export const canUpdateEntityField = (access, entityKey, fieldKey) => effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.update');",
      "export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldKey !== 'create_time' && effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.update');",
    ),
  );
  const auditEditGuardResult = runSuite(auditEditGuardAdapter);
  assert.notEqual(auditEditGuardResult.status, 0);
  assert.match(auditEditGuardResult.output, /audit_fields_can_remain_update_capable/);

  const bulkUsesSingleUpdateAdapter = writeAdapter(
    'bulk-uses-single-update.mjs',
    correctAdapterSource.replace(
      "effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.bulkUpdate')",
      "effectiveFieldAllowed(access, entityKey, fieldKey, 'data.record.update')",
    ),
  );
  const bulkUsesSingleUpdateResult = runSuite(bulkUsesSingleUpdateAdapter);
  assert.notEqual(bulkUsesSingleUpdateResult.status, 0);
  assert.match(bulkUsesSingleUpdateResult.output, /bulk_update_field_access_is_independent_from_single_update/);

  const restrictionMutations = [
    ['ignore-metadata-read-restrictions',
      "const restrictionKeys = ['meta.field.read', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate'];",
      "const restrictionKeys = ['data.record.read', 'data.record.update', 'data.record.bulkUpdate'];",
      /read_dimension_access_states|valid_field_access_state_lists_are_preserved|raw_effective_restrictions_survive_record_write_allow/],
    ['ignore-record-read-restrictions',
      "const restrictionKeys = ['meta.field.read', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate'];",
      "const restrictionKeys = ['meta.field.read', 'data.record.update', 'data.record.bulkUpdate'];",
      /raw_effective_restrictions_survive_record_write_allow/],
    ['ignore-bulk-restrictions-for-single-writes',
      "const restrictionKeys = ['meta.field.read', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate'];",
      "const restrictionKeys = ['meta.field.read', 'data.record.read', 'data.record.update'];",
      /raw_effective_restrictions_survive_record_write_allow/],
    ['specific-resource-drops-parent-restriction',
      "const groups = rows.flatMap((row) => ['*', fieldKey]",
      "const mostSpecificRows = rows.filter((row) => score(row.resource) === Math.max(...rows.map((entry) => score(entry.resource))));\n      const groups = mostSpecificRows.flatMap((row) => ['*', fieldKey]",
      /raw_effective_restrictions_survive_record_write_allow/],
    ['named-overrides-untrusted-wildcard',
      ".filter((key) => Object.hasOwn(row.fieldAccess, key))",
      ".filter((key) => Object.hasOwn(row.fieldAccess, key) && (key === fieldKey || !Object.hasOwn(row.fieldAccess, fieldKey)))",
      /raw_merged_wildcard_restrictions_cannot_be_overridden_by_named_editable/],
    ['ignore-array-restriction-after-editable',
      "const states = groups.flatMap((group) => group);",
      "const states = groups.flatMap((group) => group.slice(0, 1));",
      /raw_state_arrays_preserve_any_restriction|valid_field_access_state_lists_are_preserved/],
    ['positive-field-state-is-required',
      "return !states.some((state) => restrictions.has(state));",
      "return states.length > 0 && !states.some((state) => restrictions.has(state));",
      /bulk_update_field_access_is_independent_from_single_update|raw_missing_field_restriction_defaults_editable_inside_gate/],
    ['record-gate-is-omitted',
      "if (!isValidRequestedIdentifier(fieldKey) || !canUseEntityOperation(access, entityKey, operation)) return false;",
      "if (!isValidRequestedIdentifier(fieldKey) || !isValidRequestedIdentifier(entityKey)) return false;",
      /create_field_uses_meta_field_read_dimension|field_metadata_read_is_independent_from_business_values|record_update_revoke_and_restore_rechecks_gate/],
    ['create-only-state-is-ignored-for-existing-records',
      "if (groups.some((states) => states.length > 0 && states.every((state) => state === 'creatable'))) return false;",
      "// regression: create-only state ignored",
      /legacy_create_only_field_is_not_readable_or_editable/],
    ['decision-envelope-is-coerced-into-raw-rows',
      "const inputPermissions = source?.permissions;",
      "const inputPermissions = source?.permissions ?? (source?.effect === 'allow' ? [{ ...source, permissionKey: 'data.record.update', resource: APP + '/entity/order' }] : undefined);",
      /decision_envelopes_are_not_raw_principal_rows/],
  ];
  for (const [name, original, replacement, expectedCase] of restrictionMutations) {
    assert.ok(correctAdapterSource.includes(original), name + ': mutation anchor must exist');
    const mutantAdapter = writeAdapter(name + '.mjs', correctAdapterSource.replace(original, replacement));
    const mutantResult = runSuite(mutantAdapter);
    assert.notEqual(mutantResult.status, 0, name + ': regression must be rejected');
    assert.match(mutantResult.output, expectedCase, name + ': a behavioral case must detect the mutation');
  }

  const incompleteAdapter = writeAdapter('incomplete.mjs', 'export const normalizeAccess = (payload) => payload;');
  const incompleteResult = runSuite(incompleteAdapter);
  assert.notEqual(incompleteResult.status, 0);
  assert.match(incompleteResult.output, /adapter_function_missing/);

  console.log(correctResult.output.trim());
  console.log(`permission-conformance-suite tests: PASS (${suiteRunCount} adapter runs, ${restrictionMutations.length} effective-restriction mutations)`);
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

function writeAdapter(name, source) {
  const file = path.join(tempRoot, name);
  fs.writeFileSync(file, source, 'utf8');
  return file;
}

function runSuite(adapterPath, flags = []) {
  suiteRunCount += 1;
  const result = spawnSync(process.execPath, [suiteScript, adapterPath, ...flags], {
    encoding: 'utf8',
  });
  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  };
}
