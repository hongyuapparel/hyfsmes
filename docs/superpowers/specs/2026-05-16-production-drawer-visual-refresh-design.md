# 生产管理抽屉视觉刷新 — 设计稿

- 日期：2026-05-16
- 范围：生产管理 6 个页面（采购 / 纸样 / 工艺 / 裁床 / 车缝 / 尾部）的"详情"抽屉视觉布局
- 类型：纯 UI 优化（视觉一致性 + 可读性）
- 关联：紧接 [2026-05-15-production-detail-drawer-unification-design.md](2026-05-15-production-detail-drawer-unification-design.md) 之后

## 一、问题陈述

上一轮"详情入口与抽屉统一化"已经把 6 个抽屉的列入口、emit 事件、三段式结构和操作记录数据流统一。但视觉层面仍然不好用：

1. **抽屉太窄**：除纸样（760）和工艺（520）外，其余 4 个默认 460。基本信息长字段（订单号、客户名、客户交期）容易换行成两行，导致整个抽屉高瘦、要不停下拉。
2. **基本信息单列布局浪费横向空间**：`ProductionOrderBriefPanel` 用 `el-descriptions :column="1"`，订单号 / SKU / 订单数量 这类短字段独占整行，密度低。
3. **图片独占顶行**：当前布局把产品图放在 descriptions 顶上 `max-width:120px` 独占一整块横向空间，进一步压缩内容。
4. **与库存抽屉视觉不一致**：库存模块（`SimpleInventoryDetailDrawer` / `FinishedDetailDrawer`）已经定型「2 列 desc + 右侧图 + section 卡片化 + AppDrawer 可拖宽」的视觉语言，生产抽屉是另一套，全站不统一。

## 二、目标

1. 6 个生产抽屉默认更宽，且用户可拖宽。
2. 基本信息段双列 + 图片右侧，与库存 `SimpleInventoryDetailDrawer` 视觉对齐。
3. 三段（基本信息 / 业务详情 / 操作记录）保持同屏可见（**不上 tabs**），仅做卡片化分隔。
4. 全程**复用已有组件**：`AppDrawer` / `el-descriptions` / `OperationLogsSection` 全是现成，零新建组件。
5. **不影响业务逻辑**：抽屉内部业务详情区、表单交互、保存动作零改动；不动接口、不动数据库。

## 三、非目标

- 不上 tabs。生产抽屉的业务详情区不复杂（采购记录几行 / 批次时间轴 / 工艺明细几条），三段同屏完全装得下。
- 不改纸样抽屉的编辑表单交互。纸样既有 760 宽度保持，仅追加 `:resizable`。
- 不动库存抽屉。本期只调整生产抽屉，使其向库存视觉语言对齐。
- 不做响应式断点改造（除"小屏图片下移"兜底外）。生产抽屉假定桌面端 ≥ 1280px。

## 四、设计

### 4.1 抽屉壳尺寸策略

`ProductionDetailDrawerShell` 内部底层从 `el-drawer` 改为 `AppDrawer`（[components/AppDrawer.vue](frontend/src/components/AppDrawer.vue)，已支持 `size/minSize/maxSize/resizable`）。propagate 以下 props：

| prop | 默认 | 说明 |
|---|---|---|
| `size` | `760` | 默认宽（数字 px，与 AppDrawer 一致） |
| `minSize` | `680` | 拖宽下限 |
| `maxSize` | `1200` | 拖宽上限 |
| `resizable` | `true` | 是否允许拖宽 |

6 个 View 的接入策略：

| 模块 | 改后 size |
|---|---|
| 采购 / 工艺 / 裁床 / 车缝 / 尾部 | **`size=760, resizable`** |
| 纸样 | **`size=760` 保持不变**，追加 `resizable` |

约束：
- `ProductionDetailDrawerShell` 的 `size` prop 类型从原 `string \| number`（默认 `'460px'`）改为 `number`（默认 `760`），与 `AppDrawer` 一致。
- 6 个 View 调用处把 `size="460px"` / `size="520px"` 等字符串改为数字 `760`，`size="760px"`（纸样）改为 `760`。
- 不破坏 `@closed` 事件（AppDrawer 也透传该事件）。

### 4.2 基本信息段（ProductionOrderBriefPanel）布局

参照 [SimpleInventoryDetailDrawer.vue:99-115](frontend/src/components/inventory/SimpleInventoryDetailDrawer.vue) 的 `simple-detail-main` 网格：

```vue
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
        <span v-else class="text-placeholder">—</span>
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
/* 小屏兜底：抽屉拖窄到 < 540 时图片下移到顶部 */
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

变更要点：
- `el-descriptions :column="1"` → `:column="2"`
- 图片从顶部独占行 → 右侧独占 96px 列（grid 第二列）
- `AppImageThumb variant="compact"` → `variant="dialog"`（与库存简易抽屉一致）
- 旧 `.production-order-brief-panel__thumb` 与 `.production-order-brief-panel__desc { margin-top: 0 }` 旧样式移除

字号约束：所有标签 / 值沿用 `el-descriptions size="small"` 提供的字号，不写裸 `px font-size`。

### 4.3 section 卡片化样式

`ProductionDetailSection.vue` 内部样式补齐为卡片：

```css
.production-detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  padding: 10px 12px;
}
.production-detail-section-title {
  font-size: var(--font-size-body);
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}
```

约束：
- 仅用设计 token 与 Element Plus 的 CSS 变量；禁裸 px font-size、禁 `!important`、禁深层选择器覆盖。
- 三段（基本信息 / 业务详情 / 操作记录）都套这个卡片，section 之间靠 `ProductionDetailDrawerShell.production-detail-drawer-shell { gap: 12px }` 已有间距分隔。
- 已搬迁的 `OperationLogsSection.vue` 本身已带 border + radius + bg，仅需把 `font-size: 13px` 调为 `var(--font-size-body)`（符合 CLAUDE.md 第 5 节字号规范）。

### 4.4 改动文件清单

| 文件 | 改动 |
|---|---|
| `frontend/src/components/production/ProductionDetailDrawerShell.vue` | 底层 `el-drawer` → `AppDrawer`；props 增加 `minSize / maxSize / resizable`，`size` 类型改为 `number`，默认 `760` |
| `frontend/src/components/production/ProductionOrderBriefPanel.vue` | descriptions `:column="2"`，包一层 `__main` grid 容器，图片右侧独占 96px 列，`variant="dialog"` |
| `frontend/src/components/production/ProductionDetailSection.vue` | 补齐卡片样式（border + radius + bg + padding + 标题 token） |
| `frontend/src/components/common/OperationLogsSection.vue` | 标题字号 `13px` → `var(--font-size-body)`，与卡片样式 token 对齐 |
| `frontend/src/views/production/purchase.vue` | drawer `size="460px"`（或缺省）→ `:size="760" :min-size="680" :resizable` |
| `frontend/src/views/production/sewing.vue` | 同上 |
| `frontend/src/views/production/finishing.vue` | 同上 |
| `frontend/src/views/production/cutting.vue` + `frontend/src/composables/useCuttingDetail.ts` | 移除 `cuttingDetailDrawerSize` computed（当前根据状态返回 `940 \| '460px'`，类型混合），统一为 `:size="760" :resizable`；想看完成态大矩阵的用户可拖到 940 |
| `frontend/src/components/production/ProcessPageContent.vue` | drawer `size="520px"` → `:size="760" :resizable` |
| `frontend/src/views/production/pattern.vue` | drawer `size="760px"` → `:size="760" :resizable`（追加 resizable，宽度不变） |

## 五、影响面 / 改动量

| 维度 | 改动量 |
|---|---|
| 后端 | 不动 |
| 数据库 | 不动 |
| 业务逻辑 | 不动（采购登记 / 纸样保存 / 裁床完成等所有 mutation 不触碰） |
| 前端组件 | 4 个组件内部调整（DrawerShell / BriefPanel / DetailSection / OperationLogsSection），无新建组件 |
| 前端 View | 6 个 View 调 drawer props |
| 视觉风格 | 向库存抽屉视觉语言对齐 |

## 六、风险 / 验证

风险：
1. `AppDrawer` 与 `el-drawer` 的事件 / slot API 微小差异可能导致 `ProductionDetailDrawerShell` 现有 slot 使用方失效 → 验证：所有 6 个 View 抽屉在改后均能正常打开 / 关闭 / 触发 `@closed`。
2. `ProductionOrderBriefPanel` 双列布局后，缺字段较多的订单（如只有订单号 + SKU）可能左侧 grid 区域很矮，与右侧 96px 图片形成视觉空隙 → 接受，因为 ERP 数据通常字段齐全；空隙 ≤ 一个图片高度，可接受。
3. 部分 View 抽屉之前用了字符串 `size="760px"`，新 `AppDrawer.size` 是 `number`，强制类型转换需注意 → 已在 4.1 末尾约束 6 个 View 的传值必须改为数字。
4. 纸样抽屉因为内含编辑表单（用量表 / 图片上传 / 删除行），用户拖窄到 680 时表单可能拥挤 → 接受，因为用户可拖回；min 680 已经留出可用宽度。

验证清单（最终验收）：
- 6 个生产页面打开"详情"抽屉，默认宽度 760，左侧有 14px 拖宽手柄
- 拖宽手柄可拖到 1200 / 拖窄到 680，超出范围被夹紧
- 基本信息段：双列 descriptions + 右侧 96px 图片（无图片时占位"—"）
- 三段都呈现"卡片"视觉（border + radius + bg）
- 操作记录段字号与其他段一致（不再是 13px 裸值）
- 纸样抽屉编辑表单可正常输入 / 保存 / 删除行
- 关闭抽屉后再次打开，宽度恢复默认 760（验证 AppDrawer 的 onClosed 重置逻辑）

## 七、决策日志

- 默认宽 760，非 900：生产抽屉不含颜色尺码大矩阵，760 已足够双列描述 + 业务详情 + 操作记录三段同屏（用户拍板）
- 不上 tabs：生产业务详情区不复杂，三段同屏比 tabs 切换成本更低（用户拍板）
- 双列 + 右侧图：与 `SimpleInventoryDetailDrawer` 视觉对齐
- 卡片化 section：与 `OperationLogsSection` 既有视觉对齐
- 操作记录段字号统一到 `var(--font-size-body)`：满足 CLAUDE.md 第 5 节字号规范
- 纸样宽度保持 760，仅追加 resizable：尊重既有编辑表单需要的横向空间
