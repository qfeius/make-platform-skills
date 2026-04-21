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

> 1:1 时 LookupField ，对端永远只有一条记录。

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
    - name: 任务状态概览
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relation: project-has-tasks
        targetField: 任务状态

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

> 项目侧 LookupField 对端 cardinality 为 `many`（任务）。
> 任务侧 LookupField 对端 cardinality 为 `one`（项目）。

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
```

> N:M 两侧 cardinality 都是 `many`。

# Relation 写入

Relation 决定结构，LookupField 决定展示；真正写入关联关系时，需要在 `CreateResource` / `UpdateResource` 的 `data.qfei_relation` 中显式传递对端记录。

- `qfei_relation` 是数组，即使当前只关联一条记录也使用数组包裹
- 数组项格式固定为 `{ "entity": "<对端 Entity 名称>", "id": "<对端 recordID>" }`
- `LookupField` 不参与写入，它只负责把关联对象的字段投影出来展示
- 具体接口字段见 @DataAPIDesign.md

**一对多：创建任务并关联到项目**

```json
{
  "app": "ProjectApp",
  "entity": "任务",
  "data": {
    "任务名称": "编写方案",
    "任务状态": "todo",
    "qfei_relation": [
      {
        "entity": "项目",
        "id": "123"
      }
    ]
  }
}
```

**多对多：更新学生并关联多门课程**

```json
{
  "app": "CourseApp",
  "entity": "学生",
  "recordID": "123",
  "data": {
    "姓名": "张三",
    "qfei_relation": [
      {
        "entity": "课程",
        "id": "123"
      },
      {
        "entity": "课程",
        "id": "345"
      }
    ]
  }
}
```

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
