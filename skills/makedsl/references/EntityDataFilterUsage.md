# Entity Data Filter Usage

说明：

- 仅`record.list` 支持 `filter`。
- `filter` 采用 `or-of-and` 结构：顶层数组表示 `OR`，每个数组元素内部表示 `AND`。

## list 请求结构

`list` 请求体中的 `filter` 必须是数组。省略或传 `null` 表示不过滤。

```json
{
  "app": "demo",
  "entity": "task",
  "fields": ["name", "status", "dueDate"],
  "filter": [
    {
      "name": {
        "contains": "项目"
      },
      "status": {
        "isAnyOf": ["todo", "doing"]
      }
    }
  ],
  "sort": [
    {
      "field": "dueDate",
      "order": "asc"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 20
  }
}
```

非法写法：

```json
{
  "app": "demo",
  "entity": "task",
  "filter": {}
}
```

非法写法：

```json
{
  "app": "demo",
  "entity": "task",
  "filter": []
}
```

## 执行语义

`filter` 固定使用 `OR` of `AND`：

- `filter` 数组中的多个 group 之间是 `OR`。
- 每个 group 内多个字段条件之间是 `AND`。
- 同一字段下多个操作符之间也是 `AND`。

示例：

```json
{
  "filter": [
    {
      "name": {
        "contains": "项目"
      },
      "status": {
        "!=": "done"
      }
    },
    {
      "budget": {
        ">": 100000
      }
    }
  ]
}
```

等价于：

```text
(name contains "项目" AND status != "done")
OR
(budget > 100000)
```

同一字段多个操作符示例：

```json
{
  "filter": [
    {
      "budget": {
        ">=": 100000,
        "<=": 500000
      }
    }
  ]
}
```

等价于：

```text
budget >= 100000 AND budget <= 500000
```

## 操作符和右值

操作符 token 由 `FilterOperator` 定义。

| 操作符 | 右值格式 | 说明 |
| --- | --- | --- |
| `contains` | 标量文本 | 包含 |
| `doesNotContain` | 标量文本 | 不包含 |
| `=` | 标量或数组，取决于字段类型 | 等于 |
| `!=` | 标量 | 不等于 |
| `isEmpty` | 不传右值，或传 `null` | 为空 |
| `isNotEmpty` | 不传右值，或传 `null` | 不为空 |
| `>` | 数字、日期、日期时间或附件数量 | 大于 |
| `>=` | 数字、日期或日期时间 | 大于等于 |
| `<` | 数字、日期、日期时间或附件数量 | 小于 |
| `<=` | 数字、日期或日期时间 | 小于等于 |
| `isAnyOf` | 非空数组 | 是任一项 |
| `isNoneOf` | 非空数组 | 不是任一项 |
| `hasAnyOf` | 非空数组 | 包含任一项 |
| `hasAllOf` | 非空数组 | 包含全部 |
| `hasNoneOf` | 非空数组 | 不包含任一项 |
| `isWithin` | `{ "begin": "...", "end": "..." }` | 在日期或日期时间区间内 |
| `isNotWithin` | `{ "begin": "...", "end": "..." }` | 不在日期或日期时间区间内 |
| `containsDate` | 日期字符串 | 日期区间包含某日 |
| `doesNotContainDate` | 日期字符串 | 日期区间不包含某日 |
| `fullyContains` | `{ "begin": "...", "end": "..." }` | 日期区间完全包含传入区间 |
| `isContainedBy` | `{ "begin": "...", "end": "..." }` | 日期区间被传入区间完全包含 |

## 字段类型矩阵

字段是否可筛选、操作符是否可用，都以当前 Entity 元数据中的 `MakeFieldTypeEnum` 为准。

| 字段类型 | 支持操作符 | 右值归一化 |
| --- | --- | --- |
| `TEXT` / `TEXT_AREA` / `ID` / `URL` | `contains`、`doesNotContain`、`=`、`!=`、`isEmpty`、`isNotEmpty` | 非空标量转字符串 |
| `SINGLE_SELECT` | `=`、`!=`、`isAnyOf`、`isNoneOf`、`isEmpty`、`isNotEmpty` | 单值为字符串，多选项为去重字符串数组 |
| `SINGLE_USER` / `SINGLE_DEPT` | `=`、`!=`、`isAnyOf`、`isNoneOf`、`isEmpty`、`isNotEmpty` | 人员或部门 ID 归一化为 `Long` 或去重 `Long[]` |
| `MULTI_SELECT` | `hasAnyOf`、`hasAllOf`、`hasNoneOf`、`=`、`isEmpty`、`isNotEmpty` | 去重字符串数组 |
| `MULTI_USER` / `MULTI_DEPT` | `hasAnyOf`、`hasAllOf`、`hasNoneOf`、`=`、`isEmpty`、`isNotEmpty` | 去重 `Long[]` |
| `NUMBER` / `CURRENCY` / `PERCENT` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isEmpty`、`isNotEmpty` | `BigDecimal` |
| `DATE` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isWithin`、`isNotWithin`、`isEmpty`、`isNotEmpty` | 严格日期字符串，格式为 `yyyy-MM-dd` |
| `DATE_TIME` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isWithin`、`isNotWithin`、`isEmpty`、`isNotEmpty` | 严格日期时间字符串，格式为 `yyyy-MM-dd HH:mm:ss` |
| `DATE_RANGE` | `containsDate`、`doesNotContainDate`、`fullyContains`、`isContainedBy`、`=`、`isEmpty`、`isNotEmpty` | 日期或 `{ "begin": "yyyy-MM-dd", "end": "yyyy-MM-dd" }` |
| `FILE` | `contains`、`doesNotContain`、`>`、`<`、`=`、`isEmpty`、`isNotEmpty` | 文件名文本或附件数量 |
| `LOOKUP` | 暂不支持 | 会报字段类型暂不支持 |

注意：

- `isEmpty` 和 `isNotEmpty` 不接受右值；如果右值不是 `null`，会报错。
- 数组型右值必须是非空数组。
- 日期区间对象必须同时包含非空 `begin` 和 `end`。
- `DATE_TIME` 会按应用时区归一化到 `Asia/Shanghai` 后再构造 SQL 条件。

## 常见示例

### 文本包含

```json
{
  "filter": [
    {
      "title": {
        "contains": "升级"
      }
    }
  ]
}
```

### 单选任一

```json
{
  "filter": [
    {
      "status": {
        "isAnyOf": ["todo", "doing"]
      }
    }
  ]
}
```

### 多选包含全部

```json
{
  "filter": [
    {
      "tags": {
        "hasAllOf": ["bug", "urgent"]
      }
    }
  ]
}
```

### 人员或部门

```json
{
  "filter": [
    {
      "owner": {
        "=": 1001
      },
      "collaborationDepartments": {
        "hasAnyOf": [3001, 3002]
      }
    }
  ]
}
```

### 日期区间

```json
{
  "filter": [
    {
      "dueDate": {
        "isWithin": {
          "begin": "2026-04-01",
          "end": "2026-04-30"
        }
      }
    }
  ]
}
```

### 日期范围字段

```json
{
  "filter": [
    {
      "planDate": {
        "isContainedBy": {
          "begin": "2026-04-01",
          "end": "2026-04-30"
        }
      }
    }
  ]
}
```

### 附件文件名或数量

```json
{
  "filter": [
    {
      "attachments": {
        "contains": "pdf"
      }
    },
    {
      "attachments": {
        ">": 2
      }
    }
  ]
}
```

该示例表示：文件名包含 `pdf`，或附件数量大于 2。

## 错误场景速查

| 场景 | 当前行为 |
| --- | --- |
| `filter` 是对象而不是数组 | 反序列化失败，错误信息为 `filter必须是对象数组` |
| `filter` 是空数组 | 参数错误，`filter` 不能为空 |
| group 是空对象 | 参数错误，条件组不能为空 |
| 字段名不在 Entity 元数据中 | 参数错误，字段不存在 |
| 字段类型是 `LOOKUP` | 参数错误，字段类型暂不支持 |
| 操作符 token 不存在 | 参数错误，不支持的操作符 |
| 操作符与字段类型不匹配 | 参数错误，字段类型与操作符不匹配 |
| 文本右值是数组或对象 | 参数错误，筛选值类型错误 |
| 数组操作符右值为空数组 | 参数错误，筛选值必须为非空数组 |
| 日期格式不符合严格格式 | 参数错误，日期格式错误或日期时间格式错误 |

## 使用准则

生成 `record.list` 查询时：

1. 需要筛选时，总是生成数组形式的 `filter`。
2. 不需要筛选时，省略 `filter` 或传 `null`，不要生成 `{}` 或 `[]`。
3. 需要 `OR` 时，增加多个 group。
4. 需要 `AND` 时，把多个字段条件放在同一个 group。
5. 需要同一字段上下限时，把多个操作符放在同一个字段对象内。
6. 不要对 `LOOKUP` 字段生成筛选条件。

