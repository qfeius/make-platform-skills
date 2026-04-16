## 2026-04-16 17:58

### 变更摘要
- 修正 `makedsl` skill 元数据并补充 Text/TextArea 字段长度约束说明。

### 涉及文件/模块
- `skills/makedsl/SKILL.md`、`skills/makedsl/references/FieldDesign.md`：移除不被校验器接受的 frontmatter `version`，补充文本字段长度上限说明。

### 关键逻辑/决策
- skill frontmatter 需要兼容当前 `quick_validate.py` 规则；字段文档显式写出 `maxLength` 上限，避免生成超出平台约束的 DSL。

## 2026-04-15 18:33

### 变更摘要
- 更新 `makedsl` skill 的 Data API、Relation、LookupField 和 FileField 参考文档，统一 recordID、分页响应和字段返回结构说明。

### 涉及文件/模块
- `skills/makedsl/SKILL.md`、`skills/makedsl/references/*.md`：补充关系写入、查询返回、文件字段和 LookupField 约束，并修正 skill frontmatter。
- `.gitignore`：忽略 IDE 元数据目录 `.idea/`，避免无关文件进入 skill 包。

### 关键逻辑/决策
- 让 skill 使用者明确区分 Relation 写入与 LookupField 展示；Data API 示例按当前平台契约统一为 string recordID 和类型化字段返回结构。
