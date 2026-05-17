# 纸样保存后操作记录刷新 + 备注 textarea 行高对齐 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① bug 修复：保存纸样物料后操作记录段没有刷新，看不到新落的日志；② 视觉修复：备注 textarea 1 行高度与表格内 size="small" 输入框完全等高。

**Architecture:** 前端两处小改：`pattern.vue` 中 `handleSubmitMaterials` 在保存成功后调用 `loadPatternDrawerLogs` 重拉日志；`pattern.css` 给 textarea 加 padding/line-height 精调。零后端、零接口改动。

**Tech Stack:** Vue 3 + Element Plus。

---

## Task 1：保存后重新拉取操作日志（bug 修复）

**Files:**
- Modify: `frontend/src/views/production/pattern.vue:641-648`

**目的：** 当前 `loadPatternDrawerLogs` 只在 `detailDrawer.row` 变化时被 watch 触发；保存后 row 不变，所以日志列表不会被刷新——用户最近一次保存的日志要等关抽屉重开才能看到。修复办法：在 `handleSubmitMaterials` 的 `ok` 分支里显式重拉一次。

- [ ] **Step 1: 改 `handleSubmitMaterials`**

打开 `frontend/src/views/production/pattern.vue`，找到约 :641-648 的 `handleSubmitMaterials` 函数：

```typescript
async function handleSubmitMaterials() {
  if (detailDrawer.saving) return
  const ok = await submitMaterials()
  if (ok) {
    materialsSnapshot = null
    materialsEditMode.value = false
  }
}
```

在 `materialsEditMode.value = false` **之后**加一行 `await loadPatternDrawerLogs(detailDrawer.row)`：

```typescript
async function handleSubmitMaterials() {
  if (detailDrawer.saving) return
  const ok = await submitMaterials()
  if (ok) {
    materialsSnapshot = null
    materialsEditMode.value = false
    await loadPatternDrawerLogs(detailDrawer.row)
  }
}
```

要点：
- 保存成功 → 关闭编辑态 → 重新拉日志，让用户立刻看到刚才操作落下的新日志
- 失败分支不动（保留编辑态，让用户重试）
- 注意 `loadPatternDrawerLogs` 函数声明在文件下方 :662，因为是 Vue 3 setup script 顶层声明 hoisting 可用——如果出现 "used before declaration" 编译错误（不太可能），把这个 await 调用挪到 `loadPatternDrawerLogs` 定义之后即可

- [ ] **Step 2: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：成功。

- [ ] **Step 3: 浏览器手测**

打开纸样抽屉 → 进入编辑态 → 改一个字段（比如裁片数量从 1 → 3）→ 点保存 →
1. 自动回到查看态 ✓
2. 「操作记录」段**立刻出现一条新日志**：`修改用量：...`（包含新的裁片数量数据） ✓
3. 不需要关抽屉重开就能看到 ✓

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/production/pattern.vue
git commit -m "fix(pattern): 保存物料后立即刷新操作记录

- handleSubmitMaterials 在 ok 分支末尾 await loadPatternDrawerLogs(detailDrawer.row)
- 修复保存后用户看不到刚落日志、需关抽屉重开的问题
- 失败分支不动，保留编辑态让用户重试"
```

---

## Task 2：备注 textarea 1 行高度与 small input 完全等高

**Files:**
- Modify: `frontend/src/views/production/pattern.css`

**目的：** 当前 textarea 的 `min-height: 24px` 不足以让视觉与 small input 等高，因为 textarea 默认 padding-top/bottom 比 small input 大。需要精调 padding + line-height。

- [ ] **Step 1: 改 `pattern.css` 的 `:deep(.el-textarea__inner)` 规则**

打开 `frontend/src/views/production/pattern.css`，找到约 :178-180 的规则：

```css
.materials-remark-field :deep(.el-textarea__inner) {
  min-height: 24px;
}
```

替换为：

```css
.materials-remark-field :deep(.el-textarea__inner) {
  min-height: 24px;
  padding-top: 1px;
  padding-bottom: 1px;
  line-height: 22px;
}
```

要点：
- `padding-top/bottom: 1px` + `line-height: 22px` → 1 行内容总高度 1+22+1 = 24px，与 size="small" input 等高
- `min-height: 24px` 保证空 textarea 占 24px
- 左右 padding 由 Element Plus 默认控制不动
- 多行时 textarea 撑高，每行间距由 `line-height: 22px` 决定，紧凑但不挤
- 仅影响 `.materials-remark-field` 作用域内的 textarea，不影响其他模块

- [ ] **Step 2: 重启浏览器手测**

```bash
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

打开纸样抽屉 → 进入编辑态 → 看「备注」区：
1. textarea 空时高度**目测与表格内「物料名称」、「备注」列 input 完全等高** ✓
2. label「备注」与 textarea 第一行水平方向上垂直居中对齐 ✓
3. 输入 2-3 行文字后 textarea 自动撑高，行间距紧凑但可读 ✓
4. 输入 > 8 行后 textarea 高度停止增长，内部出现滚动条 ✓

如果 Step 2 项 1 仍发现高度差 > 2px，把 `padding-top: 1px` 改为 `padding-top: 0` 再测。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/views/production/pattern.css
git commit -m "fix(pattern): 备注 textarea 1 行高度精确对齐 small input

- padding-top/bottom 1px + line-height 22px → 总高 24px
- 与表格内 size=small input 视觉完全等高
- autosize 多行能力保留"
```

---

完成 2 个 Task 后回报 `git log --oneline -4`。
