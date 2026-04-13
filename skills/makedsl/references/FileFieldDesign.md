# FileField
我们目前 FileField 在业务上是用于业务可以上传图片/PDF 等各种文件

## File 字段的流程
1. 先创建 Entity -> FileField
2. 创建一个 Record, 然后会得到 Record id
3. 根据 Record id 上传文件
4. 上传成功会返回文件的地址, 也会同时自动更新 FileField 中的地址
5. 客户端可以根据 FileField 中的 fileURL 通过 GET 直接下载 

## 例子
### 业务场景
我需要提交一个发票报销, 需要包含的内容 `amount`, `invoice`
#### Step 1: 创建 Entity
需要创建一个 Reimbursement(报销) 的 Entity
```yaml
name: 报销单
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: amount
      type: Make.Field.Currency
      meta:
        version: 1.0.0
      properties:
        symbol: "¥"
        decimalPlaces: 2
        useGrouping: true
      validations:
        isRequired: true

    - name: invoice
      type: Make.Field.File
      meta:
        version: 1.0.0
      properties:
        maxCount: 2
      validations:
        isRequired: true
        mustBePDF: true
```
然后我会提交一个 Record
#### Step 2: 创建 Record

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  X-Make-Target: MakeService.CreateResource
```

Request Body

```json
{
  "app": <NAME>,
  "entity": "报销单",
  "data": {
    "amount": 1280.50
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

#### Step 3: 根据 Record ID 上传发票文件

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
  "app": "<NAME>",
  "entity": "报销单",
  "field": "invoice",
  "recordID": "rec_abc123"
}
--boundary
Content-Disposition: form-data; name="file"; filename="invoice1.pdf"
Content-Type: application/pdf
<binary>
--boundary
Content-Disposition: form-data; name="file"; filename="invoice2.pdf"
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
    "recordID": "rec_abc123",
    "invoice": [
      {
        "fileName": "realName1.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}" // 这里的 filePath 是引用上面 fileName 下一行的 filePath 变量
      },
      {
        "fileName": "realName2.png",
        "filePath": "${org}/${app}/${sha256}.png",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}" // 这里的 filePath 是引用上面 fileName 下一行的 filePath 变量
      }
    ]
  }
}
```
这里只返回 recordID 和 对应的 field 的信息

> 上传成功后, 这个 Record 的 FileField 的值会自动更新为文件信息, 无需再调用 UpdateResource
也就是说这时候如果去获取这个 Record 的记录，发票字段已自动填充, 如下所示

#### Step 4: 获取 Record 验证文件已关联

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
  "entity": "报销单",
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
    "amount": 1280.50,
    "invoice": [
      {
        "fileName": "taxi.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      },
      {
        "fileName": "train.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```

#### Step 5: 下载文件
GET `fileURL`，服务端校验权限后从云存储流式返回文件内容。

```
GET ${fileURL}
HEADER
  Authorization: Bearer <JWT Token>
```

Response Header

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="${fileName}"
```

Response Body

```
<binary>
```
