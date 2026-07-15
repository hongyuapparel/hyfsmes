# AGENTS.md — 项目 Agent 规则目录

本文件是 Agent 协作的**唯一入口**：只说明读什么、何时读。详细规则在 `docs/`，不要在此重复正文。

如与系统指令或用户当前明确要求冲突，按更高优先级执行，并在必要时说明冲突点。

---

## 1. 项目定位

服装工贸一体 B2B ERP（订单、客户、商品、仓储、生产、权限），非电商发货系统。

- 前端：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + Axios
- 后端：NestJS + TypeORM + MySQL + JWT/Passport + class-validator
- 测试：Vitest · 本地前端：`http://localhost:5173`

---

## 2. 上线环境（摘要）

- 线上：`https://erp.hyfsmes.com`
- 部署路径与 PM2 名以 [`docs/DEPLOY_GUIDE.md`](docs/DEPLOY_GUIDE.md) 为准
- 改库结构/数据：给可直接粘贴执行的 SQL（`backend/scripts/*.sql` 或聊天贴出），不要让用户跑脚本

---

## 3. 按需读取（需要什么读什么）

完整索引见 [`docs/README.md`](docs/README.md)。

| 场景 | 读取 |
|------|------|
| 每次任务 | 本文件 |
| 业务背景、模块总览 | [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) |
| 协作边界、验证、设置页 | [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) |
| 类型、分层、复用、build | [`docs/CODE_STANDARDS.md`](docs/CODE_STANDARDS.md) |
| 前端 UI、组件、样式 | [`docs/FRONTEND_UI.md`](docs/FRONTEND_UI.md) |
| 字段配置、列设置 | [`docs/FIELD_CONFIG_DESIGN.md`](docs/FIELD_CONFIG_DESIGN.md) |
| 订单状态、生产流程 | [`docs/ORDER_STATUS_FLOW_DESIGN.md`](docs/ORDER_STATUS_FLOW_DESIGN.md) |
| 部署、上线 | [`docs/DEPLOY_GUIDE.md`](docs/DEPLOY_GUIDE.md) |
| 用户 @ 指定文档 | 优先于本文件 |

---

## 4. 规范文档（指针，正文在 docs/）

| 主题 | 文档 |
|------|------|
| 执行边界、验证回复、优先级 | [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) |
| 代码规范（含原「代码健康」） | [`docs/CODE_STANDARDS.md`](docs/CODE_STANDARDS.md) |
| 前端 UI | [`docs/FRONTEND_UI.md`](docs/FRONTEND_UI.md) |
| 字段业务设计 | [`docs/FIELD_CONFIG_DESIGN.md`](docs/FIELD_CONFIG_DESIGN.md) |

---

## 5. 优先级

1. 用户当前明确要求
2. 用户指定的文档或设计说明
3. 本文件及 `docs/` 引用的规范
4. 项目代码中的既有实现模式
