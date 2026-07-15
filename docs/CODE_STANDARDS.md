# 代码规范

> 涉及类型安全、实现原则、复用流程、分层边界、文件行数、build 验证、字段编码约定时读取本文档。

---

## 1. 实现原则

- 优先做根因修复，禁止临时补丁、绕过机制、兜底掩盖问题。
- 优先沿用框架、组件库官方 API、DTO、校验器、现有模块结构和项目既有模式。
- 前端使用 Composition API；后端接口保持现有 NestJS 模块边界。
- 新逻辑优先复用现有工具、字段定义、接口封装和公共组件。
- 新建文件前必须读 ≥2 个同目录/同类型现有文件，照搬 import 路径、导出方式、命名、结构。禁止凭印象写路径（如 `request` 工具位于 `api/` 还是 `utils/` 必须查证，`@/xxx` 还是 `./xxx` 必须查证）。
- 新建 API 接口/类型前，必须先打开所有调用方（template + script + 后端 controller）按它们实际访问的字段/嵌套结构定义类型；禁止先编类型再让调用方报错。

---

## 2. 复用优先强制流程

任何 UI 或功能改动前，必须先执行复用优先检查：

1. 使用 `rg` 搜索同类组件、同类页面、同类交互、helper、composable、API 封装和样式。
2. 优先复用已有组件、composable、utils、设计 token 和交互模式。
3. 现有组件可扩展时，优先扩展 `props` / `slots` / 配置，不复制一份新实现。
4. 如果没有可直接复用的组件，必须沿用最接近的既有页面或组件结构与视觉风格。
5. 如果新增了重复逻辑，必须说明为什么不能复用或抽公共 helper。
6. 对非微小 UI/功能改动，最终回复必须说明本次复用了哪些已有组件、模式或 helper。

如果尚未搜索同类实现，不要开始写 UI 或功能代码。

---

## 3. 类型安全

- 不新增 `any` 技术债；所有新代码、本次触碰代码禁止 `: any`、`as any`、`any[]`、`Record<string, any>`、`Promise<any>` 等写法，必须使用具体类型或 `unknown` + 类型守卫。

### Vue 3 + vue-tsc 已知坑

- composable 返回 reactive 对象做 prop 类型，必须用 `ShallowUnwrapRef<ReturnType<typeof useXxx>>`，直接用 `ReturnType<typeof useXxx>` 会暴露 Ref 包裹导致模板访问报错。
- `<script setup>` 中判别联合类型 narrowing 不稳定：访问独有字段统一用 `(row as ConcreteType).field` 显式断言或抽 type predicate `function isX(v): v is X`。
- 移除一个 `any` 必须沿调用链跑完整 build 确认所有消费方都通得过。

---

## 4. 构建验证与 Git

- 涉及类型或逻辑的改动，**commit 前**必须本地跑对应 `npm run build`（前端含 `vue-tsc`，后端 `nest build`）通过；`npm run dev` 不能替代完整 build。
- 多文件重构/拆分、批量类型改动、sub-agent 完成的工作，merge 回主干前必须在项目根目录跑一次完整 build。
- push 前 `git status` 二次确认改动范围；禁止 `git add 目录/` 或 `git add .`，必须用具体文件路径分批 add。

---

## 5. 交付质量

- 交付结果不得新增技术债：不留下临时兜底、重复逻辑、补丁式覆盖、超长文件/函数、未验证的 TODO 或「以后再处理」的半成品。
- 如正确方案超出本次范围，先说明影响和拆分方案，获得确认后再做；不得用错误但省事的方案交付。

---

## 6. 分层边界

| 层 | 职责 | 禁止 |
|----|------|------|
| `views` | 编排：读路由参数、调 composable、组合子组件 | 写业务计算 |
| `components` | UI 交互，通过 props/emit 通信 | 直接调 API 或 store |
| `composables` | 业务逻辑 | 引入 UI 组件、操作 DOM |
| `api/` | HTTP 封装 | 业务判断；请求/响应必须有 TS 类型 |
| `stores` | 跨页面共享或需持久化状态 | 单页临时状态；action 直接操作路由 |

- Vue `props` 用 `defineProps<{...}>()`，`emit` 用 `defineEmits<{...}>()`，Pinia state 显式声明类型。

---

## 7. 文件行数上限

| 文件类型 | 警戒线 | 硬上限 |
|----------|--------|--------|
| `views/*.vue` | 300 行 | 500 行 |
| `components/*.vue` | 200 行 | 350 行 |
| `composables/use*.ts` | 150 行 | 250 行 |
| `stores/*.ts` | 150 行 | 200 行 |
| backend `*.service.ts` | 300 行 | 500 行 |

- 一个 `.vue` 超过 2 个独立业务区块、一个 composable 超过 3 个关注点、同一逻辑出现 2 次以上，都必须拆分或抽取。

---

## 8. 字段编码约定

- 同一业务字段全系统使用统一 `code`、统一含义、统一展示方式和统一数据源。
- 表单、表格、筛选、排序优先基于 `fields/*` 或现有字段配置，不在页面内硬编码。
- 配置项持久化只存 `xxx_id`，禁止持久化名称、路径等冗余字段。
- 已约定为树形、级联、可搜索下拉等形态的字段，不得随意改成其他控件。
- 字段业务设计与列设置方案：见 [`FIELD_CONFIG_DESIGN.md`](FIELD_CONFIG_DESIGN.md)。
