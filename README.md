# make-platform-skills
make 平台的 skill

# 安装
```
  npx skills add qfeius/make-platform-skills
```
# 升级
```
  npx skills update  qfeius/make-platform-skills
```

## 可用 Skill 列表

### makecli
指导如何使用 `makecli` 命令行

#### 升级 skill
```bash
npx skills update makecli
```

**使用场景**
- 你需要指导使用 `makecli` 命令

### makedsl
指导如何生成 dsl 文件

#### 升级 skill
```bash
npx skills update makedsl
```

**使用场景**
- 根据业务的需求生成服务要求的 dsl 文件

### canvas-table-integration
指导如何在消费侧项目中接入 `@qfei-design/canvas-table`

#### 升级 skill
```bash
npx skills update canvas-table-integration
```

**使用场景**
- 在页面里接入 `@qfei-design/canvas-table`
- 接普通表格、分页表格、分组表格
- 把 JSON meta 转成 `IColumn[]`

### make-integration
Make 集成服务, 扩展 make 平台的能力, 目前集成能力有
- 发票 OCR

#### 升级 skill
```bash
npx skills update make-integration
```

**使用场景**
- 识别发票(打车, 火车票, 宾馆, 餐饮等)的内容(金额等相关信息)
