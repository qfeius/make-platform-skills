<!-- TOC -->

- [设计原则](#%E8%AE%BE%E8%AE%A1%E5%8E%9F%E5%88%99)
- [Relation DSL](#relation-dsl)
- [例子](#%E4%BE%8B%E5%AD%90)
  - [一对一：用户 ↔ 档案](#%E4%B8%80%E5%AF%B9%E4%B8%80%E7%94%A8%E6%88%B7--%E6%A1%A3%E6%A1%88)
  - [一对多：项目 ↔ 任务](#%E4%B8%80%E5%AF%B9%E5%A4%9A%E9%A1%B9%E7%9B%AE--%E4%BB%BB%E5%8A%A1)
  - [多对多：学生 ↔ 课程](#%E5%A4%9A%E5%AF%B9%E5%A4%9A%E5%AD%A6%E7%94%9F--%E8%AF%BE%E7%A8%8B)
- [数据库实现参考](#%E6%95%B0%E6%8D%AE%E5%BA%93%E5%AE%9E%E7%8E%B0%E5%8F%82%E8%80%83)
  - [一对一 / 一对多](#%E4%B8%80%E5%AF%B9%E4%B8%80--%E4%B8%80%E5%AF%B9%E5%A4%9A)
  - [多对多](#%E5%A4%9A%E5%AF%B9%E5%A4%9A)
  - [LookupField 查询](#lookupfield-%E6%9F%A5%E8%AF%A2)

<!-- /TOC -->

# 设计原则

Relation 与 LookupField 职责正交：

- **Relation**：纯结构声明——谁和谁有关系、几对几。不涉及任何展示逻辑。
- **LookupField**：通过 Relation 找到对端 Entity 的记录，取其字段值展示。所有展示逻辑在此。

系统根据 Relation 两侧的 cardinality 自动决定存储实现（FK 或中间表），DSL 层面 1:1、1:N、N:M 写法统一，实现细节不泄露到 Field 层。

# Relation DSL

```yaml
name: <NAME>
type: Make.Relation
app: <Make.App>
meta:
  version: SemanticVersion
properties:
  from:
    entity: Make.Entity
    cardinality: one | many
  to:
    entity: Make.Entity
    cardinality: one | many
```

| cardinality 组合 | 含义 | 存储实现 |
|---|---|---|
| `one` / `one` | 一对一 | FK 放 to 侧 |
| `one` / `many` | 一对多 | FK 放 to 侧 |
| `many` / `many` | 多对多 | 自动建中间表 |

# 例子

## 一对一：用户 ↔ 档案

```yaml
# ===== Relation =====
name: user-has-profile
type: Make.Relation
app: <Make.App>
meta:
  version: 1.0.0
properties:
  from:
    entity: 用户
    cardinality: one
  to:
    entity: 档案
    cardinality: one

# ===== 用户 Entity =====
name: 用户
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: 姓名
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - name: 个人档案
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: user-has-profile
        targetField: 简介

# ===== 档案 Entity =====
name: 档案
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: 简介
      type: Make.Field.TextArea
      meta:
        version: 1.0.0
      properties: null
    - name: 头像
      type: Make.Field.File
      meta:
        version: 1.0.0
      properties: null
```

> 1:1 时 LookupField 不需要 `transform`，对端永远只有一条记录。

## 一对多：项目 ↔ 任务

```yaml
# ===== Relation =====
name: project-has-tasks
type: Make.Relation
app: <Make.App>
meta:
  version: 1.0.0
properties:
  from:
    entity: 项目
    cardinality: one
  to:
    entity: 任务
    cardinality: many

# ===== 项目 Entity =====
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
    - name: 项目任务
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: project-has-tasks
        targetField: 任务名称
        transform:
          type: join
          separator: " | "
    - name: 任务状态概览
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: project-has-tasks
        targetField: 任务状态
        transform:
          type: join
          separator: " | "

# ===== 任务 Entity =====
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
      properties:
        options:
          - label: "待开始"
            value: "todo"
          - label: "进行中"
            value: "in_progress"
          - label: "已完成"
            value: "done"
    - name: 所属项目
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: project-has-tasks
        targetField: 项目名称
```

> 项目侧 LookupField 对端 cardinality 为 `many`（任务），需要 `transform`。
> 任务侧 LookupField 对端 cardinality 为 `one`（项目），不需要 `transform`。

## 多对多：学生 ↔ 课程

```yaml
# ===== Relation =====
name: student-takes-course
type: Make.Relation
app: <Make.App>
meta:
  version: 1.0.0
properties:
  from:
    entity: 学生
    cardinality: many
  to:
    entity: 课程
    cardinality: many

# ===== 学生 Entity =====
name: 学生
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: 姓名
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - name: 选修课程
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: student-takes-course
        targetField: 课程名称
        transform:
          type: join
          separator: ", "

# ===== 课程 Entity =====
name: 课程
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - name: 课程名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - name: 学分
      type: Make.Field.Number
      meta:
        version: 1.0.0
      properties:
        precision: 0
    - name: 选课学生
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: student-takes-course
        targetField: 姓名
        transform:
          type: join
          separator: ", "
```

> N:M 两侧 cardinality 都是 `many`，两侧的 LookupField 都需要 `transform`。

# 数据库实现参考

## 一对一 / 一对多

FK 列放在 `to` 侧的实体表上，列名格式 `_rel_{relation_name}_id`：

```
┌──────────────┐         ┌──────────────────────────────────┐
│ 项目          │         │ 任务                              │
├──────────────┤         ├──────────────────────────────────┤
│ _id    (PK)  │←────────│ _rel_project_has_tasks_id  (FK)  │
│ 项目名称      │         │ _id    (PK)                      │
│ 项目描述      │         │ 任务名称                          │
└──────────────┘         │ 任务描述                          │
                         │ 任务状态                          │
                         └──────────────────────────────────┘
```

## 多对多

系统自动创建中间表，表名格式 `_jt_{app_name}_{relation_name}`：
Tips: jt 是 join table 的缩写
```
┌──────────────┐    ┌──────────────────────────┐    ┌──────────────┐
│ 学生          │    │ _jt_课程表_student_course  │    │ 课程          │
├──────────────┤    ├──────────────────────────┤    ├──────────────┤
│ _id    (PK)  │←───│ _from_id  (FK)           │    │ _id    (PK)  │
│ 姓名          │    │ _to_id    (FK)───────────┼───→│ 课程名称      │
└──────────────┘    └──────────────────────────┘    │ 学分          │
                                                    └──────────────┘
```

## LookupField 查询

LookupField 不占物理列，查询时通过 JOIN 计算：

**一对多（项目侧 → 任务名称）：**

```sql
SELECT p.*, GROUP_CONCAT(t.任务名称 SEPARATOR ' | ') AS 项目任务
FROM 项目 p
  LEFT JOIN 任务 t ON t._rel_project_has_tasks_id = p._id
GROUP BY p._id;
```

**一对多（任务侧 → 项目名称）：**

```sql
SELECT t.*, p.项目名称 AS 所属项目
FROM 任务 t
  LEFT JOIN 项目 p ON p._id = t._rel_project_has_tasks_id;
```

**多对多（学生侧 → 课程名称）：**

```sql
SELECT s.*, GROUP_CONCAT(c.课程名称 SEPARATOR ', ') AS 选修课程
FROM 学生 s
  LEFT JOIN _jt_student_takes_course j ON j._from_id = s._id
  LEFT JOIN 课程 c ON c._id = j._to_id
GROUP BY s._id;
```

**多对多（课程侧 → 学生姓名）：**

```sql
SELECT c.*, GROUP_CONCAT(s.姓名 SEPARATOR ', ') AS 选课学生
FROM 课程 c
  LEFT JOIN _jt_student_takes_course j ON j._to_id = c._id
  LEFT JOIN 学生 s ON s._id = j._from_id
GROUP BY c._id;
```
