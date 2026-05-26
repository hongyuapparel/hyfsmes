# CLAUDE.md

## 项目

服装工贸一体 B2B ERP（订单/客户/商品/仓储/生产/权限），非电商发货系统。

- 前端：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + Axios（`http://localhost:5173`）
- 后端：NestJS + TypeORM + MySQL + JWT/Passport + class-validator
- 测试：Vitest

## 任务前读取

| 涉及内容 | 读取文件 |
|---|---|
| 业务逻辑、字段配置、订单流程、页面结构 | `docs/PROJECT_CONTEXT.md` |
| 字段配置、列设置、表单/表格字段 | `docs/FIELD_CONFIG_DESIGN.md` |
| 订单状态、订单列表/编辑、生产流程 | `docs/ORDER_STATUS_FLOW_DESIGN.md` |
| 部署、上线、宝塔、PM2 | `docs/DEPLOY_GUIDE.md`（路径以此为准，不凭记忆） |

用户指定的文档优先于本文件。

## 执行边界

- 只改用户明确要求的范围；必须改动未点名内容时先说明原因并获确认
- 禁止主动改数据库结构、接口契约、全局样式、公共基础组件
- 禁止覆盖、回退、清理用户已有改动，除非用户明确要求
- 发现冲突先说明，再继续

## 实现原则

- 根因修复，禁止临时补丁、绕过机制、兜底掩盖
- 沿用框架官方 API、现有模块结构、项目既有模式
- 前端用 Composition API；后端保持 NestJS 模块边界
- 新逻辑优先复用现有工具、接口封装、公共组件

## UI 与组件

- 抽屉用 `AppDrawer`，弹窗用 `AppDialog`，不自行实现同类组件
- 扩展现有组件优先加 `props`/`slots`，不复制一份新实现
- 同类交互（抽屉/弹窗/表单/工具栏/列表操作区）保持结构和视觉一致
- 禁止：大段私有 CSS、`!important`、深层选择器、包裹遮盖原组件
- 字号只用：`--font-size-title` / `--font-size-subtitle` / `--font-size-body` / `--font-size-caption`
- `el-radio`/`el-radio-button` 必须显式用 `value`/`:value`，禁止用 `label` 充当选中值；改动后执行 `npm run check:el-radio-value`

## 数据与字段

- 同一业务字段全系统统一 `code`、展示方式、数据源
- 表单/表格/筛选优先基于 `fields/*` 配置，不在页面硬编码
- 持久化只存 `xxx_id`，禁止存名称/路径等冗余字段
- 已约定控件形态（树形/级联/可搜索下拉）不得随意改成其他控件

## 代码健康

**TypeScript**：禁止 `: any`、`as any`、`any[]`、`Record<string, any>`、`Promise<any>`，用具体类型或 `unknown` + 类型守卫。`props` 用 `defineProps<{...}>()`，`emit` 用 `defineEmits<{...}>()`，Pinia state 显式声明类型。

**分层职责**：
- `views`：只做编排（路由参数 + 调用 composable + 组合子组件），不写业务计算
- `components`：只处理 UI 交互，通过 props/emit 通信，不直接调 API 或 store
- `composables`：只管逻辑，不引入 UI 组件，不操作 DOM
- `api/`：只做 HTTP 封装，不含业务判断；请求参数和响应必须有 TypeScript 类型定义
- `stores`：只存跨页面共享或需持久化的状态；单页临时状态放组件/composable；action 不操作路由

**文件体积**（警戒线/硬上限）：

| 文件类型 | 警戒线 | 硬上限 |
|---|---|---|
| `views/*.vue` | 300 行 | 500 行 |
| `components/*.vue` | 200 行 | 350 行 |
| `composables/use*.ts` | 150 行 | 250 行 |
| `stores/*.ts` | 150 行 | 200 行 |
| `*.service.ts` | 300 行 | 500 行 |

**必须拆分**（满足任一）：一个 `.vue` 超过 2 个独立业务区块 / 一个 composable 超过 3 个关注点 / 同一逻辑出现 2 次以上。

## 页面与业务变更

- 需求不清时先给 1~3 个方案，确认后再实现
- 设置页新增/编辑/删除后界面必须立即可见结果，禁止依赖 F5、`location.reload`、`router.go(0)`、外层动态 `key`
- 需求级变更后轻量同步相关文档；小 bug/小样式不需要更新文档
- 触碰已有技术债区域时优先偿还，不继续复制历史问题

## 验证与回复

- 证据不足不猜结论，先说明不确定点，再索取控制台/Network/复现步骤/后端日志
- 修复后说明验证了什么、结果是什么；无法自动验证时告知用户操作步骤
- 未确认修复不说"修复完成"，只说"已修改，请按步骤验证"
- 同一问题修复超过 2 次未解决：停止猜测，列出已排除方向和需要的新证据
- 只输出核心代码，不写注释、不写文档、不做总结；完成后只说改了什么文件、潜在影响点

## 启动与排查

- 启动/重启用 `scripts/start.ps1` / `scripts/restart.ps1`（隐藏窗口），不主动开可见命令窗口
- 排查看 `.codex-backend-3000.log`、`.codex-frontend-5173.log` 或运行 `scripts/check.ps1`

## 优先级

用户当前要求 > 用户指定文档 > 本文件 > 项目既有实现模式

## 已知技术债（勿加重）

`inventory/finished.vue` 超 2700 行；`orders/edit.vue`、`orders/list.vue`、`production/*.vue` 超 800 行；backend 有 `: any`；库存/生产抽屉未统一到 `AppDrawer`。
