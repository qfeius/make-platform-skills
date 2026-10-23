#!/usr/bin/env node
// make-app-permission contract version: 0.3.5
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [adapterPath, ...flags] = process.argv.slice(2);
const capabilityFlags = new Map([
  ['--require-field-metadata', 'canReadEntityFieldMetadata'],
  ['--require-bulk-update', 'canBulkUpdateEntityField'],
]);

if (!adapterPath || flags.some((flag) => !capabilityFlags.has(flag))) {
  console.error('Usage: node permission-conformance-suite.mjs <adapter-module> [--require-field-metadata] [--require-bulk-update]');
  process.exit(2);
}

let adapter;
try {
  const imported = await import(pathToFileURL(path.resolve(adapterPath)).href);
  adapter = imported.default ?? imported;
} catch (error) {
  console.error('adapter_import_failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}

const requiredFunctions = [
  'normalizeAccess',
  'canUseEntityOperation',
  'canCreateEntityField',
  'canReadEntityField',
  'canUpdateEntityField',
  'isCreateCapableField',
  'isEditCapableField',
  ...flags.map((flag) => capabilityFlags.get(flag)),
];

for (const functionName of requiredFunctions) {
  if (typeof adapter[functionName] !== 'function') {
    console.error(`adapter_function_missing: ${functionName}`);
    process.exit(1);
  }
}

for (const functionName of capabilityFlags.values()) {
  if (adapter[functionName] !== undefined && typeof adapter[functionName] !== 'function') {
    console.error(`adapter_function_invalid: ${functionName}`);
    process.exit(1);
  }
}

const APP_RESOURCE = 'make://tenant-1/meta/app/TestApp';
const ENTITY_RESOURCE = `${APP_RESOURCE}/entity/order`;
const basePayload = (permissions) => ({
  permissions,
  principal: 'user-1',
  scope: APP_RESOURCE,
});
const permission = (permissionKey, options = {}) => ({
  effect: options.effect ?? 'allow',
  fieldAccess: options.fieldAccess ?? {},
  permissionKey,
  resource: options.resource ?? ENTITY_RESOURCE,
});
const access = (...permissions) => adapter.normalizeAccess(basePayload(permissions));

const cases = [
  ['operation_read_exact_allows', () => {
    const current = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
  }],
  ['named_entity_permission_does_not_leak', () => {
    const current = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'invoice', 'data.record.read'), false);
  }],
  ['entity_metadata_read_is_independent_from_record_read', () => {
    const metadataOnly = access(permission('meta.entity.read'));
    assert.equal(adapter.canUseEntityOperation(metadataOnly, 'order', 'meta.entity.read'), true);
    assert.equal(adapter.canUseEntityOperation(metadataOnly, 'order', 'data.record.read'), false);

    const recordsOnly = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(recordsOnly, 'order', 'meta.entity.read'), false);
    assert.equal(adapter.canUseEntityOperation(recordsOnly, 'order', 'data.record.read'), true);
  }],
  ['invalid_requested_identifiers_fail_closed', () => {
    const current = access(
      permission('*.*.*', { fieldAccess: { '*': '*' }, resource: '*' }),
    );
    for (const entityKey of [undefined, null, 7, {}, [], '', '   ', '*']) {
      assert.equal(adapter.canUseEntityOperation(current, entityKey, 'data.record.read'), false);
      assert.equal(adapter.canCreateEntityField(current, entityKey, 'title'), false);
      assert.equal(adapter.canReadEntityField(current, entityKey, 'title'), false);
      assert.equal(adapter.canUpdateEntityField(current, entityKey, 'title'), false);
    }
    for (const fieldKey of [undefined, null, 7, {}, [], '', '   ', '*']) {
      assert.equal(adapter.canCreateEntityField(current, 'order', fieldKey), false);
      assert.equal(adapter.canReadEntityField(current, 'order', fieldKey), false);
      assert.equal(adapter.canUpdateEntityField(current, 'order', fieldKey), false);
    }
  }],
  ['operation_create_absent_must_deny', () => {
    const current = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
  }],
  ['operation_record_wildcard_allows', () => {
    const current = access(permission('data.record.*', { resource: APP_RESOURCE }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.delete'), true);
  }],
  ['operation_global_permission_wildcard_allows', () => {
    const current = access(permission('*.*.*', { resource: '*' }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'meta.field.read'), true);
  }],
  ['operation_segment_permission_wildcard_allows', () => {
    const current = access(permission('*.record.create', { resource: APP_RESOURCE }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'meta.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), false);
  }],
  ['operation_deny_wins', () => {
    const current = access(
      permission('data.record.*', { resource: APP_RESOURCE }),
      permission('data.record.create', { effect: 'deny' }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
  }],
  ['operation_deny_does_not_deny_read_derived_create_field', () => {
    const current = access(
      permission('data.record.create'),
      permission('data.record.create', { effect: 'deny' }),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['read_field_deny_does_not_deny_record_create_operation', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      permission('meta.field.read', { effect: 'deny' }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['namespace_resource_wildcard_matches', () => {
    const current = access(permission('data.record.read', {
      resource: 'make://tenant-1/*/app/TestApp',
    }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
  }],
  ['entity_resource_wildcard_matches', () => {
    const current = access(permission('data.record.read', {
      resource: `${APP_RESOURCE}/entity/*`,
    }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
  }],
  ['parent_and_global_resources_match', () => {
    const parentAccess = access(permission('data.record.read', { resource: APP_RESOURCE }));
    const globalAccess = access(permission('data.record.update', { resource: '*' }));
    assert.equal(adapter.canUseEntityOperation(parentAccess, 'order', 'data.record.read'), true);
    assert.equal(adapter.canUseEntityOperation(globalAccess, 'order', 'data.record.update'), true);
  }],
  ['surplus_permission_rows_do_not_block_app_access', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'make.platform.admin',
        resource: 'make://tenant-1',
      },
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'data.record.delete',
        resource: 'make://tenant-2/meta/app/OtherApp',
      },
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'iam.permission.read',
        resource: ENTITY_RESOURCE,
      },
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'unrelated.permission.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['unknown_current_app_permission_key_is_ignored_before_validation', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'data.record.export',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['unclassifiable_resource_fails_closed_before_key_is_ignored', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'iam.permission.read',
        resource: 'make://tenant-1/meta/app/TestApp/not-a-supported-resource',
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['create_field_uses_meta_field_read_dimension', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: { createOnly: 'creatable', visibleOnly: 'readonly' } }),
      permission('meta.field.update', { fieldAccess: { editableOnly: 'editable' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'createOnly'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'visibleOnly'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'visibleOnly'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'editableOnly'), false);
  }],
  ['record_create_field_access_does_not_grant_meta_read', () => {
    const current = access(permission('data.record.create', {
      fieldAccess: { createOnly: 'creatable' },
    }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'createOnly'), false);
  }],
  ['legacy_meta_field_create_does_not_grant_create_field', () => {
    const current = access(permission('meta.field.create', {
      fieldAccess: { title: 'creatable' },
    }));
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['read_dimension_access_states', () => {
    const current = access(
      permission('data.record.read'),
      permission('meta.field.read', { fieldAccess: { editable: 'editable', masked: 'partialMask', hidden: 'hidden' } }),
    );
    assert.equal(adapter.canReadEntityField(current, 'order', 'editable'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'masked'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'hidden'), false);
  }],
  ['record_update_does_not_require_meta_update', () => {
    const current = access(permission('data.record.update', { fieldAccess: { title: 'editable' } }));
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), false);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'meta.field.update'), false);
  }],
  ['read_derived_create_with_named_hidden_exception', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', {
        fieldAccess: { '*': 'readonly', secret: 'hidden' },
      }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'secret'), false);
  }],
  ['empty_field_access_is_unrestricted_in_dimension', () => {
    const current = access(permission('meta.field.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['invalid_field_access_fails_closed', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'allow',
        fieldAccess: ['readonly'],
        permissionKey: 'meta.field.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);

    const invalidDeny = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'deny',
        fieldAccess: ['hidden'],
        permissionKey: 'meta.field.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(invalidDeny, 'order', 'data.record.create'), false);
  }],
  ['explicit_null_field_access_fails_closed', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'allow',
        fieldAccess: null,
        permissionKey: 'meta.field.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['invalid_field_access_state_fails_closed', () => {
    for (const fieldAccess of [
      { title: 'unexpected' },
      { title: [] },
      { title: ['creatable', 7] },
    ]) {
      const current = adapter.normalizeAccess(basePayload([
        permission('data.record.create'),
        {
          effect: 'allow',
          fieldAccess,
          permissionKey: 'meta.field.read',
          resource: ENTITY_RESOURCE,
        },
      ]));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['valid_field_access_state_lists_are_preserved', () => {
    const current = access(
      permission('data.record.read'),
      permission('data.record.update'),
      permission('meta.field.read', { fieldAccess: { title: ['creatable', 'readonly'] } }),
      permission('data.record.update', { fieldAccess: { title: ['readonly', 'editable'] } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
  }],
  ['blank_field_key_poison_entire_access', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { '   ': 'readonly' } }),
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['invalid_effect_fails_closed', () => {
    const current = adapter.normalizeAccess(basePayload([{
      effect: 'unexpected',
      fieldAccess: {},
      permissionKey: 'data.record.create',
      resource: ENTITY_RESOURCE,
    }]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['malformed_row_poison_entire_access', () => {
    for (const malformedRow of [
      null,
      7,
      'invalid',
      { effect: 'unexpected', fieldAccess: {}, permissionKey: 'data.record.create', resource: ENTITY_RESOURCE },
      { effect: 'allow', fieldAccess: {}, permissionKey: 'data.record', resource: ENTITY_RESOURCE },
      { effect: 'allow', fieldAccess: {}, permissionKey: 'data.record.create', resource: 'invalid' },
    ]) {
      const current = adapter.normalizeAccess(basePayload([
        permission('data.record.create'),
        malformedRow,
      ]));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
    for (const payload of [null, 7, 'invalid', [], { permissions: {}, scope: APP_RESOURCE }]) {
      let current;
      assert.doesNotThrow(() => {
        current = adapter.normalizeAccess(payload);
      });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    }
  }],
  ['invalid_permission_key_does_not_match', () => {
    for (const permissionKey of ['*', 'data.record', 'data.record.create.extra']) {
      const current = access(permission(permissionKey));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['invalid_resource_namespace_does_not_match', () => {
    for (const resource of [
      'make://tenant-1/other/app/TestApp/entity/order',
      'make://tenant-1/meta',
      'make://*/meta/app/TestApp/entity/order',
      'make://tenant-1/meta/app/*/entity/order',
      'make://tenant-2/meta/app/TestApp/entity/order',
    ]) {
      const current = access(
        permission('data.record.create', { resource }),
        permission('meta.field.read', {
          fieldAccess: { title: 'readonly' },
          resource,
        }),
      );
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['missing_app_scope_fails_closed', () => {
    for (const scope of [undefined, '', `${APP_RESOURCE}/entity/order`, 'make://*/meta/app/TestApp']) {
      const current = adapter.normalizeAccess({
        permissions: [
          permission('data.record.create', { resource: '*' }),
          permission('meta.field.read', {
            fieldAccess: { title: 'readonly' },
            resource: '*',
          }),
        ],
        principal: 'user-1',
        ...(scope === undefined ? {} : { scope }),
      });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['app_resource_cannot_override_scope', () => {
    const current = adapter.normalizeAccess({
      appResource: 'make://tenant-2/meta/app/OtherApp',
      permissions: [
        permission('data.record.create', {
          resource: 'make://tenant-2/meta/app/OtherApp/entity/order',
        }),
        permission('meta.field.read', {
          fieldAccess: { title: 'readonly' },
          resource: 'make://tenant-2/meta/app/OtherApp/entity/order',
        }),
      ],
      principal: 'user-1',
      scope: APP_RESOURCE,
    });
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['invalid_explicit_app_resource_fails_closed', () => {
    for (const appResource of [null, '', 7]) {
      const current = adapter.normalizeAccess({
        appResource,
        permissions: [
          permission('data.record.create', { resource: '*' }),
          permission('meta.field.read', {
            fieldAccess: { '*': 'readonly' },
            resource: '*',
          }),
        ],
        principal: 'user-1',
        scope: APP_RESOURCE,
      });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['most_specific_read_allow_restricts_parent_create_field_range', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: {}, resource: APP_RESOURCE }),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), false);
  }],
  ['entity_wildcard_allow_restricts_app_allow', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: {}, resource: APP_RESOURCE }),
      permission('meta.field.read', {
        fieldAccess: { title: 'readonly' },
        resource: `${APP_RESOURCE}/entity/*`,
      }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), false);
  }],
  ['same_specificity_allow_fields_union', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      permission('meta.field.read', { fieldAccess: { amount: 'readonly' } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'secret'), false);
  }],
  ['namespace_alias_same_specificity_allow_union', () => {
    const current = access(
      permission('meta.field.read', {
        fieldAccess: { title: 'readonly' },
        resource: ENTITY_RESOURCE,
      }),
      permission('meta.field.read', {
        fieldAccess: { amount: 'readonly' },
        resource: 'make://tenant-1/*/app/TestApp/entity/order',
      }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), true);
  }],
  ['same_specificity_named_hidden_overrides_wildcard', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { '*': 'readonly' } }),
      permission('meta.field.read', { fieldAccess: { secret: 'hidden' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'secret'), false);
  }],
  ['same_specificity_named_hidden_overrides_named_allow', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      permission('meta.field.read', { fieldAccess: { title: 'hidden' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['same_specificity_named_hidden_overrides_unrestricted_allow', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: {} }),
      permission('meta.field.read', { fieldAccess: { title: 'hidden' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), true);
  }],
  ['system_id_and_audit_fields_are_not_create_capable', () => {
    for (const type of ['Make.Field.ID', 'IDField']) {
      assert.equal(adapter.isCreateCapableField({ key: 'record_id', type }), false);
    }
    for (const key of [
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ]) {
      assert.equal(adapter.isCreateCapableField({ key, type: 'Make.Field.Text' }), false);
    }
    assert.equal(adapter.isCreateCapableField({ key: 'title', type: 'Make.Field.Text' }), true);
  }],
  ['system_id_fields_are_not_edit_capable', () => {
    for (const type of ['Make.Field.ID', 'IDField']) {
      assert.equal(adapter.isEditCapableField({ key: 'record_id', type }), false);
    }
    assert.equal(adapter.isEditCapableField({ key: 'title', type: 'Make.Field.Text' }), true);
  }],
  ['similarly_named_business_fields_remain_create_capable', () => {
    for (const key of [
      'create_user_note',
      'create_time_zone',
      'update_user_label',
      'qfei_update_time_backup',
    ]) {
      assert.equal(adapter.isCreateCapableField({ key, type: 'Make.Field.Text' }), true);
    }
  }],
  ['audit_fields_can_remain_update_capable', () => {
    const auditKeys = [
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ];
    const current = access(permission('data.record.update', {
      fieldAccess: Object.fromEntries(auditKeys.map((key) => [key, 'editable'])),
    }));
    for (const key of auditKeys) {
      assert.equal(adapter.canUpdateEntityField(current, 'order', key), true);
      assert.equal(adapter.isEditCapableField({ key, type: 'Make.Field.Text' }), true);
    }
  }],
  ['field_metadata_read_is_independent_from_business_values', () => {
    const metadataOnly = access(permission('meta.field.read', { fieldAccess: { title: 'readonly' } }));
    assert.equal(adapter.canReadEntityFieldMetadata(metadataOnly, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(metadataOnly, 'order', 'title'), false);
    const recordsOnly = access(permission('data.record.read', { fieldAccess: { title: 'readonly' } }));
    assert.equal(adapter.canReadEntityFieldMetadata(recordsOnly, 'order', 'title'), false);
    assert.equal(adapter.canReadEntityField(recordsOnly, 'order', 'title'), true);
  }],
  ['bulk_update_field_access_is_independent_from_single_update', () => {
    const singleOnly = access(permission('data.record.update'));
    assert.equal(adapter.canUpdateEntityField(singleOnly, 'order', 'title'), true);
    assert.equal(adapter.canBulkUpdateEntityField(singleOnly, 'order', 'title'), false);
    const bulkOnly = access(permission('data.record.bulkUpdate'));
    assert.equal(adapter.canBulkUpdateEntityField(bulkOnly, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(bulkOnly, 'order', 'title'), false);
    const denied = access(permission('data.record.*'), permission('data.record.bulkUpdate', { effect: 'deny' }));
    assert.equal(adapter.canBulkUpdateEntityField(denied, 'order', 'title'), false);
    assert.equal(adapter.canUpdateEntityField(denied, 'order', 'title'), true);
  }],
];

// This adapter profile consumes raw principal permission rows. It does not infer
// trusted Statement provenance or parse final Decision / Plan envelopes.
cases.push(
  ['legacy_create_states_remain_supported', () => {
    for (const state of ['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']) {
      const current = access(permission('meta.field.read', { fieldAccess: { title: state } }));
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true, state);
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    }
    assert.equal(adapter.canCreateEntityField(access(permission('meta.field.read', { fieldAccess: { title: 'hidden' } })), 'order', 'title'), false);
  }],
  ['console_style_record_gate_allows_business_edits_without_field_update_keys', () => {
    const current = access(
      permission('data.record.*'),
      permission('meta.entity.read'),
      permission('meta.field.read', { fieldAccess: { '*': '*' } }),
    );
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
    if (adapter.canBulkUpdateEntityField) assert.equal(adapter.canBulkUpdateEntityField(current, 'order', 'title'), true);
  }],
  ['raw_effective_restrictions_survive_record_write_allow', () => {
    for (const source of ['meta.field.read', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate']) {
      for (const state of ['readonly', 'hidden', 'partialMask', 'fullMask']) {
        const current = access(
          permission('data.record.*'),
          permission(source, { fieldAccess: { title: state }, resource: APP_RESOURCE }),
          permission('data.record.update', { fieldAccess: { title: 'editable' } }),
          permission('data.record.bulkUpdate', { fieldAccess: { title: 'editable' } }),
        );
        assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false, source + ':' + state);
        if (adapter.canBulkUpdateEntityField) assert.equal(adapter.canBulkUpdateEntityField(current, 'order', 'title'), false, source + ':' + state);
        if (state === 'hidden') assert.equal(adapter.canReadEntityField(current, 'order', 'title'), false, source);
      }
    }
  }],
  ['raw_missing_field_restriction_defaults_editable_inside_gate', () => {
    const current = access(
      permission('data.record.update', { fieldAccess: { secret: 'hidden' } }),
      permission('data.record.bulkUpdate'),
    );
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'secret'), false);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), false);
    if (adapter.canBulkUpdateEntityField) assert.equal(adapter.canBulkUpdateEntityField(current, 'order', 'title'), true);
  }],
  ['raw_merged_wildcard_restrictions_cannot_be_overridden_by_named_editable', () => {
    for (const source of ['meta.field.read', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate']) {
      for (const state of ['readonly', 'hidden', 'partialMask', 'fullMask']) {
        const current = access(
          permission('data.record.*'),
          permission(source, { fieldAccess: { '*': state, title: 'editable' } }),
        );
        assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false, source + ':' + state);
        if (adapter.canBulkUpdateEntityField) assert.equal(adapter.canBulkUpdateEntityField(current, 'order', 'title'), false);
        if (state === 'hidden') assert.equal(adapter.canReadEntityField(current, 'order', 'title'), false);
      }
    }
  }],
  ['raw_state_arrays_preserve_any_restriction', () => {
    for (const state of ['readonly', 'hidden', 'partialMask', 'fullMask']) {
      const current = access(
        permission('data.record.*'),
        permission('meta.field.read', { fieldAccess: { title: ['*', 'editable', state] } }),
      );
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
      if (adapter.canBulkUpdateEntityField) assert.equal(adapter.canBulkUpdateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['unrelated_entity_field_restrictions_do_not_leak', () => {
    const current = access(
      permission('data.record.update'),
      permission('meta.field.read', { resource: APP_RESOURCE + '/entity/invoice', fieldAccess: { title: 'hidden' } }),
    );
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
  }],
  ['record_update_revoke_and_restore_rechecks_gate', () => {
    const granted = access(permission('data.record.update'));
    const revoked = access(permission('meta.field.read', { fieldAccess: { title: 'editable' } }));
    const denied = access(permission('data.record.*'), permission('data.record.update', { effect: 'deny' }));
    const restored = access(permission('data.record.update'));
    for (const [current, expected] of [[granted, true], [revoked, false], [denied, false], [restored, true]]) {
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), expected);
    }
  }],
  ['legacy_create_only_field_is_not_readable_or_editable', () => {
    const current = access(
      permission('data.record.*'),
      permission('meta.field.read', { fieldAccess: { title: 'creatable' } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
    if (adapter.canReadEntityFieldMetadata) assert.equal(adapter.canReadEntityFieldMetadata(current, 'order', 'title'), false);
    if (adapter.canBulkUpdateEntityField) assert.equal(adapter.canBulkUpdateEntityField(current, 'order', 'title'), false);
    const mixedReadable = access(
      permission('data.record.*'),
      permission('meta.field.read', { fieldAccess: { title: ['creatable', 'readonly'] } }),
    );
    assert.equal(adapter.canReadEntityField(mixedReadable, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(mixedReadable, 'order', 'title'), false);
  }],
  ['decision_envelopes_are_not_raw_principal_rows', () => {
    for (const envelope of [
      { effect: 'allow', fieldAccess: { title: 'editable' } },
      { effect: 'allow', fieldAccess: { title: 'editable' }, readonlyFields: ['title'] },
      { decision: { effect: 'allow', readonlyFields: ['title'] } },
      { plan: { effect: 'allow', readonlyFields: ['title'] } },
    ]) {
      const current = adapter.normalizeAccess({ ...envelope, scope: APP_RESOURCE, principal: 'user-1' });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), false);
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
    }
  }],

);

const extensionCases = new Map([
  ['field_metadata_read_is_independent_from_business_values', 'canReadEntityFieldMetadata'],
  ['bulk_update_field_access_is_independent_from_single_update', 'canBulkUpdateEntityField'],
]);
let skipped = 0;
for (const [name, run] of cases) {
  const extension = extensionCases.get(name);
  if (extension && typeof adapter[extension] !== 'function') {
    console.log(`${name}: SKIP (adapter extension not provided: ${extension})`);
    skipped += 1;
    continue;
  }
  try {
    run();
  } catch (error) {
    console.error(`${name}: FAIL`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const coverage = `${cases.length - skipped} cases${skipped ? `, ${skipped} skipped` : ''}`;
console.log(`permission conformance: PASS (${coverage})`);
