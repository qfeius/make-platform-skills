# DepartmentField

DepartmentField 用于在业务 Record 中存储和关联组织部门信息，常见场景包括所属部门、协作部门、审批部门、可见部门。

DepartmentField 的字段类型定义以 `@FieldDesign.md` 为准：

- `Make.Field.SingleDepartment`：单选部门，Record 中存储单个 Department 对象或 `null`
- `Make.Field.MultiDepartment`：多选部门，Record 中存储 Department 对象数组，空值为 `[]`

Department 数据结构以 `@DepartmentInfo.md` 为准。本文只描述 DepartmentField 和 DataAPI、Record 之间的使用关系，不重复维护完整 DepartmentInfo 字段清单。

## Department 字段的流程

1. 先创建 Entity，并在 Entity 中声明 SingleDepartmentField 或 MultiDepartmentField。
2. 用户填写字段时，客户端调用 DataAPI 分页查询 Department 数据，作为部门选择器的候选项。
3. 用户选择后，客户端把选中的 Department 对象写入 Record。
4. 创建或更新 Record 时，服务端校验部门是否存在、是否属于当前组织、是否在当前访问者权限范围内。
5. 客户端获取 Record 时，DepartmentField 返回已保存的 Department 对象或对象数组。

## 例子

### 业务场景

我需要创建一个项目，项目包含 `projectName`、`ownerDepartment`、`relatedDepartments`：

- `ownerDepartment` 是单选部门字段，表示项目所属部门。
- `relatedDepartments` 是多选部门字段，表示协作部门。

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

    - name: ownerDepartment
      type: Make.Field.SingleDepartment
      meta:
        version: 1.0.0
      properties: null
      validations:
        isRequired: true

    - name: relatedDepartments
      type: Make.Field.MultiDepartment
      meta:
        version: 1.0.0
      properties:
        maxCount: 10
      validations:
        isRequired: false
```

#### Step 2: 分页查询 Department 数据

用户填写 `ownerDepartment` 或 `relatedDepartments` 时，客户端通过 Department 分页查询接口获取候选部门。

```
POST https://dev-make.qtech.cn/api/make/data/v1/department
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

`filter` 当前仅支持按 `departmentName` 过滤筛选；不支持通过 `departmentId`、`orgId`、`memberCount`、`platform` 等其它字段过滤。

```json
{
  "fields": ["orgId", "departmentId", "departmentName", "memberCount", "platform"],
  "filter": [
    {
      "departmentName": { "contains": "产品研发" }
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
      "departmentId": "2226",
      "departmentName": "测试部门重复",
      "memberCount": 10,
      "orgId": 3,
      "platform": 1,
      "leader": null,
      "children": []
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

用户选择候选项后，客户端将选中的 Department 对象写入 Record。

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
    "ownerDepartment": {
      "departmentId": "2226",
      "departmentName": "测试部门重复",
      "memberCount": 10,
      "orgId": 3,
      "platform": 1,
      "leader": null,
      "children": []
    },
    "relatedDepartments": [
      {
        "departmentId": "2227",
        "departmentName": "重复部门",
        "memberCount": 0,
        "orgId": 3,
        "platform": 1,
        "leader": null,
        "children": []
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

#### Step 4: 获取 Record 验证部门字段已关联

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
    "ownerDepartment": {
      "departmentId": "2226",
      "departmentName": "测试部门重复",
      "memberCount": 10,
      "orgId": 3,
      "platform": 1,
      "leader": null,
      "children": []
    },
    "relatedDepartments": [
      {
        "departmentId": "2227",
        "departmentName": "重复部门",
        "memberCount": 0,
        "orgId": 3,
        "platform": 1,
        "leader": null,
        "children": []
      }
    ]
  }
}
```

## 约束

- SingleDepartmentField 非必填时可以写入 `null`；必填时不能为 `null`。
- MultiDepartmentField 非必填时可以写入 `[]`；必填时数组不能为空。
- MultiDepartmentField 通过 `maxCount` 控制最多可选择的部门数量，默认值以 `@FieldDesign.md` 为准。
- MultiDepartmentField 中同一个 `departmentId` 不允许重复出现。
- 写入 Record 的部门必须来自 Department 分页查询接口返回的当前组织可见部门。
- 分页查询 Department 候选项时，`filter` 仅支持 `departmentName` 字段。
- 部门不存在、已删除、不可见或不属于当前组织时，创建或更新 Record 应失败。
- DepartmentField 不支持通过 `departmentName` 作为唯一标识写入，避免重名造成歧义。
- `children` 只作为部门树快照返回，不作为组织架构变更来源；创建或更新 Record 时不要求提交完整子树。
