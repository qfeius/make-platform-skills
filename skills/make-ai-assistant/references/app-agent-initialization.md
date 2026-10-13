# 按需初始化客户 App Agent

普通 App 不自动配置 Agent。需求包含 AI 助手时，由 Codex 等开发 Agent 按本流程处理初始化、真实前端接入和验收；App 创建、Build 成功或部署 Ready 都不是初始化触发器。本轮 Skill 只规定流程，不增加 CLI 命令或发布 SDK。

## 先确认真实能力

1. 按 `makecli` Skill 检查实际版本、公开根帮助和 App 帮助。只有帮助中真实存在的公开配置能力才可执行，继续读取其子命令和参数说明。隐藏的 `makecli agent` 是本地 Code Agent，不是客户 App 配置入口；不能猜测 `app agent create` 等命令。
2. 区分 backend context（dev/test/production）和 App environment（beta/production）。从实际 App 回读确定目标 appKey、当前用户与应用范围，不拼接 Beta 后缀，不沿用其他环境的 Agent。
3. 只有公开 CLI 能力存在且当前身份获权时，才通过它读取 Plugin、Model、Runtime 目录并按当前配置协议创建或修改 Agent。名称、模型、Runtime 和插件来自需求与真实目录；不生成随机默认值。当前协议若声明 disabled 默认值则保持，配置与前端真实传输完成后再按需求启用。未知写入结果先回读，不直接重复创建。
4. CLI 缺少能力时，记录版本和缺失操作，明确“Agent 配置尚未完成”。继续下面不依赖该能力的前端工作；不能用 Console 初始化、隐藏 Code Agent、私写 HTTP 命令或服务身份绕过缺口。用户只要求 Skill 时，不修改 CLI 源码或创建 CLI PR。

## 包和后端必须匹配

读取实际安装包的 `package.ai.json`，按 `readOrder` 读取公开文档，再检查导出、公开类型、Make App recipe 和 capabilities。以目标后端的 canonical API 及可验证的部署行为核对资源定位、请求/响应、历史和流协议；包的版本号或 README 示例本身不证明后端支持。

2026-10-12 核对到的发布包 `@qfei-design/make-ai-assistant@0.3.10` 仍以 `agentId`、`agentType=app_internal` 和 `/api/make/app/ai/v1/**` 为 Make App v1 契约。当前 Agent 资源协议使用 appKey/key、`X-Make-Target` 和资源信封。这是两份不同的合同，不能把字段改名、把 base URL 换掉或换 Console adapter 当作接通。每次实施都重新核对实际版本和目标后端；此观察不是永久版本判断。

本 Skill 其他 v1 参考和静态 audit 只适用于已明确验证仍支持该 v1 合同的目标。当前后端不支持时，不沿旧参考生成 18 项旧路由，不把 `app_internal` 或内部 Agent ID 强加到新协议中。需要正式发布包补齐相应 Make App adapter 时，准确报告缺失导出或不匹配协议。

## 持续完成可独立的前端工作

- 客户 App 使用 Make App 接入路径；已有 Console Agent 或 Console 可查询不构成切换理由。
- 沿用认证后的 App shell、权限边界和现有 Service 分层。全局助手保持稳定挂载，使用公开 React 导出、主题与样式，不复制包内部 UI、流解析器或状态机。
- App/租户/用户变化时取消旧请求并隔离状态；页面上下文不是授权。浏览器不接触生命周期服务令牌、Agent 执行 Token 或绑定秘密。
- 若配置或匹配的 adapter 尚不可用，完成助手入口、明确“尚未配置/暂不可用”状态和重试交互，保持真实发送不可用。只写有正式依据的 Service 路由；缺少协议时保留边界，不能生成虚构接口。该状态仍可做 UI、类型和构建验证。
- 若公开组件必须接收真实 transport，且没有 setup/disabled/error 插槽，不伪造 transport 或虚构组件属性。用宿主自己的小型配置状态卡片与重试入口承接未就绪状态，仅在正式 adapter 可用的 ready 分支挂载公开 `MakeAiAssistant`；状态卡片不复制包的聊天列表、输入框、上传或消息渲染器。该分支必须明确不可聊天，不能呈现模拟发送成功。
- mock 仅用于用户接受的开发预览或测试，并显式标注；它不能替代真实响应或被发布为默认成功路径。不把配置秘密放入源码、浏览器配置、日志或命令参数。

## 分别验证并报告

App 构建部署、Agent 配置和助手运行各自报告：

- **App**：必要 UI/Service 检查、构建、发布以及实际页面结果。
- **Agent**：实际目标范围、获权目录选择、创建或更新回读、当前启停状态；缺少 CLI 时明确未执行。
- **助手**：匹配的公开 adapter、当前用户鉴权、真实消息受理、流式终态、刷新历史和身份切换隔离；缺少包或后端合同证据时明确未验证。

Skill 修改的验证还应包含独立场景检查：普通 App 不创建 Agent；缺少 CLI 时不发明命令且继续前端；存在正式配置能力时按帮助执行；包与后端不同协议时不走旧 v1 或 Console 回退。静态检查只能验证文档与引用完整性，不能证明运行态接通。
