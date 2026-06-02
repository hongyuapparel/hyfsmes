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
- 新建文件前必须读 ≥2 个同目录/同类型现有文件，照搬 import 路径、导出方式、命名、结构。禁止凭印象写路径（`@/xxx` 还是 `./xxx`、`request` 在 `api/` 还是 `utils/` 必须查证）
- 新建 API 接口/类型前，必须先打开所有调用方（template + script + 后端 controller）按它们实际访问的字段/嵌套定义类型；禁止先编类型再让调用方报错

## UI 与组件

- 抽屉用 `AppDrawer`，弹窗用 `AppDialog`，不自行实现同类组件
- 扩展现有组件优先加 `props`/`slots`，不复制一份新实现
- 同类交互（抽屉/弹窗/表单/工具栏/列表操作区）保持结构和视觉一致
- 禁止：大段私有 CSS、`!important`、深层选择器、包裹遮盖原组件
- 字号只用：`--font-size-title` / `--font-size-subtitle` / `--font-size-body` / `--font-size-caption`
- `el-radio`/`el-radio-button` 必须显式用 `value`/`:value`，禁止用 `label` 充当选中值；改动后执行 `npm run check:el-radio-value`
- 可编辑/填写型表格（单元格内放 `el-input`/`el-select`/`el-input-number`/textarea 等供录入的表）统一在 `<el-table>` 上加 `class="editable-grid"`，外观由 `design-system.css` 的全局 `.editable-grid` 规则提供：填写框无内框（铺满单元格、靠表格线分隔，hover/focus 才整格高亮）、表头/数据行/合计行等高（变量 `--editable-grid-header-h` / `--editable-grid-row-h`）、内容上下左右居中。新建此类表必须套 `editable-grid`，禁止各表自写单元格内边距/边框/对齐；要调密度改 `design-system.css` 变量一处即可。含图片列的表（如尺码矩阵）在该表局部把行高改回自适应，避免压坏图片

## 数据与字段

- 同一业务字段全系统统一 `code`、展示方式、数据源
- 表单/表格/筛选优先基于 `fields/*` 配置，不在页面硬编码
- 持久化只存 `xxx_id`，禁止存名称/路径等冗余字段
- 已约定控件形态（树形/级联/可搜索下拉）不得随意改成其他控件

## 代码健康

**TypeScript**：禁止 `: any`、`as any`、`any[]`、`Record<string, any>`、`Promise<any>`，用具体类型或 `unknown` + 类型守卫。`props` 用 `defineProps<{...}>()`，`emit` 用 `defineEmits<{...}>()`，Pinia state 显式声明类型。

**Vue 3 + vue-tsc 已知坑**（踩过的不再踩）：
- composable 返回 reactive 对象做 prop 类型，必须用 `ShallowUnwrapRef<ReturnType<typeof useXxx>>`，直接用 `ReturnType<typeof useXxx>` 会暴露 Ref 包裹导致模板访问报错
- `<script setup>` 中判别联合类型 narrowing 不稳定：`if (!row.flag)`、`if (row.flag) return` 之后访问独有字段仍可能报 union 错。统一用 `(row as ConcreteType).field` 显式断言或抽 type predicate `function isX(v): v is X`
- 移除一个 `any` 不只是改一处类型注解；改完必须沿调用链跑完整 build，确认所有消费方都通得过

**构建验证**：
- 涉及类型或逻辑的改动，**commit 前**（不是 commit 后、不是 push 后）必须本地跑对应 `npm run build`（前端含 `vue-tsc`，后端 `nest build`）通过
- `npm run dev` 不做类型检查、不能替代；单文件 `vue-tsc --noEmit some.vue` 也不能替代完整 build
- 多文件重构/拆分、批量类型改动、sub-agent 完成的工作，merge 回主干前本人必须在项目根目录跑一次完整 build，不能只看 agent 报告
- push 前 `git status` 二次确认改动范围，所有新建文件已 staged，没有把无关 untracked 文件带上
- 禁止 `git add 目录/` 或 `git add .`；必须用具体文件路径分批 add

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
- sub-agent 返回"完成"不等于真完成；本人必须跑 build + 看 git diff 验证再向用户回报
- 只输出核心代码，不写注释、不写文档、不做总结；完成后只说改了什么文件、潜在影响点

## 启动与排查

- 启动/重启用 `scripts/start.ps1` / `scripts/restart.ps1`（隐藏窗口），不主动开可见命令窗口
- 排查看 `.codex-backend-3000.log`、`.codex-frontend-5173.log` 或运行 `scripts/check.ps1`

## 优先级

用户当前要求 > 用户指定文档 > 本文件 > 项目既有实现模式

## 已知技术债（勿加重）

`inventory/finished.vue` 超 2700 行；`orders/edit.vue`、`orders/list.vue`、`production/*.vue` 超 800 行；backend 有 `: any`；库存/生产抽屉未统一到 `AppDrawer`。
