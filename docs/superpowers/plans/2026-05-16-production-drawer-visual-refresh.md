# 生产管理抽屉视觉刷新 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把生产管理 6 个抽屉的视觉布局向库存抽屉对齐：默认 760 宽 + 可拖宽，基本信息双列 + 右侧图，三段卡片化，统一字号 token。

**Architecture:** 仅前端组件层调整：`ProductionDetailDrawerShell` 内部底层 `el-drawer` 换为 `AppDrawer`（已有，支持 size/minSize/maxSize/resizable）；`ProductionOrderBriefPanel` 双列 grid + 右侧 96px 图；`ProductionDetailSection` + `OperationLogsSection` 卡片样式与字号 token 校准；6 个 View 调 drawer props。零业务逻辑/接口/数据库改动。

**Tech Stack:** Vue 3 + TypeScript + Element Plus（前端）。

**Spec:** [docs/superpowers/specs/2026-05-16-production-drawer-visual-refresh-design.md](../specs/2026-05-16-production-drawer-visual-refresh-design.md)

---

## 全局原则

1. **零业务/接口/数据库改动**：本计划只触碰前端组件 / View 的 drawer props、CSS、模板结构；任何业务逻辑、composable 内的取数逻辑、API、entity 一律不动。
2. **仅用设计 token 与 Element CSS 变量**：禁裸 `px font-size`（小尺寸场景如 12px caption 仍允许，但首选 `var(--font-size-caption)`）、禁 `!important`、禁深层选择器覆盖原组件机制。
3. **每个 Task 一个 commit**：commit message 模板在每个 Task 末尾给出。
4. **重启前端时**用 `powershell -ExecutionPolicy Bypass -File scripts/restart.ps1`，日志看 `.codex-frontend-5173.log`。
5. **遇到 plan 与现状不符**：先打开实际代码确认，按实际调整 + commit message 备注；与主线冲突停下来回报。

---

## Task 1：`ProductionDetailDrawerShell` 内部换 `AppDrawer`

**Files:**
- Modify: `frontend/src/components/production/ProductionDetailDrawerShell.vue`

**目的：** 底层从 `el-drawer` 换为 `AppDrawer`，propagate `size/minSize/maxSize/resizable` 四个 props，`size` 类型从 `string | number` 改为 `number`，默认 `760`。

- [ ] **Step 1: 重写 `ProductionDetailDrawerShell.vue` 全文**

把文件**整体替换**为下列内容：

```vue
<template>
  <AppDrawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    :min-size="minSize"
    :max-size="maxSize"
    :resizable="resizable"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <div class="production-detail-drawer-shell">
      <slot />
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import AppDrawer from '@/components/AppDrawer.vue'

withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    size?: number
    minSize?: number
    maxSize?: number
    resizable?: boolean
  }>(),
  {
    size: 760,
    minSize: 680,
    maxSize: 1200,
    resizable: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'closed'): void
}>()
</script>

<style scoped>
.production-detail-drawer-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
```

要点：
- `size` 类型由 `string | number` 改为 `number`，默认 `760`（AppDrawer 也是 `number`）
- 新增 3 个 prop：`minSize`（默认 `680`）、`maxSize`（默认 `1200`）、`resizable`（默认 `true`）
- 顶部 `import AppDrawer from '@/components/AppDrawer.vue'`
- `direction="rtl"` / `destroy-on-close` 由 AppDrawer 内部已带，本层无需重复
- 保留 `gap: 12px` 让三段之间有间距

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run build
```

期望：成功；不应在 ProductionDetailDrawerShell.vue 引发类型错误。如果 6 个 View 出现传 `size="460px"` 等字符串 → 字符串赋 number 的报错，**先记下来**（Task 5 会修），现在用 `// eslint-disable-next-line` 临时绕过不可行，**正确的做法是先做 Task 5 再回来验证**。

- [ ] **Step 3: 提交（先不验证，Task 5 联调时才有意义）**

```bash
git add frontend/src/components/production/ProductionDetailDrawerShell.vue
git commit -m "refactor(production): ProductionDetailDrawerShell 底层换 AppDrawer，支持可拖宽

- size 类型从 string|number 改为 number，默认 760
- 新增 minSize(680)/maxSize(1200)/resizable(true) 三个 prop
- 与库存 FinishedDetailDrawer 使用 AppDrawer 的模式对齐"
```

---

## Task 2：`ProductionOrderBriefPanel` 双列 + 右侧图

**Files:**
- Modify: `frontend/src/components/production/ProductionOrderBriefPanel.vue`

**目的：** 把单列 descriptions 改为双列；图片从顶部独占行移到右侧独占 96px 列。

- [ ] **Step 1: 重写文件全文**

把 `ProductionOrderBriefPanel.vue` **整体替换**为：

```vue
<script setup lang="ts">
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

export interface ProductionOrderBriefModel {
  orderNo: string
  skuCode: string
  imageUrl?: string | null
  customerName?: string
  merchandiser?: string
  customerDueDate?: string | null
  orderQuantity?: number | null
  orderDate?: string | null
  orderTypeLabel?: string
  collaborationLabel?: string
}

defineProps<{
  brief: ProductionOrderBriefModel | null
}>()

function dash(v: string | null | undefined) {
  const s = (v ?? '').trim()
  return s || '—'
}

function dateOnly(v: string | null | undefined) {
  if (v == null || String(v).trim() === '') return '—'
  return formatDate(String(v))
}
</script>

<template>
  <div v-if="brief" class="production-order-brief-panel">
    <div class="production-order-brief-panel__main">
      <el-descriptions :column="2" border size="small" class="production-order-brief-panel__desc">
        <el-descriptions-item label="订单号">{{ dash(brief.orderNo) }}</el-descriptions-item>
        <el-descriptions-item label="SKU">{{ dash(brief.skuCode) }}</el-descriptions-item>
        <el-descriptions-item v-if="brief.orderQuantity != null" label="订单数量">
          {{ formatDisplayNumber(brief.orderQuantity) }}
        </el-descriptions-item>
        <el-descriptions-item label="客户">{{ dash(brief.customerName) }}</el-descriptions-item>
        <el-descriptions-item label="跟单">{{ dash(brief.merchandiser) }}</el-descriptions-item>
        <el-descriptions-item label="客户交期">{{ dateOnly(brief.customerDueDate) }}</el-descriptions-item>
        <el-descriptions-item v-if="brief.orderDate" label="下单日期">{{ dateOnly(brief.orderDate) }}</el-descriptions-item>
        <el-descriptions-item v-if="brief.orderTypeLabel" label="订单类型">
          {{ dash(brief.orderTypeLabel) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="brief.collaborationLabel" label="合作方式">
          {{ dash(brief.collaborationLabel) }}
        </el-descriptions-item>
      </el-descriptions>
      <div class="production-order-brief-panel__image">
        <AppImageThumb v-if="brief.imageUrl" :raw-url="brief.imageUrl" variant="dialog" />
        <span v-else class="production-order-brief-panel__image-placeholder">—</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.production-order-brief-panel__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 12px;
  align-items: start;
}

.production-order-brief-panel__image {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.production-order-brief-panel__image-placeholder {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

/* 兜底：抽屉拖窄到 < 540px 时图片下移到顶部 */
@media (max-width: 540px) {
  .production-order-brief-panel__main {
    grid-template-columns: minmax(0, 1fr);
  }
  .production-order-brief-panel__image {
    order: -1;
  }
}
</style>
```

要点：
- `:column="1"` → `:column="2"`
- 包裹一层 `__main` grid 容器
- 图片从顶部独占行 → 右侧 96px 列
- `variant="compact"` → `variant="dialog"`（与库存 `SimpleInventoryDetailDrawer` 一致）
- 图片不存在时显示占位 `—`，字号用 `--font-size-caption`
- 旧 `__thumb` / `__desc { margin-top: 0 }` 样式已移除

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run build
```

期望：成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/production/ProductionOrderBriefPanel.vue
git commit -m "refactor(production): ProductionOrderBriefPanel 改为双列 + 右侧图

- el-descriptions :column=1 → :column=2
- 图片从顶部独占行 → 右侧独占 96px 列
- AppImageThumb variant=compact → variant=dialog
- 加 < 540px 媒体查询兜底（图片下移到顶部）
- 与 SimpleInventoryDetailDrawer 视觉对齐"
```

---

## Task 3：`ProductionDetailSection` 卡片化

**Files:**
- Modify: `frontend/src/components/production/ProductionDetailSection.vue`

**目的：** 三段都套 border + radius + bg 的"卡片"样式；标题字号用 token；从 `el-divider` 改为自己的 title `div`（与库存 `SimpleInventoryDetailDrawer` 一致）。

- [ ] **Step 1: 重写文件全文**

把 `ProductionDetailSection.vue` **整体替换**为：

```vue
<template>
  <section class="production-detail-section">
    <div v-if="title" class="production-detail-section__title">{{ title }}</div>
    <div class="production-detail-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style scoped>
.production-detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  padding: 10px 12px;
}

.production-detail-section__title {
  font-size: var(--font-size-body);
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.production-detail-section__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
```

要点：
- 移除 `el-divider`，改用自己的 `__title` div（与库存 `simple-detail-section-title` 一致）
- section 套 border + radius + bg（卡片样式）
- 字号用 `var(--font-size-body)`
- body 内部保留 `gap: 8px` 让多个子元素之间有间距

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run build
```

期望：成功。如果有 View 之前依赖了 `.el-divider` 的具体类名/层级选择器（不太可能但要扫一下），需要在 Task 5 联调时修。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/production/ProductionDetailSection.vue
git commit -m "refactor(production): ProductionDetailSection 卡片化样式

- 移除 el-divider，标题用自定义 div（与库存 simple-detail-section 对齐）
- section 套 border + radius + bg
- 字号统一 var(--font-size-body)"
```

---

## Task 4：`OperationLogsSection` 字号 token 校准

**Files:**
- Modify: `frontend/src/components/common/OperationLogsSection.vue`

**目的：** 标题字号从裸 `13px` 改为 `var(--font-size-body)`，与新的 `ProductionDetailSection` 标题保持视觉一致。

- [ ] **Step 1: 修改一处样式**

打开 `frontend/src/components/common/OperationLogsSection.vue`，找到：

```css
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
```

把 `font-size: 13px;` 改为 `font-size: var(--font-size-body);`：

```css
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: var(--font-size-body);
  color: var(--el-text-color-primary);
}
```

其他规则（如 `.detail-muted { font-size: 12px }`、`.detail-log-head { font-size: 12px }`、`.detail-log-body { font-size: 12px }`）**保持不变**——这些是日志项内文，12px 是合适的 caption 级字号。

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/common/OperationLogsSection.vue
git commit -m "refactor(operation-logs): 标题字号从裸 13px 改为 var(--font-size-body)

- 与 ProductionDetailSection 标题视觉对齐
- 日志项内文字号保持 12px（caption 级）"
```

---

## Task 5：6 个 View 调 drawer props + 清理 cutting 动态 size

**Files:**
- Modify: `frontend/src/views/production/purchase.vue:176`
- Modify: `frontend/src/views/production/pattern.vue:213`
- Modify: `frontend/src/views/production/cutting.vue:221`
- Modify: `frontend/src/views/production/sewing.vue:249`
- Modify: `frontend/src/views/production/finishing.vue:149`
- Modify: `frontend/src/components/production/ProcessPageContent.vue:229`
- Modify: `frontend/src/composables/useCuttingDetail.ts:38-40, 84`（移除 computed + export）

**目的：** 6 个 View 抽屉传 `:size="760" :resizable`（其他 props 走默认）；移除 cutting 的动态 size computed。

### 5.1 采购 purchase.vue

- [ ] **Step 1: 改 `purchase.vue:176`**

把：

```vue
    <ProductionDetailDrawerShell
      v-model="purchaseBriefDrawer.visible"
      title="订单与物料概要"
```

改为：

```vue
    <ProductionDetailDrawerShell
      v-model="purchaseBriefDrawer.visible"
      title="订单与物料概要"
      :size="760"
      :resizable="true"
```

（其他属性 `@closed` 等保持不动）

### 5.2 纸样 pattern.vue

- [ ] **Step 2: 改 `pattern.vue:213-218` 区域**

定位 ProductionDetailDrawerShell 调用块（含 `size="760px"`）。把：

```vue
    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="纸样详情"
      size="760px"
      ...其他属性
```

改为：

```vue
    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="纸样详情"
      :size="760"
      :resizable="true"
      ...其他属性
```

（确认其他属性如 `@closed` 等不动）

### 5.3 工艺 ProcessPageContent.vue

- [ ] **Step 3: 改 `ProcessPageContent.vue:229-233` 区域**

把：

```vue
    <ProductionDetailDrawerShell
      v-model="craftDetailDrawer.visible"
      title="工艺明细"
      size="520px"
      @closed="craftDetailDrawer.row = null"
```

改为：

```vue
    <ProductionDetailDrawerShell
      v-model="craftDetailDrawer.visible"
      title="工艺明细"
      :size="760"
      :resizable="true"
      @closed="craftDetailDrawer.row = null"
```

### 5.4 裁床 cutting.vue + useCuttingDetail.ts

- [ ] **Step 4: 改 `cutting.vue:221-226` 区域**

把：

```vue
    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="裁床详情"
      :size="cuttingDetailDrawerSize"
      @closed="onDetailDrawerClosed"
```

改为：

```vue
    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="裁床详情"
      :size="760"
      :resizable="true"
      @closed="onDetailDrawerClosed"
```

- [ ] **Step 5: 改 `cutting.vue:403` 区域** — 移除 `cuttingDetailDrawerSize` 从 useCuttingDetail 解构

定位 `cutting.vue` 中类似这样的代码块：

```typescript
const {
  // ...
  cuttingDetailDrawerSize,
  onDetailDrawerClosed,
  // ...
} = useCuttingDetail(...)
```

把 `cuttingDetailDrawerSize,` 这一行**删除**。

- [ ] **Step 6: 改 `useCuttingDetail.ts:38-40` + 移除 export `:84`**

打开 `frontend/src/composables/useCuttingDetail.ts`。

删除以下 computed 定义（约 38-40 行）：

```typescript
  const cuttingDetailDrawerSize = computed(() =>
    detailDrawer.row?.cuttingStatus === 'completed' ? 940 : '460px',
  )
```

并从 return 对象中移除 `cuttingDetailDrawerSize,`（约 84 行）。

如果文件顶部 `import { computed, ... }` 的 `computed` 现在没有其他用处，**保留**——不必为了节省一行 import 引入连带改动。如果有其他 `computed` 调用就保留；如果只此一处，**仍保留** import（不动跟本任务无关的部分）。

### 5.5 车缝 sewing.vue

- [ ] **Step 7: 改 `sewing.vue:249-253` 区域**

把：

```vue
    <ProductionDetailDrawerShell
      v-model="sewingBriefDrawer.visible"
      title="车缝外发概要"
      size="460px"
```

改为：

```vue
    <ProductionDetailDrawerShell
      v-model="sewingBriefDrawer.visible"
      title="车缝外发概要"
      :size="760"
      :resizable="true"
```

### 5.6 尾部 finishing.vue

- [ ] **Step 8: 改 `finishing.vue:149-152` 区域**

把：

```vue
    <ProductionDetailDrawerShell
      v-model="finishingBriefDrawer.visible"
      title="尾部进度概要"
```

改为：

```vue
    <ProductionDetailDrawerShell
      v-model="finishingBriefDrawer.visible"
      title="尾部进度概要"
      :size="760"
      :resizable="true"
```

### 联调验证

- [ ] **Step 9: 类型检查 + 启动前端**

```bash
cd frontend && npm run build
```

期望：零类型错误。如有错误，停下来报告（不要试图绕过）。

启动：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
Start-Sleep -Seconds 5
```

打开浏览器到 `http://localhost:5173`，登录后逐一打开 6 个生产页面的抽屉：

1. 采购 → 抽屉默认 760 宽，左侧有 14px 可拖手柄
2. 纸样 → 抽屉默认 760，可拖；编辑表单可正常输入
3. 工艺 → 抽屉默认 760，可拖
4. 裁床 → 抽屉默认 760（不再根据状态变 940 / 460），可拖
5. 车缝 → 抽屉默认 760，可拖
6. 尾部 → 抽屉默认 760，可拖

每个抽屉内部三段（基本信息 / 业务详情 / 操作记录）都呈现"卡片"视觉，基本信息双列且图片在右侧 96px 列。

- [ ] **Step 10: 提交**

```bash
git add frontend/src/views/production/purchase.vue frontend/src/views/production/pattern.vue frontend/src/views/production/cutting.vue frontend/src/views/production/sewing.vue frontend/src/views/production/finishing.vue frontend/src/components/production/ProcessPageContent.vue frontend/src/composables/useCuttingDetail.ts
git commit -m "refactor(production): 6 个抽屉统一 size=760 + resizable，移除 cutting 动态 size

- 采购/纸样/工艺/裁床/车缝/尾部 全部 :size=760 :resizable=true
- 移除 cuttingDetailDrawerSize computed（动态 940|'460px' 类型混合）
- 与新的 ProductionDetailDrawerShell + AppDrawer 配套
- 用户可拖到 1200 / 拖窄到 680"
```

---

## Task 6：端到端验收

- [ ] **Step 1: 重启前端**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
Start-Sleep -Seconds 5
Get-Content -Tail 30 .codex-frontend-5173.log
```

期望：成功启动，无编译错误。

- [ ] **Step 2: 6 个抽屉视觉验收**

对每个生产页面：

1. 打开任意行的"查看"抽屉
2. 默认宽度 760 ✓
3. 左侧有拖宽手柄，能拖到 ≥ 680（不再窄）且 ≤ 1200 ✓
4. 基本信息段：**双列描述**（订单号 / SKU 同行，订单数量 / 客户同行），**图片在右侧** 96 × 96 ✓
5. 三段都呈现"卡片"视觉（border 圆角 + 浅背景） ✓
6. 操作记录段标题字号与基本信息段标题字号一致 ✓
7. 关闭抽屉再次打开，宽度恢复 760 ✓

- [ ] **Step 3: 业务逻辑回归（确保零业务影响）**

为每个模块跑一次"写动作"，确认抽屉打开 + 抽屉内操作 + 后端落日志依旧正常：

- 采购：点击采购登记，弹窗能打开，登记后抽屉重开看到新日志
- 纸样：在抽屉内编辑用量 → 保存 → 重开抽屉看到新日志
- 工艺：完成工艺 → 抽屉重开看到新日志
- 裁床：裁床登记 → 抽屉重开看到新日志
- 车缝：分配 / 完成车缝 → 抽屉重开看到新日志
- 尾部：登记入库（含批次） → 抽屉重开看到新日志

期望：所有写动作和后端落日志行为与上一轮（视觉刷新前）一致。

- [ ] **Step 4: 库存抽屉回归（视觉无影响）**

打开"库存管理 → 成品库存 → 详情抽屉"和任一辅料/面料的简易详情抽屉，确认视觉与之前一致（因为本任务只动了 `OperationLogsSection` 的一处标题字号，库存详情抽屉视觉应保持几乎不变；如果你能看出 13px → 14px/15px 的差异是正常的）。

- [ ] **Step 5: 全屏类型 / 构建检查**

```bash
cd frontend && npm run check:el-radio-value
cd frontend && npm run build
```

期望：零错误。

- [ ] **Step 6: 更新 PROJECT_CONTEXT.md**

在 `docs/PROJECT_CONTEXT.md` 第四节末尾追加一条：

```markdown
- `2026-05-16`：生产管理 6 个抽屉视觉刷新：默认 760 宽 + 可拖（680~1200），基本信息双列 + 右侧图，三段卡片化，与库存抽屉视觉对齐；ProductionDetailDrawerShell 底层换为 AppDrawer，移除 cutting 抽屉动态 size computed。
```

- [ ] **Step 7: 提交**

```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs(context): 同步生产管理抽屉视觉刷新"
```

---

## 附录 — Cursor 执行约定

每完成一个 Task：
1. 跑该 Task 的 "类型检查 + 手测" 步骤
2. 按 commit message 模板提交一次 git
3. `git log --oneline -10` 自查
4. 切到下一个 Task

**特别提醒**：
- Task 1（DrawerShell 改造）和 Task 5（View 调 size）联调依赖 — Task 1 提交后类型检查可能因为 6 个 View 仍传字符串 `size="460px"` 而失败。**这是预期的**，等做完 Task 5 一起验证即可；不要为了让 Task 1 单独通过类型检查而在 6 个 View 里临时加 `// @ts-ignore`。
- 任务 2、3、4 互相无依赖，可并行做 / 串行做都可。
- Task 6 验证阶段如果发现某个 View 的 BriefPanel 字段缺失（如 `customerDueDate` 为空），不是 bug—那是订单本身没填数据，显示 `—` 是预期。
- 如果 Task 5 中某 View 的 ProductionDetailDrawerShell 调用比 spec 复杂（如多个 `@event`、多个 slot），保持原有其他属性不动，**仅追加 `:size="760" :resizable="true"`**。

完成全部 6 个 Task 后回报。
