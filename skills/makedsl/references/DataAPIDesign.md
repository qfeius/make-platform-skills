# Data Service API 设计

## 能力

需要提供 DSL 的 CRUD-LS (Create, Read, Update, Delete, List, Status) 操作

## 术语说明

Entity 可以理解是一张 Table, Record 可以理解是一个 Row, 也就是 Entity 的一条实际记录

## 约束

如果是开放的 API 开放平台域名需要符合这里面的规范

```
https://dev-make.qtech.cn/api/make
```

## JSON-RPC 接口

AI 使用 DataAPI
开放平台使用
多语言的 SDK

## 设计思路

- **HTTP 方法永远是 POST, 下载文件(FileField)是一个例外**
- **Action 不在路径里，在 `X-Make-Target` header 里面**

可选 value：
- `MakeService.CreateResource`
- `MakeService.GetResource`
- `MakeService.UpdateResource`
- `MakeService.DeleteResource`
- `MakeService.StatusResource`
- `MakeService.ListResources`

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
  "app": <NAME>,
  "entity": <NAME>,
  "data" : {
      "name": "张三",    
      "hobby": ["xxx", "yyy"],    
      "field_name_3": "2026-02-24"
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Create record success",
  "data" : {
    "recordID": "xxxx"
  } 
}
```

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
     {"recordID": "record_id_1", "code": 200, "msg": "delete success"},
     {"recordID": "record_id_2", "code": 400, "msg": "Permission denied"}
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
  "app": <NAME>,
  "entity": <NAME>,
  "recordID": "xxxx",
  "data" : {
      "field_name_1": "张三",    
      "field_name_2": 100,    
      "field_name_3": "2026-02-24"
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Update record success",
  "data" : {
    "recordID": "xxxx"
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
  "app": <NAME>,
  "entity": <NAME>,
  "recordIDList" : ["record_id_1", "record_id_2", "record_id_3"],
  "data": {
      "field": "value",   // 负责人 = 张三
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Update record success",
  "data" : {
    "recordID": "xxxx"
  } 
}
```

### 获取单条 Record 数据

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
  "app": <NAME>,
  "entity": <NAME>,
  "recordID": "xxxx"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Get record success",
  "data" : {
    "recordID": "xxxx",
    "employee": {
      "recordID": "employee_record_id_1",
      "name" : "张三",
      "age" : 18
    },    
    "field_name_2": 100,    
    "field_name_3": "2026-02-24"
  } 
}
```

为避免循环依赖，限制只展开一层

### 分页查询 Record 数据

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

```json
{
  "app": <NAME>,
  "entity": <NAME>,
  "fields": ["id", "name", "email", "createdAt"], // 为空就默认全部
  "filter": {},
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
    "recordID": "xxxx",
    "field_name_1": "张三",    
    "field_name_2": 100,    
    "field_name_3": "2026-02-24"
  },
  {...}
   ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

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
  "recordID": "rec_xxx",
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
    "recordID": "rec_xxx",
    "invoice": {
      "fileName": "${sha1}.pdf",
      "filePath": "${org}/${app}/${name}",
      "fileSizeInBytes": 1048576,
      "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
    }
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
  "recordID": "rec_xxx",
  "field": "invoice"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "get file success",
  "data": {
    "recordID": "rec_xxx",
    "invoice": {
      "fileName": "${sha1}.pdf",
      "filePath": "${org}/${app}/${name}",
      "fileSizeInBytes": 1048576,
      "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
    }
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
  "recordID": "rec_xxx",
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
