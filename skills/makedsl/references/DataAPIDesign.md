# Data Service API 设计

## 能力

需要提供 DSL 的 CRUD-LS (Create, Read, Update, Delete, List, Status) 操作

## 术语说明

Entity 可以理解是一张 Table, Record 可以理解是一个 Row, 也就是 Entity 的一条实际记录

## 约束

- 如果两个`Entity`存在 `Relation` 关系，则在添加或更新数据时需要用 `data.qfei_relation` 传递参数。`Relation` 建模方式见 @RelationDesign.md
- `qfei_relation` 的数组项格式固定为 `{ "entity": "<关联对象名称>", "id": "<关联 recordID>" }`
- 禁止在一个`Entity`中定义与另一个`Entity`语义相同的字段。
- 禁止通过自定义关联Id字段来描述两个`Entity`的关系，如果在一个`Entity`中需要展示另一个`Entity`的字段数据，则必须使用 `LookupField` 实现。规则详见 @FieldDesign.md
- 禁止通过前端实现 `Record` 数据列表过滤功能，必须使用后端接口`MakeService.ListResources`的`filter`参数，详见：@EntityDataFilterUsage.md

## JSON-RPC 接口

AI 使用 DataAPI
开放平台使用
多语言的 SDK

## 设计思路

- **HTTP 方法永远是 POST, 下载文件(FileField)是一个例外**
- **Action 不在路径里，在 `X-Make-Target` header 里面**

Action 不在路径里，在 `X-Make-Target` header 里面，可选 value 是:

```
MakeService.CreateResource
MakeService.GetResource
MakeService.UpdateResource
MakeService.DeleteResource
MakeService.StatusResource
MakeService.ListResources
```

Request Body 是 JSON  
**!!!注意有个例外的情况: 上传文件(`api/make/data/v1/file`)是`Content-Type: multipart/form-data`**  
Response Body 格式如下：  

单条数据 Response Body 格式

```json
{
  "code": 200,
  "msg": "xxx",
  "data" : {} 
}
```

批量数据 Response Body 格式

```json
{
  "code": 200,
  "msg": "xxx",
  "data" : [
     {}
  ]
}
```

分页查询 Response Body 格式

```json
{
  "code": 200,
  "msg": "xxx",
  "data": [{}],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

说明：

- 成功时 `code` 固定为 `200`
- `msg` 是示例性文案，不建议把具体文案当成强约束
- 分页查询会额外返回 `pagination`

## 接口

### 创建 Record 数据

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
  "entity": "<NAME>",
  "data": {
    "name": "张三",
    "hobby": ["xxx", "yyy"],
    "date_field": "2026-02-24",
    "datetime_field": "2026-02-24 17:00:00",
    "qfei_relation": [
      {
        "entity": "档案",
        "id": "123"
      }
    ]
  }
}
```

其中：

- `entity` 表示对端的 Entity 名称
- `id` 表示对端记录的 `recordID`

Response Body

```json
{
  "code": 200,
  "msg": "Create record success",
  "data": {
    "recordID": "1"
  }
}
```

说明：

- `recordID` 固定是 string 类型

### 批量删除 Record

单个删除也用批量删除的接口来

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.DeleteResource
```

Request Body

```json
{
  "app": <NAME>,
  "entity": <NAME>,
  "recordIDList": ["record_id_1", "record_id_2"]
}
```

Response Body

```json
{
  "code": 200,
  "msg": "delete record success",
  "data" : [
     {"recordID": "1", "code": 200, "msg": "delete success"},
     {"recordID": "2", "code": 400, "msg": "Permission denied"}
  ]
}
```

### 单条更新 Record 数据

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.UpdateResource
```

Request Body

```json
{
  "app": "<NAME>",
  "entity": "<NAME>",
  "recordID": "1",
  "data": {
    "field_name_1": "张三",
    "field_name_2": 100,
    "date_field": "2026-02-24",
    "datetime_field": "2026-02-24 17:00:00",
    "qfei_relation": [
      {
        "entity": "档案",
        "id": "123"
      }
    ]
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Update record success",
  "data" : {
    "recordID": "1"
  } 
}
```

### 批量更新一列数据

```
POST https://dev-make.qtech.cn/api/make/data/v1/field
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.UpdateResource
```

Request Body

```json
{
  "app": "<NAME>",
  "entity": "<NAME>",
  "recordIDList": ["1", "2", "3"],
  "data": {
    "field_name_1": "张三",
    "field_name_2": 100,
    "date_field": "2026-02-24",
    "datetime_field": "2026-02-24 17:00:00",
    "qfei_relation": [
      {
        "entity": "档案",
        "id": "123"
      }
    ]
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Update record success",
  "data" : {
    "recordID": "1"
  } 
}
```

### 获取单条 Record 数据

查询结果理解规则

- `recordID` 固定是 string 类型
- `data` 是单个 Record 对象，业务字段的 key 就是字段 key，不是固定 DTO
- `fields` 为空时默认返回全部字段；传了 `fields` 时只保证返回所选字段

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
  "entity": "<NAME>",
  "fields": [
    "orderNo",
    "projectName",
    "projectDescription",
    "projectContent",
    "website",
    "score",
    "budget",
    "completionRate",
    "startDate",
    "createdAt",
    "deliveryPeriod",
    "status",
    "tags",
    "locationPath",
    "attachments"
  ],
  "recordID": "1"
}
```

说明：

- `fields` 可选；为空时表示返回该对象的全部字段

Response Body

```json
{
  "code": 200,
  "msg": "Get record success",
  "data": {
    "recordID": "1",
    "orderNo": "SO-2026-0001",
    "projectName": "智能客服升级",
    "projectDescription": "升级 FAQ 与工单联动能力",
    "projectContent": "<p>需要支持富文本说明</p>",
    "website": "https://example.com/projects/1",
    "score": 95.5,
    "budget": "¥1,999.00",
    "completionRate": "85.00%",
    "startDate": "2026-02-24",
    "createdAt": "2026-02-24 17:00:00",
    "deliveryPeriod": {
      "begin": "2026-02-24",
      "end": "2026-03-31"
    },
    "status": [
      {
        "label": "进行中",
        "value": "in_progress"
      }
    ],
    "tags": [
      {
        "label": "紧急",
        "value": "urgent"
      },
      {
        "label": "对外",
        "value": "external"
      }
    ],
    "locationPath": [
      {
        "label": "中国",
        "value": "china"
      },
      {
        "label": "上海",
        "value": "shanghai"
      }
    ],
    "attachments": [
      {
        "fileName": "proposal.pdf",
        "filePath": "8/demo-app/project/proposal.pdf",
        "fileURL": "https://cdn.example.com/proposal.pdf",
        "fileSizeInBytes": 102400
      }
    ]
  }
}
```

说明：

- `msg` 是示例性文案，不建议依赖具体文本
- 上面的示例展示的是“稳定可依赖”的查询结果结构；如果字段类型不同，返回结构也会不同，详见：`常规字段类型返回结构示例` 和 `派生字段类型返回结构示例`

### 分页查询 Record 数据

分页结果理解规则

- `data` 是 Record 对象数组，每个元素的字段结构与 `GetResource.data` 一致
- 分页查询比单条查询多一个 `pagination`，其中 `page`、`size`、`total` 分别表示当前页、页大小、总条数
- `fields`、字段类型解释、选项类字段结构与单条查询完全一致
- `filter` 筛选参数使用参考 @EntityDataFilterUsage.md

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <MAKE_API_TOKEN>
  X-Make-Target: MakeService.ListResources
```

Request Body

```json
{
  "app": "<NAME>",
  "entity": "<NAME>",
  "fields": [
    "orderNo",
    "projectName",
    "projectDescription",
    "projectContent",
    "website",
    "score",
    "budget",
    "completionRate",
    "startDate",
    "createdAt",
    "deliveryPeriod",
    "status",
    "tags",
    "locationPath",
    "attachments"
  ],
  "filter": {},
  "sort": [
    { "field": "createdAt", "order": "desc" },
    { "field": "orderNo", "order": "asc" }
  ],
  "pagination": { "page": 1, "size": 10 }
}
```

说明：

- `sort.field` 使用字段 key，不是字段名称
- `pagination.page` 从 `1` 开始
- 如果不传 `fields`，返回结果默认包含全部字段

Response Body

```json
{
  "code": 200,
  "msg": "List records success",
  "data": [
    {
      "recordID": "1",
      "orderNo": "SO-2026-0001",
      "projectName": "智能客服升级",
      "projectDescription": "升级 FAQ 与工单联动能力",
      "projectContent": "<p>需要支持富文本说明</p>",
      "website": "https://example.com/projects/1",
      "score": 95.5,
      "budget": "¥1,999.00",
      "completionRate": "85.00%",
      "startDate": "2026-02-24",
      "createdAt": "2026-02-24 17:00:00",
      "deliveryPeriod": {
        "begin": "2026-02-24",
        "end": "2026-03-31"
      },
      "status": [
        {
          "label": "进行中",
          "value": "in_progress"
        }
      ],
      "tags": [
        {
          "label": "紧急",
          "value": "urgent"
        },
        {
          "label": "对外",
          "value": "external"
        }
      ],
      "locationPath": [
        {
          "label": "中国",
          "value": "china"
        },
        {
          "label": "上海",
          "value": "shanghai"
        }
      ],
      "attachments": [
        {
          "fileName": "proposal.pdf",
          "filePath": "8/demo-app/project/proposal.pdf",
          "fileURL": "https://cdn.example.com/proposal.pdf",
          "fileSizeInBytes": 102400
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

说明：

- 分页查询中的每条元素结构与单条查询的 `data` 完全一致，只是顶层从对象变成数组，数组中的单条数据根据字段类型不同，返回结构也会不同，详见：`常规字段类型返回结构示例` 和 `派生字段类型返回结构示例`
- `pagination.total` 表示满足当前筛选条件的总记录数，而不是当前页记录数


### 上传文件

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  X-Make-Target: MakeService.CreateResource
  Content-Type: multipart/form-data
```

Request Body (multipart/form-data)

```
--boundary
Content-Disposition: form-data; name="meta"
Content-Type: application/json

{
  "app": "烽火项目管理",
  "entity": "项目文档",
  "recordID": "1",
  "field": "invoice"
}
--boundary
Content-Disposition: form-data; name="file"; filename="发票.pdf"
Content-Type: application/pdf
<binary>
--boundary--
```

Response Body

```json
{
  "code": 200,
  "msg": "upload file success",
  "data": {
    "recordID": "1",
    "invoice": [
      {
        "fileName": "realName1.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 1048576,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```

### 获取文件信息(包含文件下载地址)

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.GetResource
```

Request Body

```json
{
  "app": "烽火项目管理",
  "entity": "项目文档",
  "recordID": "1",
  "field": "invoice"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "get file success",
  "data": {
    "recordID": "1",
    "invoice": [
      {
        "fileName": "realName1.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 1048576,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```

### 删除文件
!!! 注意在实现的时候, 不要删除tos 的文件, 直接情况 fileURL 即可.

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.DeleteResource
```

Request Body

```json
{
  "app": "烽火项目管理",
  "entity": "项目文档",
  "recordID": "1",
  "field": "invoice",
  "fileName": "89beb655c86b3794f72faf5fed8392ef97a7db93.md"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "delete file success",
  "data": {}
}
```

## 单条记录与列表读取的选型规则

在 Make Data API 中，单条读取与列表读取必须严格区分。

### 单条记录读取
当以下条件成立时，必须使用 `MakeService.GetResource`：
- 已知目标实体
- 已知目标 `recordID`
- 目标是获取一条记录本身，而不是一个集合

禁止使用以下实现方式替代：
- 先调用 `MakeService.ListResources`
- 再在返回结果中按 `recordID` 过滤目标记录

### 列表读取
只有在以下场景中，才应使用 `MakeService.ListResources`：
- 需要返回多条记录
- 需要分页、搜索、筛选、排序
- 尚未知道具体 `recordID`
- 需要读取某个主记录下的关联集合

### 详情接口规则
实现详情接口时，必须遵循以下拆分：
- 主对象本体：使用 `GetResource(recordID)`
- 关联对象集合：按需单独查询并聚合
- 不允许通过扫描主对象整表来获取详情页本体数据

### 优先级
如果代码里尚未封装单条读取方法：
- 优先新增 `GetResource` 封装
- 不要因为“目前只有列表封装”就退回到整表扫描方案


## 常规字段类型返回结构示例

| 字段类型            | 返回结构示例                                                                                                                                                 | agent 使用提示                  |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|
| `Make.Field.ID`            | `"SO-2026-0001"`                                                                                                                                       | 按 string 理解，不要当作数值自增主键      |
| `Make.Field.Text`          | `"智能客服升级"`                                                                                                                                             | 单行文本                        |
| `Make.Field.TextArea`     | `"升级 FAQ 与工单联动能力"`                                                                                                                                     | 多行文本，仍按 string 处理           |
| `Make.Field.URL`           | `"https://example.com/projects/1"`                                                                                                                     | URL 字符串                     |
| `Make.Field.Number`        | `95.5`                                                                                                                                                 | 按 number 处理                 |
| `Make.Field.Currency`      | `"¥1,999.00"`                                                                                                                                          | 已带货币符号，按 string 展示          |
| `Make.Field.Percent`       | `"85.00%"`                                                                                                                                             | 已带 `%`，按 string 展示          |
| `Make.Field.Date`          | `"2026-02-24"`                                                                                                                                         | 按 string 理解                 |
| `Make.Field.DateTime`     | `"2026-02-24 17:00:00"`                                                                                                                                | 按 string 理解                 |
| `Make.Field.DateRange`    | `{"begin":"2026-02-24","end":"2026-03-31"}`                                                                                                            | 固定对象结构                      |
| `Make.Field.SingleSelect` | `[{"label":"进行中","value":"in_progress"}]`                                                                                                              | 单选也返回数组，通常只有一个元素，label只负责展示 |
| `Make.Field.MultiSelect`  | `[{"label":"紧急","value":"urgent"},{"label":"对外","value":"external"}]`                                                                                  | 多选返回数组                      |
| `Make.Field.File`          | `[{"fileName":"proposal.pdf","filePath":"8/demo-app/project/proposal.pdf","fileURL":"https://cdn.example.com/proposal.pdf","fileSizeInBytes":102400}]` | 文件字段返回附件数组                  |

## 派生字段类型返回结构示例

### Make.Field.Lookup | 查找字段

```json
{
  "<lookupFieldName>": {
    "entity": "<目标对象名称>",
    "field": "<目标字段名称>",
    "data": [
      {
        "recordID": "<关联记录ID，字符串>",
        "isDeleted": false,
        "value": "<按目标字段类型格式化后的值>"
      }
    ]
  }
}
```

说明：
- `isDeleted` 表示此条关联数据是否已经被删除
- `data[*].value` 返回的数据结构参考 `常规字段类型返回结构示例`
