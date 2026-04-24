# CLAUDE.md — 项目协作指南

## 项目定位

服装工贸一体 B2B ERP，前后端分离。面向内部业务流程：订单、客户、商品、仓储、生产、权限等。**非**电商发货系统。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + Axios |
| 后端 | NestJS + TypeORM + MySQL + JWT/Passport + class-validator |
| 测试 | Vitest |

前端开发服务器默认端口：`http://localhost:5173`（`cd frontend && npm run dev`）

## 目录结构

```
├── frontend/src/
│   ├── components/       # 可复用基础/业务组件
│   ├── views/            # 页面（按业务模块分子目录）
│   ├── stores/           # Pinia 状态
│   ├── api/              # Axios 接口封装
│   ├── router/           # 路由
│   └── utils/            # 工具函数
├── backend/src/          # NestJS 模块（每个业务一个目录）
├── docs/                 # 设计文档（PROJECT_CONTEXT.md、FIELD_CONFIG_DESIGN.md、ORDER_STATUS_FLOW_DESIGN.md）
└── .cursor/rules/        # Cursor 协作规则（仅 Cursor 使用，Claude/Codex 无需读取）
```

## 任务开始前的文档读取规则

- 涉及业务逻辑、字段配置、订单流程改动前，先读 `docs/PROJECT_CONTEXT.md`
- 涉及字段配置/列设置/显示顺序，再读 `docs/FIELD_CONFIG_DESIGN.md`
- 涉及订单状态、订单列表/编辑、生产流程，再读 `docs/ORDER_STATUS_FLOW_DESIGN.md`

## 核心规则（必须遵守）

### 修改范围控制
只修改用户明确要求的模块/页面，不顺带扩散改动。如果必须改动未点名内容，先说明原因、范围、影响，获确认后再改。

### 根因修复（禁止补丁思路）
优先采用根本方案，优先用框架/组件库官方 API 与配置。禁止以补丁掩盖问题（无必要的强制覆盖、绕过组件机制、临时兜底）。

### 组件复用优先
- 新页面/新功能优先复用现有基础组件与业务组件
- 可扩展现有组件时，优先扩展 `props` / `slots`，而不是复制一份新实现
- 抽屉统一使用 `AppDrawer`（`frontend/src/components/AppDrawer.vue`）
- 弹窗统一使用 `AppDialog`（如存在）

### 同类交互视觉一致
抽屉、弹窗、表单区、工具栏、列表操作区等同类交互必须统一结构与视觉语言。特殊业务偏离统一样式时，先说明原因并获确认。

### 完成后回复格式
每次完成任务后说明：主要改动模块、关键文件、潜在影响点。

## 数据与配置约定

- 同一业务字段全系统使用同一 `code`（单一数据源）
- 配置项持久化只存 `xxx_id`，**禁止**持久化名称/路径等冗余字段
- 同一字段在全站保持同一组件形态与数据源；已约定为树形/级联/可搜索下拉的字段，不得随意改成其他控件

## 前端 UI 规范

### 字号（仅允许变量）
```
--font-size-title      标题
--font-size-subtitle   副标题
--font-size-body       正文
--font-size-caption    辅助说明
```
禁止硬编码 `font-size` 数值。

### 组件与样式
- 优先使用 Element Plus 官方属性与主题变量
- 非必要不使用深层强制覆盖（`::v-deep` / `:deep()`）
- 页面样式优先引用设计 token，避免页面私有视觉体系

### Element Plus Radio 防回退
`el-radio` / `el-radio-button` 必须显式使用 `value` / `:value`，禁止用 `label` 充当选中值。新增或修改 radio/tab 后执行：
```bash
npm run check:el-radio-value
```

## 设置页面硬性要求

- 新增/编辑/删除后，当前界面**立即**可见结果，禁止依赖 F5 或手动刷新
- 禁止整页刷新或整块重建（`location.reload`、`router.go(0)`、外层动态 `key`）
- 优先局部更新当前列表/树；必须重拉时要恢复用户现场（筛选条件、分页、展开态、滚动位置）

## 代码健康注意点

**技术债（勿加重）：** `inventory/finished.vue` 超 2700 行（最大文件，含内联抽屉逻辑）；`orders/edit.vue`、`orders/list.vue`、`production/*.vue` 超 800 行；backend 层有 `: any` 类型，新代码避免；库存/生产抽屉尚未统一到 `AppDrawer`。
