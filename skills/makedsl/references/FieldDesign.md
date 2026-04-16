# 约束条件

- 所有Field 的 name 都不能以下划线(\_) 开头, 下划线开头是预留关键字

# Regular Field | 常规字段

常规字段可以直接对字段进行写入。

## IDField | 编号字段

一般业务上用来生成唯一 ID, 支持 String 和 Integer 类型。

### IDField DSL

```yaml
name: <NAME>
type: Make.Field.ID
meta:
  version: SemanticVersion
properties:
  rule:
    prefix: String # 编号前缀, 配置时可以为空
    suffix: String # 编号后缀, 配置时可以为空
    code: Integer # 编号数字, 自增, 配置时可以为空
    digit: Integer # 编号长度
```

> SemanticVersion 表示语义化, 具体可以查看 https://semver.org/
> 其中 version 的作用是用来解决后续可能代码的版本兼容性问题

### IDField 例子

```yaml
name: 订单号
type: Make.Field.ID
meta:
  version: 1.0.0
properties:
  rule:
    prefix: "China"
    suffix: null
    code: Integer # 编号数字, 自增, 配置时可以为空
    digit: 4
```

## TextField | 文本字段

单行文本字段。

### 约束

- `maxLength` 最大值为200

### TextField DSL

```yaml
name: <NAME>
type: Make.Field.Text
meta:
  version: SemanticVersion
properties: null
validations:
  isRequired: Boolean
  isAlpha: Boolean
  isAlphaumeric: Boolean
  isJSON: Boolean
  minLength: Integer
  maxLength: Integer
  matchRegexp: /foo/
```

### TextField 例子

```yaml
name: 姓名
type: Make.Field.Text
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## TextAreaField | 文本框字段

多行文本字段。

### 约束

- `maxLength` 最大值为2000

### TextAreaField DSL

```yaml
name: <NAME>
type: Make.Field.TextArea
meta:
  version: SemanticVersion
properties: null
validations:
  isRequired: Boolean
  isAlpha: Boolean
  isAlphaumeric: Boolean
  isJSON: Boolean
  minLength: Integer
  maxLength: Integer
  matchRegexp: /foo/
```

### TextAreaField 例子

```yaml
name: 任务描述
type: Make.Field.TextArea
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## NumberField | 数字字段

表示数字, 支持整数, 小数等。

### 约束
- 如果是金额类型，禁止使用数字字段代替

### NumberField DSL

```yaml
name: <NAME>
type: Make.Field.Number
meta:
  version: SemanticVersion
properties:
  precision: Integer
validations:
  isRequired: Boolean
  isInt: Boolean
  isFloat: Boolean
  minimum: Number
  maximum: Number
```

### NumberField 例子

```yaml
name: 年龄
type: Make.Field.Number
meta:
  version: 1.0.0
properties:
  precision: 2
validations:
  isRequired: true
  minimum: 0
  maximum: 200
```

## SingleSelectField | 单选字段

从预定义的选项列表中选择一项。

### SingleSelectField DSL

```yaml
name: <NAME>
type: Make.Field.SingleSelect
meta:
  version: SemanticVersion
properties:
  options:
    - label: String # 显示文本
      value: String # 存储值
validations:
  isRequired: Boolean
```

### SingleSelectField 例子

```yaml
name: 优先级
type: Make.Field.SingleSelect
meta:
  version: 1.0.0
properties:
  options:
    - label: "高"
      value: "high"
    - label: "中"
      value: "medium"
    - label: "低"
      value: "low"
validations:
  isRequired: true
```

## MultiSelectField | 多选字段

从预定义的选项列表中选择多项。

### MultiSelectField DSL

```yaml
name: <NAME>
type: Make.Field.MultiSelect
meta:
  version: SemanticVersion
properties:
  options:
    - label: String
      value: String
validations:
  isRequired: Boolean
```

### MultiSelectField 例子

```yaml
name: 标签
type: Make.Field.MultiSelect
meta:
  version: 1.0.0
properties:
  options:
    - label: "Bug"
      value: "bug"
    - label: "Feature"
      value: "feature"
    - label: "Enhancement"
      value: "enhancement"
validations:
  isRequired: true
```

## DateField | 日期字段

表示日期

### DateField DSL

```yaml
name: <NAME>
type: Make.Field.Date
meta:
  version: SemanticVersion
properties:
  format: String # yyyy-MM-dd | yyyy/MM/dd | yyyy-MM-dd | yyyy/M/dd | yyyy-M-dd
validations:
  isRequired: Boolean
```

yyyy-MM-dd 类似格式 2023-01-01
yyyy/MM/dd 类似格式 2023/01/01
yyyy/M/dd 类似格式 2023/1/01

### DateField 例子

```yaml
name: 生日
type: Make.Field.Date
meta:
  version: 1.0.0
properties:
  format: "yyyy-MM-dd"
validations:
  isRequired: true
```

## DateTimeField | 日期时间字段

表示时间

```yaml
name: <NAME>
type: Make.Field.DateTime
meta:
  version: SemanticVersion
properties:
  format: String # yyyy-MM-dd HH:mm:ss | yyyy/MM/dd HH:mm:ss
validations:
  isRequired: Boolean
```

### DateTimeField 例子

```yaml
name: 创建时间
type: Make.Field.DateTime
meta:
  version: 1.0.0
properties:
  format: "yyyy-MM-dd HH:mm:ss"
validations:
  isRequired: true
```

yyyy-MM-dd HH:mm:ss 类似格式 2026-02-27 15:08:05

## DateRangeField | 日期范围字段

日期范围字段

### DateRangeField DSL

```yaml
name: <NAME>
type: Make.Field.DateRange
meta:
  version: SemanticVersion
properties:
  begin: Date
  end: Date
validations:
  isRequired: Boolean
```

### DateRangeField 例子

```yaml
name: <NAME>
type: Make.Field.DateRange
meta:
  version: SemanticVersion
properties:
  begin: "2025-06-01"
  end: "2025-12-01"
validations:
  isRequired: true
```

## PercentField | 百分比字段

显示百分比

### PercentField DSL

```yaml
name: <NAME>
type: Make.Field.Percent
meta:
  version: SemanticVersion
properties:
  decimalPlaces: Integer
validations:
  isRequired: Boolean
```

### PercentField 例子

```yaml
name: 项目进度
type: Make.Field.Percent
meta:
  version: 1.0.0
properties:
  decimalPlaces: 2 # 表示2 个小数位数 12.00%
validations:
  isRequired: true
```

## CurrencyField | 金额字段

显示金额

### CurrencyField DSL

```yaml
name: <NAME>
type: Make.Field.Currency
meta:
  version: SemanticVersion
properties:
  symbol: String
  decimalPlaces: Integer
  useGrouping: Boolean # 1000 => 1,000
validations:
  isRequired: Boolean
```

### CurrencyField 例子

```yaml
name: 项目进度
type: Make.Field.Currency
meta:
  version: 1.0.0
properties:
  symbol: "¥"
  decimalPlaces: 2 # 表示2 个小数位数 12.00
  useGrouping: false
validations:
  isRequired: true
```

## URLField | URL 字段

用来存储和跳转 URL 链接。

### URLField DSL

```yaml
name: <NAME>
type: Make.Field.URL
meta:
  version: SemanticVersion
properties: null
validations:
  isRequired: Boolean
```

### URLField 例子

```yaml
name: 公司官网
type: Make.Field.URL
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## FileField | 文件字段

用来存储和管理文件。FileField 统一采用数组语义，通过 `maxCount` 控制文件数量上限。
上传、自动回填与下载流程详见 @FileFieldDesign.md

### FileField DSL

```yaml
name: <NAME>
type: Make.Field.File
meta:
  version: SemanticVersion
properties:
  maxCount: Integer # 最大文件数量, 默认为 1
validations:
  isRequired: Boolean
  mustBeImage: Bool
  mustBePDF: Bool
  mustBeTextFile: Bool
```

### FileField 例子

```yaml
name: 项目文档
type: Make.Field.File
meta:
  version: 1.0.0
properties:
  maxCount: 5
validations:
  isRequired: true
  mustBePDF: true
```

# Derived Field | 派生字段

Derived Field 表示该字段是从其它的字段的值派生而来的

## LookupField | 查找字段

LookupField 通过 Relation 找到对端记录，再读取对端字段作为展示值。

### 约束

- 如果在 A 对象中需要展示 B 对象的字段数据，则必须使用` LookupField` 实现，禁止通过自定义关联Id字段来实现。
- LookupField 只负责展示，不负责写入关系。
- 关联关系写入时使用 `CreateResource` / `UpdateResource` 的 `data.qfei_relation`。接口示例见 @DataAPIDesign.md

### LookupField DSL

```yaml
name: <NAME>
type: Make.Field.Lookup
meta:
  version: SemanticVersion
properties:
  relation: Make.Relation
  targetField: FieldName # 对端 Entity 上要查找的字段名
  filter: Expression # Filter 条件
  transform: # 多条关联记录时的展示策略
    type: join | first # join: 拼接为字符串; first: 仅取第一条
    separator: String? # 仅 join 时有效
```

### LookupField 例子

```yaml
name: 任务状态概览
type: Make.Field.Lookup
meta:
  version: SemanticVersion
properties:
  relation: project-task-relation
  # 拿对面哪个字段？ -> 拿 Task 的 '任务状态'
  targetField: 任务状态
  # 数据转换
  # 拿回来的是 ["Todo", "Done", "Todo"]
  # 我们希望在界面上显示为 "Todo | Done | Todo"
  transform:
    type: join
    separator: " | "
```

### Validation | 数据校验

```
validations:
  isRequired: Boolean
  isAlpha: Boolean
```

说明: 多个规则之间是 and 的关系, 比如下面的逻辑 表示这个字段必须是必填的而且只能是英文字母

```
validations:
  isRequired: true
  isAlpha: true
```

| 规则名称                | 说明                     |
| ----------------------- | ------------------------ |
| `isRequired:Boolean`    | 必须是必填               |
| `isAlpha:Boolean`       | 必须是字母               |
| `isAlphaumeric:Boolean` | 必须是字母或数字         |
| `isInt:Boolean`         | 必须是整形               |
| `isFloat:Boolean`       | 必须是浮点形             |
| `minLength:Integer`     | 最小长度                 |
| `maxLength:Integer`     | 最大长度                 |
| `maximum:Number`        | 最大值                   |
| `minimum:Number`        | 最小值                   |
| `isJSON:Boolean`        | 是否是合法的 JSON 字符串 |
| `matchRegexp:/foo/`     | 必须命中某个正则         |
| `mustBeImage:Boolean`    | 必须是图片文件           |
| `mustBePDF:Boolean`      | 必须是 PDF 文件          |
| `mustBeTextFile:Boolean` | 必须是文本文件           |
