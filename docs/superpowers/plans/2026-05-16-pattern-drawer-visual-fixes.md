# 纸样抽屉视觉与编辑态修复 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复用户在视觉刷新后看到的 3 个具体问题：抽屉无法滚到操作记录段、纸样抽屉两个 descriptions 单列浪费空间且重复显示订单号/SKU、纸样物料默认进入编辑态没有编辑按钮。

**Architecture:** 3 处局部修改：① `ProductionDetailDrawerShell` 内部加滚动；② `pattern.vue` 内联两段改双列 + 删重复信息；③ `pattern.vue` 引入 `editMode` ref + 编辑/取消/保存三态，配合 `usePatternDialogs.ts` 移除自动 addRow。零后端改动。

**Tech Stack:** Vue 3 + TypeScript + Element Plus。

**用户拍板的决策**：
- 编辑态改造仅做纸样（A 方案），不抽组件
- 「编辑」按钮放「纸样物料/裁片清单」section 标题右侧（Q1=a）
- 做「取消」按钮，点击恢复编辑前的数据（Q2=a）
- 保存成功后自动退出编辑态（Q3=a）
- 抽屉关闭再打开自动回到查看态（默认行为）

---

## 全局原则

1. 仅前端组件 / view / composable 改动；零后端、零接口、零数据库。
2. 仅用设计 token + Element CSS 变量；禁裸 `px font-size`、禁 `!important`。
3. 每个 Task 一个 commit。
4. 重启前端：`powershell -ExecutionPolicy Bypass -File scripts/restart.ps1`。

---

## Task 1：DrawerShell 加滚动支持（修问题 ③）

**Files:**
- Modify: `frontend/src/components/production/ProductionDetailDrawerShell.vue`

**目的：** 内容超长时，抽屉内容区可垂直滚动（让用户能看到最底部的操作记录段）。AppDrawer 的 body 设了 `height:100% + min-height:0 + overflow:hidden`，外层期待子元素自行处理滚动。当前 `production-detail-drawer-shell` 缺 `flex/min-height/overflow`，所以内容超出时被截。

- [ ] **Step 1: 修改 `production-detail-drawer-shell` 样式**

打开 `frontend/src/components/production/ProductionDetailDrawerShell.vue`，找到底部 `<style scoped>` 区块：

```css
<style scoped>
.production-detail-drawer-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
```

替换为：

```css
<style scoped>
.production-detail-drawer-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  /* 留 4px 给滚动条 + 6px 内边距，避免滚动条贴紧右边 */
  padding-right: 4px;
}
</style>
```

要点：
- `flex: 1 + min-height: 0 + height: 100%`：占满 AppDrawer body 的可用高度
- `overflow-y: auto`：仅垂直方向出现滚动条，超长内容才滚动
- `padding-right: 4px`：避免滚动条紧贴右边视觉割裂

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run build
```

期望：成功，无类型错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/production/ProductionDetailDrawerShell.vue
git commit -m "fix(production): DrawerShell 内容超长时支持垂直滚动

- 加 flex: 1 + min-height: 0 + height: 100% + overflow-y: auto
- 修复纸样等内容多的抽屉无法滚到底部操作记录段"
```

---

## Task 2：纸样抽屉两段改双列 + 删订单号/SKU 重复显示（修问题 ①）

**Files:**
- Modify: `frontend/src/views/production/pattern.vue:225 / :238 / :251-254`

**目的：** "业务扩展信息" 和 "时效与节点" 两段当前 `:column="1"` 浪费横向空间，改为 `:column="2"`。"纸样物料/裁片清单" 段顶部重复显示订单号/SKU（基本信息段已经有），整段删除。

- [ ] **Step 1: 改业务扩展信息为双列**

打开 `frontend/src/views/production/pattern.vue`，找到 `:225` 处：

```vue
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="1" border size="small" class="pattern-brief-extra">
```

把 `:column="1"` 改为 `:column="2"`：

```vue
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="2" border size="small" class="pattern-brief-extra">
```

- [ ] **Step 2: 改时效与节点为双列**

找到 `:238` 处：

```vue
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="pattern-brief-extra">
```

把 `:column="1"` 改为 `:column="2"`：

```vue
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="2" border size="small" class="pattern-brief-extra">
```

- [ ] **Step 3: 删除纸样物料段顶部重复的订单号/SKU**

找到 `:250-254` 处：

```vue
        <ProductionDetailSection title="纸样物料/裁片清单">
          <div class="materials-brief">
            <div>订单号：{{ detailDrawer.row.orderNo }}</div>
            <div>SKU：{{ detailDrawer.row.skuCode }}</div>
          </div>

          <div class="materials-actions">
```

整段 `<div class="materials-brief">...</div>` 包含两行 `<div>` 删除，变成：

```vue
        <ProductionDetailSection title="纸样物料/裁片清单">
          <div class="materials-actions">
```

- [ ] **Step 4: 清理孤儿 CSS（如果有）**

在文件底部 `<style scoped>` 区块用 grep 找 `.materials-brief`。如果存在，删除该类的所有 CSS 规则。

如果没有，跳过此步。

- [ ] **Step 5: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：成功。打开纸样抽屉肉眼确认：
- 业务扩展信息现在每行 2 项（纸样师 / 车版师 同行；纸样状态 单独）
- 时效与节点每行 2 项（到纸样时间 / 完成时间 同行；时效判定 单独）
- 纸样物料段顶部不再有"订单号：xxx / SKU：xxx"两行

- [ ] **Step 6: 提交**

```bash
git add frontend/src/views/production/pattern.vue
git commit -m "fix(pattern): 纸样抽屉两段改双列 + 删订单号/SKU 重复显示

- 业务扩展信息 / 时效与节点 从 :column=1 改 :column=2
- 删除纸样物料段顶部冗余的订单号/SKU（基本信息段已有）
- 清理孤儿 .materials-brief 样式（如有）"
```

---

## Task 3：纸样物料引入「查看 / 编辑」模式切换（修问题 ②）

**Files:**
- Modify: `frontend/src/views/production/pattern.vue`
- Modify: `frontend/src/composables/usePatternDialogs.ts:126, :129`

**目的：** 打开抽屉默认查看态，按钮显示「编辑」；点击进入编辑态后，按钮变「保存 / 取消」，输入框启用，新增/删除按钮可见；保存成功或取消后回到查看态。

### 3.1 移除 composable 中的自动 addRow

打开抽屉时如果接口返回空 materials，当前 composable 自动加一个空白行（[usePatternDialogs.ts:126, :129](frontend/src/composables/usePatternDialogs.ts)）。新语义下查看态不应自动加行，编辑态由用户自己点「新增」。

- [ ] **Step 1: 改 `usePatternDialogs.ts:117-131`**

定位 `openPatternDetailDrawer` 函数，找到这两行（约在 :126 和 :129）：

```typescript
      if (!materialsForm.materials.length && canEditPatternMaterials.value) addMaterialRow()
```

**两处都删除**（一处在 try 块成功后，一处在 catch 块兜底）。删除后该函数体内不再调用 addMaterialRow。

完整改后大致如下：

```typescript
  async function openPatternDetailDrawer(row: PatternListItem) {
    detailDrawer.row = row
    detailDrawer.visible = true
    detailDrawer.loading = true
    try {
      const data = await fetchPatternMaterials(row.orderId)
      materialsForm.materials = (data?.materials ?? []).map(normalizePatternMaterialRow)
      materialsForm.remark = data?.remark ?? ''
    } catch {
      // 失败兜底：保持已重置的空 form，由 view 层提示
    } finally {
      detailDrawer.loading = false
    }
  }
```

注：catch 块原本只有 `if (!materialsForm.materials.length && canEditPatternMaterials.value) addMaterialRow()` 一行——删掉后 catch 体变空，按上面写法用注释占位即可（避免空 catch 体某些 lint 报警）。

### 3.2 view 层引入 editMode 与三态按钮

- [ ] **Step 2: 在 `pattern.vue` `<script setup>` 区加入 editMode + snapshot 辅助**

定位 `<script setup>` 区中调用 `usePatternDialogs(...)` 解构的位置（约 :555-580）。在其**后面**追加：

```typescript
import { ref } from 'vue'

const materialsEditMode = ref(false)
let materialsSnapshot: { materials: PatternMaterialRow[]; remark: string } | null = null

function enterMaterialsEdit() {
  // 进入编辑态前，对 form 做深拷贝快照，用于取消恢复
  materialsSnapshot = {
    materials: JSON.parse(JSON.stringify(materialsForm.materials)),
    remark: materialsForm.remark,
  }
  // 编辑态下若 materials 为空，自动给一行让用户开始填
  if (!materialsForm.materials.length) {
    addMaterialRow()
  }
  materialsEditMode.value = true
}

function cancelMaterialsEdit() {
  if (materialsSnapshot) {
    materialsForm.materials = materialsSnapshot.materials
    materialsForm.remark = materialsSnapshot.remark
  }
  materialsSnapshot = null
  materialsEditMode.value = false
}

async function handleSubmitMaterials() {
  if (detailDrawer.saving) return
  try {
    await submitMaterials()
    materialsSnapshot = null
    materialsEditMode.value = false
  } catch {
    // submitMaterials 内部已 ElMessage 报错；保留编辑态让用户重试
  }
}
```

类型导入：如 `PatternMaterialRow` 类型还没在 view 层 import，从 composable 暴露处加 `type PatternMaterialRow` import：

```typescript
import type { PatternMaterialRow } from '@/composables/usePatternDialogs'
```

（如果该类型在别处导出，参照现有 import 写法）

- [ ] **Step 3: 在 `pattern.vue` 抽屉中加 watch，关闭时重置编辑态**

在 Step 2 的代码后面追加：

```typescript
import { watch } from 'vue'

watch(
  () => detailDrawer.visible,
  (visible) => {
    if (!visible) {
      materialsEditMode.value = false
      materialsSnapshot = null
    }
  },
)
```

如果文件顶部已经 import 过 `watch`，不要重复 import；合并到既有 import 行。

- [ ] **Step 4: 模板层 — 标题右侧加按钮**

找到 `pattern.vue:250` 的 `<ProductionDetailSection title="纸样物料/裁片清单">` 开标签。

当前 `ProductionDetailSection` 组件只接受 `title` prop（[ProductionDetailSection.vue](frontend/src/components/production/ProductionDetailSection.vue) Task 1 改造后），不支持标题旁的额外内容。我们采用**最小动作**：把现有结构 `materials-actions`（含「新增」按钮）扩展为"编辑/取消/新增/保存"按钮组，整体放在 section 内顶部（即标题下方一行）。

把 `pattern.vue:256-266` 区域：

```vue
          <div class="materials-actions">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="detailDrawer.loading || !canEditPatternMaterials"
              @click="addMaterialRow"
            >
              新增
            </el-button>
          </div>
```

替换为：

```vue
          <div class="materials-actions">
            <template v-if="!materialsEditMode">
              <el-button
                v-if="canEditPatternMaterials"
                type="primary"
                size="small"
                :disabled="detailDrawer.loading"
                @click="enterMaterialsEdit"
              >
                编辑
              </el-button>
            </template>
            <template v-else>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="detailDrawer.loading"
                @click="addMaterialRow"
              >
                新增
              </el-button>
              <el-button
                size="small"
                :disabled="detailDrawer.saving"
                @click="cancelMaterialsEdit"
              >
                取消
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="detailDrawer.saving"
                :disabled="detailDrawer.loading"
                @click="handleSubmitMaterials"
              >
                保存
              </el-button>
            </template>
          </div>
```

要点：
- 查看态：仅显示「编辑」按钮（且需要 `canEditPatternMaterials` 权限）
- 编辑态：显示「新增 / 取消 / 保存」三个按钮
- 「保存」按钮的 click 改为 `handleSubmitMaterials`（包了一层确保成功后退出编辑态）

- [ ] **Step 5: 模板层 — 输入控件 disabled 改用 editMode**

把表格里 6 个 `:disabled="!canEditPatternMaterials"` 全部改为 `:disabled="!canEditPatternMaterials || !materialsEditMode"`：

- `:283` el-select disabled
- `:286` materialName el-input disabled
- `:295` fabricWidth el-input disabled
- `:306` usagePerPiece el-input-number disabled
- `:317` cuttingQuantity el-input-number disabled
- `:323` remark el-input disabled

逐一改为：

```vue
:disabled="!canEditPatternMaterials || !materialsEditMode"
```

总体备注 textarea（约 `:340`）也改为：

```vue
:disabled="!canEditPatternMaterials || !materialsEditMode"
```

- [ ] **Step 6: 模板层 — 删除列 v-if 改用 editMode**

把 `:326`：

```vue
<el-table-column v-if="canEditPatternMaterials" label="操作" width="70" fixed="right" align="center">
```

改为：

```vue
<el-table-column v-if="canEditPatternMaterials && materialsEditMode" label="操作" width="70" fixed="right" align="center">
```

- [ ] **Step 7: 模板层 — 删除抽屉底部冗余的「保存」按钮**

由于 Step 4 已把保存按钮挪到 section 标题旁，原 `:344-354` 处的底部「保存」按钮组重复，整段删除：

```vue
          <div class="detail-drawer-footer">
            <el-button
              v-if="canEditPatternMaterials"
              type="primary"
              :loading="detailDrawer.saving"
              :disabled="detailDrawer.loading"
              @click="submitMaterials"
            >
              保存
            </el-button>
          </div>
```

整个 `<div class="detail-drawer-footer">...</div>` 块删除。

如有 `.detail-drawer-footer` 在 `<style scoped>` 的 CSS 规则，一并删除（孤儿样式）。

- [ ] **Step 8: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：成功，无类型错误。

- [ ] **Step 9: 浏览器手测 4 个交互路径**

打开纸样抽屉，逐一验证：

1. **打开默认查看态**：所有 input/select 灰色 disabled；右上区只显示「编辑」按钮（有权限的账号）；表格无「操作」列；空数据时**不再自动加一行空白**。
2. **进入编辑态**：点「编辑」→ 所有 input 启用；按钮变「新增 / 取消 / 保存」；表格出现「操作」列「删除」按钮。
3. **取消恢复**：随便改几个 input 值 → 点「取消」→ 数据恢复到编辑前；回到查看态。
4. **保存成功**：进入编辑态 → 改点东西 → 点「保存」→ 接口成功后自动回到查看态；改动已持久化（重开抽屉数据还在）。
5. **关闭抽屉**：在编辑态下点抽屉右上 ✕ 或外部空白关闭 → 重新打开后回到查看态（不留任何编辑残留）。

- [ ] **Step 10: 提交**

```bash
git add frontend/src/composables/usePatternDialogs.ts frontend/src/views/production/pattern.vue
git commit -m "feat(pattern): 纸样物料引入查看/编辑模式切换

- 默认查看态：所有 input 只读，仅显示「编辑」按钮
- 编辑态：input 启用，按钮组为「新增/取消/保存」
- 取消：恢复进入编辑前的 form 快照
- 保存成功：自动回到查看态
- 抽屉关闭：editMode 重置
- composable: 移除自动 addRow（改由 enterEditMode 时按需触发）
- 删除原抽屉底部冗余的保存按钮"
```

---

## Task 4：端到端验收

- [ ] **Step 1: 全模块抽屉视觉巡检**

打开 6 个生产页面的抽屉，逐一确认：

1. **纸样**：业务扩展信息 / 时效与节点 双列；纸样物料段顶部无订单号/SKU；按钮组「编辑」/「新增 取消 保存」三态切换正常
2. **采购 / 工艺 / 裁床 / 车缝 / 尾部**：视觉无变化（本 plan 没动它们），但要确认**滚动**正常——内容超长时能滚到底部操作记录段（Task 1 影响全部 6 个抽屉）

- [ ] **Step 2: 库存抽屉回归**

打开「成品库存详情」、「辅料/面料简易详情」抽屉，确认视觉无影响（Task 1 改的是生产专用 `ProductionDetailDrawerShell`，库存用的是 `AppDrawer` 直接接入，不受影响）。

- [ ] **Step 3: 业务回归**

对纸样抽屉跑一次完整保存：进入编辑 → 修改用量 → 保存 → 重开抽屉验证数据持久化 + 看到一条 `production_pattern_update` 操作日志（来自上一轮的日志接入）。

- [ ] **Step 4: 全屏构建检查**

```bash
cd frontend && npm run build
cd frontend && npm run check:el-radio-value
```

期望：零错误。

- [ ] **Step 5: 更新 PROJECT_CONTEXT.md**

在 `docs/PROJECT_CONTEXT.md` 第四节末尾追加：

```markdown
- `2026-05-16`：生产管理抽屉视觉刷新后修复 3 项：DrawerShell 支持垂直滚动（避免操作记录段被截）；纸样抽屉业务扩展/时效与节点改双列且删除重复订单号/SKU；纸样物料引入「查看/编辑」模式切换（编辑/取消/保存按钮在 section 标题区）。
```

- [ ] **Step 6: 提交**

```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs(context): 同步纸样抽屉视觉修复与编辑态改造"
```

---

## 附录 — Cursor 执行约定

- Task 1 → Task 2 → Task 3 顺序执行，每个 Task 一个 commit。
- Task 3 是本批改动最复杂的（涉及 view + composable 协同）；执行 Step 9 浏览器手测时必须每一项都实测，**不能跳过**。
- 如果发现 `usePatternDialogs.ts` 暴露的接口与本 plan 描述有细节差异（如 `PatternMaterialRow` type 不在该文件导出），按实际 import 路径调整 + 在 commit message 备注；不要凭猜测。
- 完成全部 4 个 Task 后回报，附 `git log --oneline -10`。
