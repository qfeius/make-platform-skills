# UserField

UserField 用于在业务 Record 中存储和关联组织内用户信息，常见场景包括负责人、协作人、审批人、参与成员。

UserField 的字段类型定义以 @FieldDesign.md 为准：

- `Make.Field.SingleUser`：单选用户，Record 中存储单个 User 对象或 `null`
- `Make.Field.MultiUser`：多选用户，Record 中存储 User 对象数组，空值为 `[]`

User 数据结构以 @UserInfo.md 为准。本文只描述 UserField 和 DataAPI、Record 之间的使用关系，不重复维护完整 UserInfo 字段清单。

## User 字段的流程

1. 先创建 Entity，并在 Entity 中声明 SingleUserField 或 MultiUserField。
2. 用户填写字段时，客户端调用 DataAPI 分页查询 User 数据，作为用户选择器的候选项。
3. 用户选择后，客户端把选中的 User 对象写入 Record。
4. 创建或更新 Record 时，服务端校验用户是否存在、是否属于当前组织、是否在当前访问者权限范围内。
5. 客户端获取 Record 时，UserField 返回已保存的 User 对象或对象数组。

## 例子

### 业务场景

我需要创建一个项目，项目包含 `projectName`、`owner`、`members`：

- `owner` 是单选用户字段，表示项目负责人。
- `members` 是多选用户字段，表示项目成员。

#### Step 1: 创建 Entity

需要创建一个 Project(项目) 的 Entity。

```yaml
name: 项目
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: projectName
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
      validations:
        isRequired: true

    - name: owner
      type: Make.Field.SingleUser
      meta:
        version: 1.0.0
      properties: null
      validations:
        isRequired: true

    - name: members
      type: Make.Field.MultiUser
      meta:
        version: 1.0.0
      properties:
        maxCount: 20
      validations:
        isRequired: false
```

#### Step 2: 分页查询 User 数据

用户填写 `owner` 或 `members` 时，客户端通过 User 分页查询接口获取候选用户。

```
POST https://dev-make.qtech.cn/api/make/data/v1/user
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

`filter` 当前仅支持按 `userName` 过滤筛选；不支持通过 `userId`、`email`、`mobile`、`departmentPath` 等其它字段过滤。

```json
{
  "fields": ["userId", "orgId", "userName", "avatarOrigin", "departmentPath", "platform", "status"],
  "filter": [
    {
      "userName": { "contains": "殷" }
    }
  ],
  "sort": [
    { "field": "createdAt", "order": "desc" },
    { "field": "id", "order": "asc" }
  ],
  "pagination": { "page": 1, "size": 10 }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "query record success",
  "data": [
    {
      "userId": 19035,
      "orgId": 31379,
      "userName": "殷利强",
      "avatarOrigin": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp",
      "departmentPath": "智书企飞 |官方认证服务商/产品研发中心/RD & Customer Value/UED Tech",
      "platform": "2",
      "status": 0
    }
  ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

#### Step 3: 创建 Record

用户选择候选项后，客户端将选中的 User 对象写入 Record。

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.CreateResource
```

Request Body

```json
{
  "app": "<NAME>",
  "entity": "项目",
  "data": {
    "projectName": "烽火项目管理",
    "owner": {
      "userId": 19035,
      "orgId": 31379,
      "userName": "殷利强",
      "avatarOrigin": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp",
      "departmentPath": "智书企飞 |官方认证服务商/产品研发中心/RD & Customer Value/UED Tech",
      "platform": "2",
      "status": 0
    },
    "members": [
      {
        "userId": 19035,
        "orgId": 31379,
        "userName": "殷利强",
        "avatarOrigin": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp",
        "departmentPath": "智书企飞 |官方认证服务商/产品研发中心/RD & Customer Value/UED Tech",
        "platform": "2",
        "status": 0
      }
    ]
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Create record success",
  "data": {
    "recordID": "rec_abc123"
  }
}
```

#### Step 4: 获取 Record 验证用户字段已关联

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.GetResource
```

Request Body

```json
{
  "app": "<NAME>",
  "entity": "项目",
  "recordID": "rec_abc123"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Get record success",
  "data": {
    "recordID": "rec_abc123",
    "projectName": "烽火项目管理",
    "owner": {
      "userId": 19035,
      "orgId": 31379,
      "userName": "殷利强",
      "avatarOrigin": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp",
      "departmentPath": "智书企飞 |官方认证服务商/产品研发中心/RD & Customer Value/UED Tech",
      "platform": "2",
      "status": 0
    },
    "members": [
      {
        "userId": 19035,
        "orgId": 31379,
        "userName": "殷利强",
        "avatarOrigin": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp",
        "departmentPath": "智书企飞 |官方认证服务商/产品研发中心/RD & Customer Value/UED Tech",
        "platform": "2",
        "status": 0
      }
    ]
  }
}
```

## 约束

- SingleUserField 非必填时可以写入 `null`；必填时不能为 `null`。
- MultiUserField 非必填时可以写入 `[]`；必填时数组不能为空。
- MultiUserField 通过 `maxCount` 控制最多可选择的用户数量，默认值以 @FieldDesign.md 为准。
- MultiUserField 中同一个 `userId` 不允许重复出现。
- 写入 Record 的用户必须来自 User 分页查询接口返回的当前组织可见用户。
- 禁止通过前端实现 User 数据过滤功能，必须使用后端接口`filter`参数实现。
- 分页查询 User 候选项时，`filter` 仅支持 `userName` 字段。
- 用户不存在、已停用、不可见或不属于当前组织时，创建或更新 Record 应失败。
- UserField 不支持通过 `userName` 作为唯一标识写入，避免重名造成歧义。
- 返回 UserField 时，服务端应根据访问者权限裁剪敏感字段。
