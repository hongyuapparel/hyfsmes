# 前端 UI 规范

> 涉及组件选用、抽屉弹窗、字号变量、editable-grid、样式约束时读取本文档。编辑 `frontend/**` 文件时适用。

---

## 1. 基础组件

- UI 编辑必须沿用 Element Plus 及项目基础组件：`AppDrawer`、`AppDialog`、设计 token、现有字段配置。
- **抽屉必须使用 `AppDrawer`，弹窗必须使用 `AppDialog`**，不自行实现同类组件。
- 可扩展时优先扩展 `props` / `slots` / 配置，不复制一份新实现。
- 抽屉、弹窗、表单区、工具栏、列表操作区等同类交互必须保持结构和视觉一致；特殊偏离先说明原因并获得确认。

---

## 2. 样式约束

- 禁止用补丁样式覆盖原组件机制：不用大段私有 CSS、`!important`、深层选择器、外层包裹遮盖、复制视觉结构来绕过系统组件。
- 优先使用 Element Plus 官方属性与主题变量；非必要不使用深层强制覆盖。
- 页面样式优先引用设计 token（颜色、间距、圆角、阴影），避免「页面私有视觉体系」。

---

## 3. 字号规范

仅使用设计系统字号变量，不写死 `font-size` 数值：

- `--font-size-title`（或兼容 `--font-size-h1`）
- `--font-size-subtitle`（或兼容 `--font-size-h3`）
- `--font-size-body`（或兼容 `--font-size-small`）
- `--font-size-caption`（或兼容 `--font-size-xsmall`）

---

## 4. 表单控件

- `el-radio` / `el-radio-button` 必须显式使用 `value` / `:value`，禁止用 `label` 充当选中值；改动后执行 `npm run check:el-radio-value`。

---

## 5. 可编辑表格（editable-grid）

单元格内放 `el-input`、`el-select`、`el-input-number`、textarea 等录入控件时：

- 统一在 `<el-table>` 上添加 `class="editable-grid"`。
- 外观复用 `design-system.css` 的全局 `.editable-grid` 规则：填写框无内框并铺满单元格，以表格线分隔，hover/focus 时整格高亮。
- 表头、数据行、合计行使用 `--editable-grid-header-h` / `--editable-grid-row-h` 保持等高；内容上下左右居中。
- 新建此类表禁止各自编写单元格内边距、边框或对齐样式；调整密度只改全局变量。
- 含图片列的表（如尺码矩阵）应在该表局部恢复自适应行高，避免图片被压缩。
