<template>
  <div class="orders-card-list" v-loading="loading">
    <el-empty v-if="!loading && !list.length" description="暂无订单" />
    <div v-else class="order-card-grid">
      <div
        v-for="item in list"
        :key="item.id"
        class="order-card"
      >
        <div class="order-card-header">
          <div class="order-card-header-top">
            <div class="order-card-header-top-left">
              <span class="order-no" :title="item.orderNo">{{ item.orderNo }}</span>
              <el-tag
                class="order-status-tag"
                size="small"
                effect="light"
                :type="getStatusTagType(item.status)"
              >
                {{ getStatusLabel(item.status) }}
              </el-tag>
            </div>
            <el-checkbox
              :model-value="Boolean(cardSelected[item.id])"
              size="large"
              class="card-checkbox"
              @change="(val) => emit('toggle-select', item.id, Boolean(val))"
            />
          </div>
          <div class="order-card-header-main">
            <div class="order-card-image">
              <AppImageThumb
                v-if="item.imageUrl"
                :raw-url="item.imageUrl"
                variant="card"
              />
              <div v-else class="image-placeholder">图片</div>
            </div>
            <div class="order-card-main">
              <span class="sku-line">
                SKU：{{ item.skuCode || '-' }}
              </span>
              <div class="order-card-meta">
                <span>下单时间：{{ formatDateTime(item.orderDate) }}</span>
                <span :class="getCustomerDueDateClass(item.customerDueDate, item.status)">
                  客户交期：{{ formatDate(item.customerDueDate) }}
                </span>
                <span>完成时间：{{ formatDate(item.status === 'completed' ? item.statusTime : null) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="order-card-body">
          <div class="field-row">
            <span class="field-label">客户：</span>
            <span class="field-value ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">业务员：</span>
            <span class="field-value ellipsis">{{ item.salesperson || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">跟单员：</span>
            <span class="field-value ellipsis">{{ item.merchandiser || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">数量：</span>
            <el-popover
              v-if="!isSampleOrder(item)"
              placement="top-start"
              trigger="hover"
              :width="getSizePopoverWidth(item.id)"
              :show-arrow="true"
              @show="emit('show-size-popover', item)"
            >
              <template #reference>
                <span class="field-value qty-trigger">
                  {{ formatDisplayNumber(item.quantity) }} 件
                </span>
              </template>
              <div class="qty-popover">
                <div class="qty-popover-title">数量追踪</div>
                <div v-if="sizePopoverLoadingId === item.id" class="qty-popover-loading">
                  加载中...
                </div>
                <div v-else>
                  <template v-if="sizePopoverBlocks(item.id).length">
                    <div
                      v-for="(block, bIdx) in sizePopoverBlocks(item.id)"
                      :key="`${item.id}-bc-${bIdx}`"
                      class="qty-popover-block"
                    >
                      <div class="qty-popover-subtitle">{{ block.colorName }}</div>
                      <table class="qty-popover-table">
                        <thead>
                          <tr>
                            <th class="qty-header">尺码</th>
                            <th
                              v-for="(h, hIdx) in sizeBreakdownCache[item.id]?.headers ?? []"
                              :key="h + hIdx"
                              class="qty-header"
                            >
                              {{ h }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="row in block.rows"
                            :key="row.label"
                          >
                            <td class="qty-label">{{ row.label }}</td>
                            <td
                              v-for="(v, vIdx) in row.values"
                              :key="vIdx"
                              class="qty-value"
                            >
                              {{ v != null ? formatDisplayNumber(v) : '-' }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </template>
                  <div v-else class="qty-popover-empty">
                    暂无尺码明细
                  </div>
                </div>
              </div>
            </el-popover>
            <span v-else class="field-value">
              {{ formatDisplayNumber(item.quantity) }} 件
            </span>
          </div>
          <div class="field-row">
            <span class="field-label">出厂价：</span>
            <span class="field-value price-value">{{
              item.exFactoryPrice != null && item.exFactoryPrice !== ''
                ? `￥${formatDisplayNumber(item.exFactoryPrice)}`
                : '-'
            }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">销售价：</span>
            <span class="field-value price-value">{{
              item.salePrice != null && item.salePrice !== ''
                ? `￥${formatDisplayNumber(item.salePrice)}`
                : '-'
            }}</span>
          </div>
          <div v-if="getOrderMetaTags(item).length" class="field-row order-tags-row">
            <el-tag
              v-for="(tag, idx) in getOrderMetaTags(item)"
              :key="`${item.id}-${tag}-${idx}`"
              size="small"
              :effect="idx % 2 === 0 ? 'light' : 'plain'"
              class="order-meta-tag"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>
        <div class="order-card-footer">
          <div v-if="item.factoryName" class="footer-factory ellipsis" :title="item.factoryName">{{ item.factoryName }}</div>
          <div class="footer-actions">
            <span v-if="canEditOrderItem(item)" class="footer-action-item">
              <el-tooltip content="编辑" placement="top">
                <el-button link type="primary" size="small" circle class="action-btn" @click="emit('edit', item)">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </el-tooltip>
            </span>
            <span class="footer-action-item">
              <el-tooltip content="订单成本" placement="top">
                <el-button link size="small" circle class="action-btn" @click="emit('cost', item)">
                  <el-icon><Coin /></el-icon>
                </el-button>
              </el-tooltip>
            </span>
            <span class="footer-action-item">
              <el-tooltip content="订单备注" placement="top">
                <el-badge :value="item.remarkCount ?? 0" :hidden="!(item.remarkCount ?? 0)" :max="99" class="remark-badge">
                  <el-button link size="small" circle class="action-btn" @click="emit('remark', item)">
                    <el-icon><ChatDotRound /></el-icon>
                  </el-button>
                </el-badge>
              </el-tooltip>
            </span>
            <span class="footer-action-item">
              <el-tooltip content="操作记录" placement="top">
                <el-button link size="small" circle class="action-btn" @click="emit('operation-log', item)">
                  <el-icon><Clock /></el-icon>
                </el-button>
              </el-tooltip>
            </span>
            <span class="footer-action-item">
              <el-tooltip content="打印" placement="top">
                <el-button link size="small" circle class="action-btn" @click="emit('print', item)">
                  <el-icon><Printer /></el-icon>
                </el-button>
              </el-tooltip>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit, Printer, Clock, Coin, ChatDotRound } from '@element-plus/icons-vue'
import { formatDisplayNumber } from '@/utils/display-number'
import type { OrderListItem, OrderSizeBreakdownRes } from '@/api/orders'

interface SizePopoverBlockRow {
  label: string
  values: Array<number | null>
}

interface SizePopoverBlock {
  colorName: string
  rows: SizePopoverBlockRow[]
}

defineProps<{
  loading: boolean
  list: OrderListItem[]
  cardSelected: Record<number, boolean>
  sizePopoverLoadingId: number | null
  sizeBreakdownCache: Record<number, OrderSizeBreakdownRes>
  getStatusTagType: (status: string) => 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined
  getStatusLabel: (status: string) => string
  formatDateTime: (value: string | null | undefined) => string
  formatDate: (value: string | null | undefined) => string
  getCustomerDueDateClass: (customerDueDate: string | null | undefined, status: string | null | undefined) => string | undefined
  isSampleOrder: (item: OrderListItem) => boolean
  getSizePopoverWidth: (orderId: number) => number
  sizePopoverBlocks: (orderId: number) => SizePopoverBlock[]
  getOrderMetaTags: (item: OrderListItem) => string[]
  canEditOrderItem: (item: OrderListItem) => boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-select', orderId: number, checked: boolean): void
  (e: 'show-size-popover', order: OrderListItem): void
  (e: 'edit', order: OrderListItem): void
  (e: 'cost', order: OrderListItem): void
  (e: 'remark', order: OrderListItem): void
  (e: 'operation-log', order: OrderListItem): void
  (e: 'print', order: OrderListItem): void
}>()
</script>

<style scoped>
.orders-card-list {
  min-height: 200px;
}

.order-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg, #fff);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  min-width: 0;
  overflow: hidden;
}

.order-card-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.order-card-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.order-card-header-main {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.order-card-image {
  width: 72px;
  height: 72px;
  border-radius: var(--radius);
  overflow: hidden;
  background-color: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.image-placeholder {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
}

.order-card-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.card-checkbox {
  flex-shrink: 0;
  margin: 0;
  padding: 4px;
  cursor: pointer;
}

.card-checkbox :deep(.el-checkbox__inner) {
  transform: scale(1.2);
}

.order-no {
  font-weight: 600;
  font-size: var(--font-size-body, 14px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.sku-line {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.order-card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
  line-height: 1.3;
}

.order-card-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  font-size: var(--font-size-caption, 12px);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.field-label {
  color: var(--color-text-muted, #909399);
  flex-shrink: 0;
}

.field-value {
  flex: 1;
  min-width: 0;
}

.field-value.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty-trigger {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.qty-popover {
  font-size: 12px;
}

.qty-popover-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-subtitle {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-block:not(:first-child) {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
}

.qty-popover-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.qty-popover-table .qty-label {
  padding: 2px 4px;
  color: var(--color-text-muted, #909399);
  white-space: nowrap;
  text-align: left;
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

.qty-popover-loading,
.qty-popover-empty {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}

.qty-header {
  padding: 2px 4px;
  font-weight: 500;
  white-space: nowrap;
  text-align: center;
}

.order-tags-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-tags-row :deep(.el-tag) {
  max-width: 100%;
}

.order-tags-row .order-meta-tag {
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  border-top: 1px dashed var(--color-border);
  padding-top: 8px;
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
  min-width: 0;
}

.order-card-header-top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-status-tag {
  flex-shrink: 0;
}

.order-card-meta .due-overdue {
  color: var(--el-color-danger);
  font-weight: 600;
}

.order-card-meta .due-soon {
  color: var(--el-color-warning);
  font-weight: 600;
}

.footer-factory {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: auto;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.footer-actions .footer-action-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.footer-actions .action-btn {
  padding: 4px;
}

.footer-actions .action-btn :deep(.el-icon) {
  font-size: 16px;
}

.remark-badge {
  display: inline-block;
}

.remark-badge :deep(.el-badge__content) {
  font-size: 10px;
  line-height: 1;
  min-width: 14px;
  height: 14px;
}
</style>
