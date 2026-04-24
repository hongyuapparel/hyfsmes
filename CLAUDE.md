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

## 代码健康红线（强制，新代码必须遵守）

### 文件体积上限

| 文件类型 | 警戒线 | 硬上限 |
|---|---|---|
| `views/*.vue` 页面 | 300 行 | 500 行 |
| `components/*.vue` 组件 | 200 行 | 350 行 |
| `composables/use*.ts` | 150 行 | 250 行 |
| `stores/*.ts` | 150 行 | 200 行 |
| backend `*.service.ts` | 300 行 | 500 行 |

**超过警戒线必须拆分，不得以"先写完再说"为由继续堆代码。**

### 何时必须拆分（判断标准）

满足以下任一条即须拆：
- 一个 `.vue` 文件里有超过 **2 个独立业务区块**（如列表 + 抽屉 + 弹窗）
- 一个 `composable` 里有超过 **3 个不同关注点**（如：数据加载 + 表单验证 + 提交逻辑）
- 同一段逻辑在 **2 个以上** 地方出现

拆分方向：
- 内联抽屉/弹窗逻辑 → 提取为独立 `<XxxDrawer>` / `<XxxDialog>` 组件
- setup 中业务逻辑 → 提取为 `composables/useXxx.ts`
- 多个列表操作 → 提取为 `composables/useXxxList.ts`（分页、筛选、删除各自独立）

### TypeScript 严格度

- **禁止** `: any`，后端新代码尤其严格；必须用具体类型或 `unknown` + 类型守卫
- 所有 Vue 组件 `props` 必须用 `defineProps<{...}>()` 泛型写法，不得用运行时对象形式
- 所有 `emit` 必须用 `defineEmits<{...}>()` 泛型写法
- Pinia store 中的 state 类型必须显式声明，不依赖推断

### 组件职责边界

- **页面（views）只做编排**：负责路由参数读取、调用 composable、组合子组件，不写业务计算逻辑
- **组件（components）只处理 UI 交互**：通过 props/emit 与外部通信，不直接调用 API 或 store（除展示型全局数据）
- **Composable 只管逻辑**：不引入任何 Element Plus UI 组件，不操作 DOM

### Store 使用边界

- Pinia store 只存**跨页面共享**或**需要持久化**的状态
- 单页内的临时状态（弹窗开关、表单草稿、分页）放在组件/composable 的 `ref`/`reactive` 里，**不得提升到 store**
- 禁止在 store action 里直接操作路由（`router.push`）

### API 层约定

- `api/` 目录下的函数只做 HTTP 请求封装，不含业务判断逻辑
- 请求参数和响应类型必须有对应的 TypeScript 接口定义，放在同文件或 `types/` 目录

---

## 已知技术债（勿加重，有机会偿还）

`inventory/finished.vue` 超 2700 行（最大文件，含内联抽屉逻辑）；`orders/edit.vue`、`orders/list.vue`、`production/*.vue` 超 800 行；backend 层有 `: any` 类型；库存/生产抽屉尚未统一到 `AppDrawer`。
