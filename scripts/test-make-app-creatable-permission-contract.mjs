#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Expected ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
};

// Installed Skill documentation must work without repository PR/chat context.
const localMarkdownLinks = (file, markdown) => [...markdown.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)]
  .map((match) => match[1].split('#')[0])
  .filter((target) => target && !/^[a-z]+:/i.test(target))
  .map((target) => path.relative(repoRoot, path.resolve(repoRoot, path.dirname(file), target)));

const walkSkillDocuments = (entry) => {
  const directory = path.dirname(entry);
  const documents = new Map();
  const pending = [entry];
  const issues = [];
  while (pending.length > 0) {
    const file = pending.pop();
    if (documents.has(file)) continue;
    const markdown = read(file);
    documents.set(file, markdown);
    for (const target of localMarkdownLinks(file, markdown)) {
      if (target.startsWith('..') || !fs.existsSync(path.join(repoRoot, target))) {
        issues.push(`${file}: unresolved local link ${target}`);
      } else if (target.startsWith(directory + '/') && target.endsWith('.md')) {
        pending.push(target);
      }
    }
  }
  return { documents, issues };
};
const contextualGuidanceIssues = (documents) => [...documents]
  .filter(([, markdown]) => /\bthis (?:(?:Skill )?PR|edit (?:correction|fix))\b|本轮(?:不迁移|修订)|本次(?:修订|PR)/i.test(markdown))
  .map(([file]) => `${file}: installed guidance depends on this change's PR/chat context`);
const unreachableResourceIssues = (resources, documents) => resources
  .filter(([file]) => !documents.has(file))
  .map(([file]) => `${file}: task resource is not discoverable through Markdown links`);
const discoverSkill = (entry) => {
  const { documents, issues } = walkSkillDocuments(entry);
  const directory = `${path.dirname(entry)}/references`;
  const resources = fs.readdirSync(path.join(repoRoot, directory))
    .filter((name) => name.endsWith('.md'))
    .map((name) => [`${directory}/${name}`, read(`${directory}/${name}`)]);
  assert.deepEqual([
    ...issues,
    ...unreachableResourceIssues(resources, documents),
    ...contextualGuidanceIssues(new Map([...documents, ...resources])),
  ], [], 'installed Skill documentation must be self-contained and every task resource reachable');
  return { documents, bundle: [...documents.values()].join('\n') };
};

const discoveredPermission = discoverSkill('skills/make-app-permission/SKILL.md');
const discoveredActions = discoverSkill('skills/make-app-actions/SKILL.md');

const permissionSkill = read('skills/make-app-permission/SKILL.md');
const boundaries = read(
  'skills/make-app-permission/references/permission-boundaries.md',
);
const serviceSkill = read('skills/make-app-service/SKILL.md');
const serviceAdapter = read(
  'skills/make-app-service/references/make-data-adapter.md',
);
const serviceContracts = read(
  'skills/make-app-service/references/service-api-contracts.md',
);
const serviceLayering = read(
  'skills/make-app-service/references/service-layering.md',
);
const serviceTesting = read(
  'skills/make-app-service/references/testing-and-safety.md',
);
const authSkill = read('skills/make-app-auth/SKILL.md');
const authRequestAdapter = read(
  'skills/make-app-auth/references/request-adapter.md',
);
const authLogoutAnd401 = read(
  'skills/make-app-auth/references/logout-and-401.md',
);
const makeuiSkill = read('skills/makeui/SKILL.md');
const componentUsage = read('skills/makeui/references/component-usage.md');
const drawerLayout = read('skills/makeui/references/drawer-layout.md');
const routeLayout = read('skills/makeui/references/page-route-layout.md');
const readme = read('README.md');
const agentMetadata = read('skills/make-app-permission/agents/openai.yaml');

const permissionBundle = discoveredPermission.bundle;
const serviceBundle = [
  serviceSkill,
  serviceAdapter,
  serviceContracts,
  serviceLayering,
  serviceTesting,
].join('\n');
const makeuiBundle = [makeuiSkill, componentUsage, drawerLayout, routeLayout].join(
  '\n',
);

const permissionGuidance = [
  ['README.md', readme],
  ...discoveredPermission.documents,
  ...discoveredActions.documents,
];
const requireContract = (bundle, patterns, reason) => {
  for (const pattern of patterns) assert.match(bundle, pattern, reason);
};
for (const [file, guidance] of permissionGuidance) {
  assert.doesNotMatch(
    guidance,
    /\b(?:data\.record|meta\.field)\.[A-Za-z*]+(?:\/[A-Za-z*]+)*\.fieldAccess\b/,
    `${file}: fieldAccess is a permission-result property, never part of a permission key`,
  );
}

assert.match(
  permissionSkill.split('---')[1] ?? '',
  /(字段可新建|可新建)[^"\n]*(creatable|createFields)|(creatable|createFields)[^"\n]*(字段可新建|可新建)/i,
  'make-app-permission trigger metadata must cover creatable/createFields requests',
);
const permissionVersion = permissionSkill.match(/metadata:\s*\n\s*version:\s*(\d+)\.(\d+)\.(\d+)/);
assert.ok(permissionVersion, 'make-app-permission must declare a version');
const [, permissionMajorText, permissionMinorText, permissionPatchText] = permissionVersion;
const [permissionMajor, permissionMinor, permissionPatch] = [
  permissionMajorText, permissionMinorText, permissionPatchText,
].map(Number);
assert.ok(
  permissionMajor > 0 || permissionMinor > 3 || (permissionMinor === 3 && permissionPatch >= 1),
  'make-app-permission must retain the 0.3.1+ default-enforcement and passthrough release baseline',
);
assert.match(
  permissionBundle,
  /(?:default|默认)[\s\S]*(?:generated|refactored|生成|重构)[\s\S]*Make App/i,
  'make-app-permission must be enabled by default for every Make App',
);
assert.doesNotMatch(
  permissionSkill,
  /only when the user requests it or the repository has an explicit delivery baseline/i,
  'make-app-permission must not make default enforcement opt-in',
);
assert.match(
  permissionBundle,
  /(?:preserve|保留|原样)[\s\S]*status[\s\S]*(?:body|响应体)[\s\S]*Content-Type[\s\S]*(?:unchanged|原样)/i,
  'principal permission route must pass through real Make IAM responses unchanged',
);
assert.doesNotMatch(
  permissionBundle,
  /map upstream failures/i,
  'principal permission route must not map Make IAM failures into a Service envelope',
);
assert.match(
  serviceBundle,
  /direct.*Make.*proxy[\s\S]{0,700}(?:(?:status|状态)[\s\S]{0,240}(?:Content-Type|content type)[\s\S]{0,240}(?:body|响应体)[\s\S]{0,240}(?:unchanged|原样)[\s\S]{0,500}(?:2xx|200)[\s\S]{0,240}(?:4xx|403)[\s\S]{0,240}(?:5xx|500)|(?:2xx|200)[\s\S]{0,240}(?:4xx|403)[\s\S]{0,240}(?:5xx|500)[\s\S]{0,500}(?:status|状态)[\s\S]{0,240}(?:Content-Type|content type)[\s\S]{0,240}(?:body|响应体)[\s\S]{0,240}(?:unchanged|原样))/i,
  'direct Make proxies must preserve the real status, Content-Type, and body for 2xx, 4xx, and 5xx responses',
);
assert.doesNotMatch(
  serviceSkill,
  /When single-app permission enforcement is in scope[\s\S]{0,300}Otherwise do not add that proxy solely to satisfy this Skill/i,
  'make-app-service must not retain an opt-in exception for the mandatory permission proxy',
);
assert.match(
  serviceAdapter,
  /validateStatus\s*:\s*\(\)\s*=>\s*true/i,
  'Axios-like Make clients must resolve completed 4xx/5xx responses for transparent forwarding',
);
assert.match(
  serviceAdapter,
  /error\.response[\s\S]{0,500}(?:status|状态)[\s\S]{0,500}(?:Content-Type|content type)[\s\S]{0,500}(?:body|响应体)/i,
  'an existing client error response must be forwarded rather than replaced by a Service error',
);
assert.match(
  serviceContracts,
  /record-write-permission[\s\S]{0,240}records\/bulk[\s\S]{0,240}(?:existing|既有|established)[\s\S]{0,320}(?:do not|must not|不得|不能)[\s\S]{0,240}(?:successful (?:or|and) failed response|成功与失败响应|success and error|完整响应)/i,
  'the established action response contracts must not be changed by the direct-proxy rule',
);
const serviceVersion = serviceSkill.match(/metadata:\s*\n\s*version:\s*(\d+)\.(\d+)\.(\d+)/);
assert.ok(serviceVersion, 'make-app-service 必须声明版本');
const [serviceMajor, serviceMinor, servicePatch] = serviceVersion.slice(1).map(Number);
assert.ok(
  serviceMajor > 0 || serviceMinor > 2 || (serviceMinor === 2 && servicePatch >= 4),
  'make-app-service 必须保留 0.2.4+ 的发布基线，允许后续兼容修订',
);
assert.match(
  serviceContracts,
  /## Default route response modes[\s\S]{0,1800}\/api\/make\/app\/principal\/permission[\s\S]{0,240}(direct Make proxy|直接 Make 代理)[\s\S]{0,1800}\/api\/schema[\s\S]{0,240}(non-proxy|非代理)/i,
  'default route baseline must classify permission as a direct proxy and schema as a non-proxy route',
);
assert.match(
  serviceContracts,
  /\/api\/entities\/:entityKey\/records[\s\S]{0,240}(non-proxy|非代理)/i,
  'default route baseline must classify record normalization routes explicitly',
);
assert.match(
  serviceContracts,
  /Make file download proxy[\s\S]{0,240}Content-Type[\s\S]{0,240}Content-Disposition/i,
  'file download passthrough must preserve Content-Disposition as well as Content-Type',
);
assert.match(
  serviceTesting,
  /(200|2xx)[\s\S]{0,700}(403|4xx)[\s\S]{0,700}(500|5xx)[\s\S]{0,700}(JSON|json)[\s\S]{0,700}(text|文本)[\s\S]{0,700}(binary|二进制)/i,
  'Service tests must cover full passthrough for success, permission, server-error, JSON, text, and binary responses',
);
assert.match(
  serviceLayering,
  /(browser-facing|浏览器)[\s\S]{0,700}(safe|安全|sensitive|敏感)[\s\S]{0,700}(upstream|上游|Make)[\s\S]{0,700}(error|错误)/i,
  'Service layering must require browser-safe upstream error bodies before transparent forwarding',
);
assert.match(
  authSkill,
  /metadata:\s*\n\s*version:\s*0\.1\.12/,
  'make-app-auth must include the default Trace ID handoff',
);
assert.match(
  authRequestAdapter,
  /SDK owns the normal unified-login 401\/403 redirect/i,
  'the SDK must retain the established unified-login redirect handling for 401 and 403',
);
assert.match(
  authLogoutAnd401,
  /(401\/403|401、403|401 and 403)[\s\S]{0,500}(redirect|登录)/i,
  '401 and 403 must retain the established SDK redirect guidance',
);
assert.doesNotMatch(
  serviceContracts,
  /failed auth checks should return a stable 5xx\/contracted error/i,
  'Service contracts must not replace a completed Make auth response with a stable 5xx error',
);
// The authority can be reorganized without moving semantic rules back into every consumer reference.
requireContract(boundaries, [
  /v3\.0\.0/, /2026-08-04/, /Decision[\s\S]*Plan/, /raw[\s\S]*principal/i,
  /Statement[\s\S]*named[\s\S]*baseline/i,
  /across Statements[\s\S]*strictest/i,
  /hidden\s*>\s*fullMask\s*>\s*partialMask\s*>\s*readonly\s*>\s*editable/,
  /raw[\s\S]*(?:provenance|grouping)/i,
  /within and across rows/i,
  /readonly[\s\S]*partialMask[\s\S]*(?:array|数组)/i,
  /(?:whole|entire|整单)[\s\S]*(?:update|mutation|更新)/i, /422/,
], 'permission authority must distinguish trusted v3 evaluation from conservative raw compatibility and whole-write rejection');
requireContract(permissionBundle, [
  /meta\.entity\.read/, /meta\.field\.read/, /data\.record\.read/,
  /(?:navigation|导航)/i, /(?:headers|表头)/i, /(?:independent|独立)/i,
  /legacy[\s\S]*createFields[\s\S]*meta\.field\.read/i,
  /data\.record\.create/, /creatable/, /meta\.field\.create[^\n]*(?:exists|存在)/i,
  /(?:deny[^\n]*wins|拒绝优先)/i,
], 'permission docs must preserve independent navigation, field metadata, records and legacy creation');
assert.doesNotMatch(permissionBundle,
  /(?:create|edit|manage) (?:back-office )?(?:policies|permission groups) (?:in|from) the (?:UI|browser)/i,
  'frontend guidance must not manage back-office policy configuration');
for (const expectedValue of [
  'Make.Field.ID',
  'IDField',
  'create_user',
  'create_time',
  'update_user',
  'update_time',
  'qfei_create_user',
  'qfei_create_time',
  'qfei_update_user',
  'qfei_update_time',
]) {
  assert.match(
    permissionBundle,
    new RegExp(expectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `system field contract must include ${expectedValue}`,
  );
}
assert.match(
  permissionBundle,
  /permission-conformance-suite\.mjs[\s\S]{0,500}(adapter|适配器)/i,
  'testing reference must require the executable permission conformance suite',
);
requireContract(permissionBundle, [
  /(?:default test|默认测试|CI|publish gate|发布校验)/i,
  /audit-make-app-permission\.mjs/,
  /permission-conformance-suite\.mjs/,
  /(?:adapter|适配器)/i,
  /check-installed-skill-sync\.mjs/,
  /source[-_]only/, /installed[-_]only/, /content[-_]mismatch/,
  /npx skills update\s+qfeius\/make-platform-skills/,
  /check-installed-make-platform-skills-sync\.mjs/,
], 'reachable verification guidance must expose host checks and the separate complete installed-Skill release comparison');
requireContract(permissionBundle, [
  /(?:create|新建)/i, /(?:visibility|visible|可见)/i, /(?:editability|editable|可编辑)/i,
  /(?:separate|independent|独立)/i,
  /createFields[\s\S]*(?:missing|缺失|missing\/null)[\s\S]*(?:empty|空|\[\])/i,
  /(?:no fallback|never falls back|不回退)/i,
  /editableFields[\s\S]*(?:ignore|ignored|忽略)/i,
  /(?:exclude|排除)[\s\S]*(?:ID|audit|审计)/i,
  /(?:audit|审计)[\s\S]*(?:edit|editable|编辑)[\s\S]*(?:remain|preserve|keep|保留)/i,
  /canCreateEntityField/, /creatableFieldKeysForEntity/,
  /(?:submit|提交)[\s\S]*(?:allowlist|白名单)/i,
  /(?:DevTools|inject|注入)/i,
  /refreshPermissions[\s\S]*(?:refreshSchema|invalidateSchema|Schema cache|Schema 缓存|schema generation)/i,
  /Make\.Field\.File/, /recordID/, /(?:pre-upload|预上传)/i, /(?:attachment array|附件数组)/i,
  /Make\.Field\.Lookup/, /lookup-options/, /qfei_relation/, /lookup-relations/,
  /ordinaryAllowlistedData/, /relations/, /(?:reject|拒绝)[\s\S]*data\.qfei_relation/i,
  /(?:target|目标)[\s\S]*(?:visible|可见)[\s\S]*fields/i,
], 'reachable consumer guidance must preserve Schema separation, payload allowlists, refresh and File/Lookup boundaries');
assert.match(
  componentUsage,
  /field\.validations\.isRequired[\s\S]{0,400}required[^\n]*(prop|属性)/i,
  'makeui must define validations.isRequired as the Schema source for the required UI prop',
);

const principalExample = JSON.parse([...permissionBundle.matchAll(/```json\n([\s\S]*?)\n```/g)].find((match) => match[1].includes('"permissions"'))[1]);
const principalRow = (key) => principalExample.permissions.find((row) => row.permissionKey === key);
assert.deepEqual(principalRow('data.record.create').fieldAccess, {});
assert.equal(principalRow('data.record.update').fieldAccess.editable_field, 'editable');
assert.equal(principalRow('data.record.read').fieldAccess.editable_field, 'editable');
assert.equal(principalRow('meta.field.read').fieldAccess.editable_field, 'editable');
assert.equal(principalRow('meta.field.read').fieldAccess.create_only_field, 'creatable');

requireContract(permissionBundle, [
  /data\.record\.create/, /data\.record\.read/, /data\.record\.update/, /data\.record\.bulkUpdate/,
  /meta\.field\.read/, /(?:legacy|历史)/i, /(?:independent|separate|独立)/i,
], 'all field surfaces must retain their independent record gates and metadata boundary');
assert.doesNotMatch(permissionBundle, /meta\.field\.create[^\n]*(?:not a platform permission point|不是平台权限点)/i,
  'metadata-create permission must not be described as nonexistent');
assert.match(
  serviceBundle,
  /fields[\s\S]{0,500}createFields[\s\S]{0,700}(independent|separate|独立|分别)/i,
  'make-app-service must normalize fields and createFields independently',
);
assert.match(
  serviceBundle,
  /(principal|主体|user|用户)[^\n]*(cache|缓存)[^\n]*(isolate|隔离|不得.*共享|跨)/i,
  'permission-trimmed schema caches must be isolated by principal',
);
assert.match(
  serviceBundle,
  /(createFields)[^\n]*(missing|缺失)[^\n]*(empty|空)[^\n]*(no fallback|不回退)/i,
  'make-app-service must fail closed when createFields is missing',
);

assert.match(
  makeuiBundle,
  /(create|新建)[^\n]*(createFields|create field set|可新建字段集合)[\s\S]{0,500}(edit|编辑)[^\n]*(visible|可见)[^\n]*(editable|可编辑)/i,
  'makeui must hand create and edit forms different permission-derived field sets',
);
assert.match(
  componentUsage,
  /(required|必填)[^\n]*(rendered|渲染|authorized|授权|可新建|可编辑)/i,
  'required validation must only apply to rendered authorized fields',
);
assert.match(
  makeuiBundle,
  /(no creatable fields|无可新建字段|暂无可新建字段)[\s\S]{0,400}(empty|空状态|disabled|禁用)/i,
  'makeui must define the no-creatable-fields form state',
);

assert.match(
  readme,
  /(可新建|creatable|createFields)[^\n]*`make-app-permission`|`make-app-permission`[^\n]*(可新建|creatable|createFields)/i,
  'README routing must send creatable/createFields tasks to make-app-permission',
);
assert.match(
  agentMetadata,
  /(create|creatable|新建)[^\n]*(read|visible|可见)[^\n]*(update|edit|可编辑)/i,
  'agent metadata must advertise the complete create/read/update field chain',
);
console.log('make-app creatable permission contract passed');
