# AI 变更记录

## 2026-04-16 20:20
- 变更摘要：新增 `canvas-table-integration` skill 初稿，限定为 `@qfei/canvas-table` 的消费侧接入流程。
- 涉及文件/模块：`skills/canvas-table-integration/SKILL.md`、`README.md`、`docs/ai-changes.md`
- 关键逻辑/决策：skill 只负责消费侧接入，不包含 npm 配置、发包或库维护；优先读取已安装包中的 AI 文档，未安装时只提示用户先安装。
