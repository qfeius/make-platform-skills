---
name: makedsl
description: Use when designing or generating Make platform DSL YAML — defining apps, entities, fields, relations, views, or record schemas. Also triggered by requests like "建模", "建表", "加字段", "定义关联", or "生成 DSL".
version: 0.1.4
metadata:
  homepage: https://github.com/qfeius/make-platform-skills/makedsl
---

# makedsl usage
Use this skill when you need to  design or generate dsl for make platform or make 开发平台.
make platform 从 kubernetes 和 ansible 中借鉴了设计思路, 业务的模型通过 DSL 建模定义, 
然后通过 DataAPI 来对数据进行 CRUD-LS. 
生成的 DSL(yaml) 文件应该通过 `makecli` 提交到 make platform (make 开发者平台)

# DSL定义

## APP

逻辑概念上对应数据库的一个 database

### APP DSL

```yaml
name: <NAME> # name 创建之后, 不允许更新, 只允许英文字符, 数字, 下划线, 长度限制 3-20
type: Make.App
meta:
  version: SemanticVersion
properties:
  renderName: String # 必填
  timezone: String? # 可选，如 "Asia/Shanghai"、"UTC"；若未指定，使用系统默认"Asia/Shanghai"
  description: String?
```

### App 例子

```yaml
name: MatrixProject
type: Make.App
meta:
  version: 1.0.0
properties:
  renderName: 烽火项目管理
  description: 烽火项目管理演示项目
```

## Entity

逻辑概念上对应数据库 table 的一个 Table, 在底层实现是 ${App}.${Entity} 作为一个 TiDB 的 Table

### Entity DSL

```yaml
name: <NAME>
type: Make.Entity
app: <Make.App>
meta:
  version: SemanticVersion
properties:
  fields:
    - Make.Field
    - Make.Field
    - ...
```

### Entity 例子

#### 项目 Entity

```yaml
name: 项目
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: 项目名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - name: 项目描述
      type: Make.Field.TextArea
      meta:
        version: 1.0.0
      properties: null
```

#### 任务 Entity

```yaml
name: 任务
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: 任务名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - name: 任务描述
      type: Make.Field.TextArea
      meta:
        version: 1.0.0
      properties: null
    - name: 任务状态
      type: Make.Field.SingleSelect
      meta:
        version: 1.0.0
      properties: null
```

## Relation | 关联

- Relation 是描述 Entity 之间关系的纯结构声明——谁和谁有关系、几对几。不涉及任何展示逻辑。（详见 @references/RelationDesign.md）
- 关联数据的展示通过 LookupField 实现（详见 @references/FieldDesign.md）。
- 关联数据写入时，需要在 Data API 的 `data.qfei_relation` 中显式传递关联对象。（详见： @references/DataAPIDesign.md）

## Field | 字段

逻辑概念上对应数据库 table 的一个 column, 一个 Entity 会包含多个 Field
详情请见 @references/FieldDesign.md

## Record | 记录

逻辑概念上对应数据库 table 的一个 row, 一个 Entity 会包含多个 Record

# DataAPI | 数据 CRUD-LS
 对数据的操作可以参考 @references/DataAPIDesign.md
