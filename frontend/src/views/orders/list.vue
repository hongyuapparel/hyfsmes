<template>
  <div class="page-card orders-list-page">
    <!-- 状态切换 + 新建订单 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentStatus" size="large" @change="onStatusChange">
          <el-radio-button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ getStatusTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="status-tabs-right">
        <el-button type="primary" size="small" @click="onCreateOrder">新建订单</el-button>
      </div>
    </div>

    <!-- 筛选区：与客户管理 / 产品列表保持同一设计 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.orderNo && orderNoLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU编号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.skuCode && skuCodeLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            SKU编号：
          </span>
        </template>
      </el-input>
      <el-select
        v-model="filter.customer"
        placeholder="客户"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.customer, 42)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.customer">客户：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in customerOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span
            v-if="filter.orderTypeId"
            :style="{ color: 'var(--el-color-primary)' }"
          >
            订单类型：
          </span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.processItem"
        placeholder="工艺项目"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.processItem && `工艺项目：${filter.processItem}`,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.processItem">工艺项目：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in secondaryProcessOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-select
        v-model="filter.salesperson"
        placeholder="业务员"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.salesperson)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.salesperson">业务员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="name in salespersonOptions"
          :key="name"
          :label="name"
          :value="name"
        />
      </el-select>
      <el-select
        v-model="filter.merchandiser"
        placeholder="跟单员"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.merchandiser)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.merchandiser">跟单员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="name in merchandiserOptions"
          :key="name"
          :label="name"
          :value="name"
        />
      </el-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        :class="['filter-bar-item', { 'range-single': !orderDateRange }]"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
      <el-date-picker
        v-model="completedRange"
        type="daterange"
        range-separator=""
        start-placeholder="完成时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        :class="['filter-bar-item', { 'range-single': !completedRange }]"
        :style="getFilterRangeStyle(completedRange)"
        @change="onSearch"
      />
      <el-select
        v-model="filter.factory"
        placeholder="加工厂"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.factory)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.factory">加工厂：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in factoryOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="canDeleteOrders && hasSelection"
          type="danger"
          size="large"
          @click="onBatchDelete"
        >
          删除
        </el-button>
        <el-button
          v-if="hasSelection"
          type="warning"
          size="large"
          @click="onBatchCopyToDraft"
        >
          复制为草稿
        </el-button>
        <el-button
          v-if="canReviewOrders && isPendingReviewTab && hasSelection"
          type="success"
          size="large"
          @click="openReviewDialog"
        >
          审单
        </el-button>
      </div>
    </div>

    <!-- 订单卡片宫格 -->
    <div class="orders-card-list">
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
                v-model="cardSelected[item.id]"
                size="large"
                class="card-checkbox"
                @change="onCardSelectChange"
              />
            </div>
            <div class="order-card-header-main">
              <div class="order-card-image">
                <el-image
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  fit="cover"
                  :preview-src-list="[item.imageUrl]"
                />
                <div v-else class="image-placeholder">图片</div>
              </div>
              <div class="order-card-main">
                <span class="sku-line">
                  SKU：{{ item.skuCode || '-' }}
                  <template v-if="collaborationDisplay(item)">
                    · {{ collaborationDisplay(item) }}
                  </template>
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
                placement="top-start"
                trigger="hover"
                :width="Math.max(320, (sizeBreakdownCache[item.id]?.headers.length || 1) * 72)"
                :show-arrow="true"
                @show="onShowSizePopover(item)"
              >
                <template #reference>
                  <span class="field-value qty-trigger">
                    {{ item.quantity }} 件
                  </span>
                </template>
                <div class="qty-popover">
                  <div class="qty-popover-title">数量追踪</div>
                  <div v-if="sizePopoverLoadingId === item.id" class="qty-popover-loading">
                    加载中...
                  </div>
                  <div v-else>
                    <table
                      v-if="sizeBreakdownCache[item.id]"
                      class="qty-popover-table"
                    >
                      <thead>
                        <tr>
                          <th class="qty-header">尺码</th>
                          <th
                            v-for="(h, hIdx) in sizeBreakdownCache[item.id].headers"
                            :key="h + hIdx"
                            class="qty-header"
                          >
                            {{ h }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in sizeBreakdownCache[item.id].rows"
                          :key="row.label"
                        >
                          <td class="qty-label">{{ row.label }}</td>
                          <td
                            v-for="(v, vIdx) in row.values"
                            :key="vIdx"
                            class="qty-value"
                          >
                            {{ v != null ? v : '-' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="qty-popover-empty">
                      暂无尺码明细
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>
            <div class="field-row">
              <span class="field-label">出厂价：</span>
              <span class="field-value price-value">￥{{ item.exFactoryPrice }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">销售价：</span>
              <span class="field-value price-value">￥{{ item.salePrice }}</span>
            </div>
            <div v-if="orderTypeDisplay(item) || item.processItem" class="field-row order-tags-row">
              <el-tag
                v-if="orderTypeDisplay(item)"
                size="small"
                effect="light"
                class="order-type-tag"
              >
                {{ orderTypeDisplay(item) }}
              </el-tag>
              <el-tag
                v-if="item.processItem"
                size="small"
                effect="plain"
                class="process-item-tag"
              >
                {{ item.processItem }}
              </el-tag>
            </div>
          </div>
          <div class="order-card-footer">
            <div v-if="item.factoryName" class="footer-factory ellipsis" :title="item.factoryName">{{ item.factoryName }}</div>
            <div class="footer-actions">
              <span class="footer-action-item">
                <el-tooltip content="编辑" placement="top">
                  <el-button link type="primary" size="small" circle class="action-btn" @click="openEdit(item)">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                </el-tooltip>
              </span>
              <span class="footer-action-item">
                <el-tooltip content="订单成本" placement="top">
                  <el-button link size="small" circle class="action-btn" @click="openCost(item)">
                    <el-icon><Coin /></el-icon>
                  </el-button>
                </el-tooltip>
              </span>
              <span class="footer-action-item">
                <el-tooltip content="订单备注" placement="top">
                  <el-badge :value="item.remarkCount ?? 0" :hidden="!(item.remarkCount ?? 0)" :max="99" class="remark-badge">
                    <el-button link size="small" circle class="action-btn" @click="openRemark(item)">
                      <el-icon><ChatDotRound /></el-icon>
                    </el-button>
                  </el-badge>
                </el-tooltip>
              </span>
              <span class="footer-action-item">
                <el-tooltip content="下载" placement="top">
                  <el-button link size="small" circle class="action-btn" @click="downloadExcel">
                    <el-icon><Download /></el-icon>
                  </el-button>
                </el-tooltip>
              </span>
              <span class="footer-action-item">
                <el-tooltip content="操作记录" placement="top">
                  <el-button link size="small" circle class="action-btn" @click="openOperationLog(item)">
                    <el-icon><Clock /></el-icon>
                  </el-button>
                </el-tooltip>
              </span>
              <span class="footer-action-item">
                <el-tooltip content="打印" placement="top">
                  <el-button link size="small" circle class="action-btn" @click="printOrder(item)">
                    <el-icon><Printer /></el-icon>
                  </el-button>
                </el-tooltip>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 查看 / 操作记录 占位弹窗 -->
    <el-dialog v-model="viewDialog.visible" title="订单详情（只读）" width="720">
      <div v-if="viewDialog.order">
        <pre class="json-preview">{{ JSON.stringify(viewDialog.order, null, 2) }}</pre>
      </div>
      <template #footer>
        <el-button @click="viewDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logDialog.visible" title="操作记录" width="640">
      <div v-if="logDialog.order" class="log-order-brief">
        <div class="log-order-no">订单号：{{ logDialog.order.orderNo }}</div>
        <div class="log-order-meta">
          <span>客户：{{ logDialog.order.customerName || '-' }}</span>
          <span>SKU：{{ logDialog.order.skuCode || '-' }}</span>
        </div>
      </div>
      <el-skeleton v-if="logDialog.loading" animated :rows="4" />
      <el-empty
        v-else-if="!logDialog.logs.length"
        description="暂无操作记录"
      />
      <el-timeline v-else class="operation-log-timeline">
        <el-timeline-item
          v-for="log in logDialog.logs"
          :key="log.id"
        >
          <div class="operation-log-item">
            <div class="operation-log-header">
              <span class="operation-log-operator">操作账号：{{ log.operatorUsername }}</span>
              <span class="operation-log-action">操作类型：{{ getActionLabel(log.action) }}</span>
            </div>
            <div class="operation-log-row">
              <span class="operation-log-label">修改日期：</span>
              <span class="operation-log-value">{{ formatDateTime(log.createdAt) }}</span>
            </div>
            <div class="operation-log-row">
              <span class="operation-log-label">修改内容：</span>
              <span class="operation-log-value">{{ log.detail }}</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <template #footer>
        <el-button @click="logDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="remarkDialog.visible" title="订单备注" width="640">
      <div v-if="remarkDialog.order" class="remark-order-brief">
        <div class="remark-order-no">订单号：{{ remarkDialog.order.orderNo }}</div>
        <div class="remark-order-meta">
          <span>客户：{{ remarkDialog.order.customerName || '-' }}</span>
          <span>SKU：{{ remarkDialog.order.skuCode || '-' }}</span>
        </div>
      </div>
      <el-skeleton v-if="remarkDialog.loading" animated :rows="4" />
      <div v-else class="remark-content">
        <div class="remark-list">
          <el-empty v-if="!remarkDialog.list.length" description="暂无备注" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="item in remarkDialog.list"
              :key="item.id"
            >
              <div class="remark-item">
                <div class="remark-item-header">
                  <span class="remark-operator">账号：{{ item.operatorUsername }}</span>
                  <span class="remark-time">{{ formatDateTime(item.createdAt) }}</span>
                </div>
                <div class="remark-item-content">
                  {{ item.content }}
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
        <div class="remark-editor">
          <div class="remark-editor-label">新增备注：</div>
          <el-input
            v-model="remarkDialog.content"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="填写本次特殊情况说明"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="remarkDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="remarkDialog.submitting" @click="onSubmitRemark">
          提交备注
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialog.visible" title="审核确认" width="520">
      <div class="review-dialog-body">
        <p class="review-tip">请选择本次审核结果，可以退回为草稿并填写原因，或确认审单进入下一流程。</p>
        <el-input
          v-model="reviewDialog.reason"
          type="textarea"
          :rows="3"
          maxlength="300"
          show-word-limit
          placeholder="退回为草稿时，请在此填写退回原因（必填）；确认审单时可留空。"
        />
      </div>
      <template #footer>
        <el-button @click="reviewDialog.visible = false">取消</el-button>
        <el-button
          type="warning"
          :loading="reviewDialog.submittingReject"
          @click="onReviewReject"
        >
          退回为草稿
        </el-button>
        <el-button
          type="primary"
          :loading="reviewDialog.submittingApprove"
          @click="onReviewApprove"
        >
          确认审单
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, watchEffect, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { Edit, Download, Printer, Clock, Coin, Document, ChatDotRound } from '@element-plus/icons-vue'
import { getOrders, getOrderStatusCounts, deleteOrders, reviewOrders, reviewRejectOrders, copyOrdersToDraft, getOrderLogs, getOrderRemarks, addOrderRemark, getOrderSizeBreakdown, type OrderListItem, type OrderListQuery, type OrderOperationLogItem, type OrderRemarkItem, type OrderSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getCustomers, type CustomerItem, getSalespeople, getMerchandisers } from '@/api/customers'
import { getDictItems, getDictOptions, getDictTree } from '@/api/dicts'
import { getSupplierBusinessScopeOptions } from '@/api/suppliers'
import { type SystemOptionTreeNode } from '@/api/system-options'
import { useAuthStore } from '@/stores/auth'
import { getOrderStatuses, type OrderStatusItem } from '@/api/order-status-config'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 订单状态标签：从「订单状态配置」中动态加载
const STATUS_TABS = ref<Array<{ label: string; value: string }>>([{ label: '全部', value: 'all' }])

// 状态编码 -> 中文名 映射，同样从配置表生成
const STATUS_LABEL_MAP = ref<Record<string, string>>({})

async function loadStatusTabs() {
  try {
    const res = await getOrderStatuses()
    const all: OrderStatusItem[] = res.data ?? []
    // 为避免「启用」状态配置异常导致订单列表状态栏全部消失，这里暂时忽略 enabled，仅按排序展示所有状态
    const sorted = [...all].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)

    STATUS_TABS.value = [
      { label: '全部', value: 'all' },
      ...sorted.map((s) => ({
        label: s.label,
        value: s.code,
      })),
    ]

    const map: Record<string, string> = {}
    for (const s of sorted) {
      map[s.code] = s.label
    }
    STATUS_LABEL_MAP.value = map
  } catch (e: unknown) {
    // 状态配置加载失败时，保留默认「全部」标签，不影响列表基础功能
    if (!isErrorHandled(e)) {
      console.warn('订单状态配置加载失败：', getErrorMessage(e, '状态加载失败'))
    }
  }
}

const ACTION_LABEL_MAP: Record<string, string> = {
  create: '创建草稿',
  update: '修改',
  submit: '提交',
  review: '审核',
  delete: '删除',
  copy_to_draft: '复制为草稿',
}

function getActionLabel(action: string): string {
  return ACTION_LABEL_MAP[action] ?? action
}

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
const collaborationItems = ref<Array<{ id: number; value: string }>>([])
const secondaryProcessOptions = ref<{ label: string; value: string }[]>([])
const factoryOptions = ref<{ label: string; value: string }[]>([])
const customerOptions = ref<{ label: string; value: string }[]>([])
const salespersonOptions = ref<string[]>([])
const merchandiserOptions = ref<string[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: any[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      // 有子分组的父节点禁用，只允许选择叶子节点
      disabled: hasChildren,
    }
  })
}

const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

function findOrderTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id === id) return node.value
    if (node.children?.length) stack.push(...node.children)
  }
  return ''
}

function findCollaborationLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const found = collaborationItems.value.find((item) => item.id === id)
  return found?.value ?? ''
}

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const DATE_RANGE_WIDTH_EMPTY = '140px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}

function getFilterSelectStyle(v: unknown) {
  return v ? activeSelectStyle : undefined
}

/**
 * 筛选项下拉宽度随内容调节。
 * @param extraPadding 右侧预留（箭头/清空图标等），默认 60；客户项用 42 以减少尾部空白
 */
function getFilterSelectAutoWidthStyle(v: unknown, extraPadding = 60) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + extraPadding
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    ...activeSelectStyle,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  if (!orderNo || !showLabel) return undefined
  const text = `订单号：${String(orderNo)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  if (!skuCode || !showLabel) return undefined
  const text = `SKU编号：${String(skuCode)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getFilterRangeStyle(v: [string, string] | null) {
  const hasValue = v && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  customer: '',
  orderTypeId: null as number | null,
  processItem: '',
  salesperson: '',
  merchandiser: '',
  factory: '',
})

const orderDateRange = ref<[string, string] | null>(null)
const completedRange = ref<[string, string] | null>(null)

/** 订单号前缀「订单号：」仅在回车或点击搜索后显示 */
const orderNoLabelVisible = ref(false)
/** SKU编号前缀「SKU编号：」仅在回车或点击搜索后显示 */
const skuCodeLabelVisible = ref(false)

const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0,
})

const currentStatus = ref<'all' | string>('all')
const list = ref<OrderListItem[]>([])
const loading = ref(false)
const statusCounts = ref<Record<string, number>>({})
const statusTotal = ref<number>(0)

const viewDialog = reactive<{ visible: boolean; order: OrderListItem | null }>({
  visible: false,
  order: null,
})

const logDialog = reactive<{
  visible: boolean
  loading: boolean
  order: OrderListItem | null
  logs: OrderOperationLogItem[]
}>({
  visible: false,
  loading: false,
  order: null,
  logs: [],
})

const remarkDialog = reactive<{
  visible: boolean
  loading: boolean
  submitting: boolean
  order: OrderListItem | null
  list: OrderRemarkItem[]
  content: string
}>({
  visible: false,
  loading: false,
  submitting: false,
  order: null,
  list: [],
  content: '',
})

const reviewDialog = reactive<{
  visible: boolean
  submittingApprove: boolean
  submittingReject: boolean
  reason: string
}>({
  visible: false,
  submittingApprove: false,
  submittingReject: false,
  reason: '',
})

const sizePopoverLoadingId = ref<number | null>(null)
const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})

/** 卡片勾选状态 + 批量操作 */
const cardSelected = ref<Record<number, boolean>>({})
const selectedIds = computed(() => {
  const map = cardSelected.value
  return list.value.filter((item) => map[item.id]).map((item) => item.id)
})
const hasSelection = computed(() => selectedIds.value.length > 0)
const isPendingReviewTab = computed(() => currentStatus.value === 'pending_review')
const canDeleteOrders = computed(() => authStore.hasPermission('orders_delete'))
const canReviewOrders = computed(() => authStore.hasPermission('orders_review'))

function resetSelection() {
  cardSelected.value = {}
}

function onCardSelectChange() {
  // 选中状态变化时，selectedIds 由计算属性自动更新
}

function getStatusLabel(status: string): string {
  const map = STATUS_LABEL_MAP.value
  return map[status] || status || '-'
}

function getStatusTagType(
  status: string,
): 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined {
  const s = (status ?? '').toLowerCase()
  if (s === 'completed') return 'success'
  if (s === 'draft' || s === 'pending_review') return 'info'
  if (!s) return 'info'
  return 'warning'
}

function getCustomerDueDateClass(
  customerDueDate: string | null | undefined,
  status: string | null | undefined,
): string | undefined {
  const s = (status ?? '').toLowerCase()
  if (s === 'completed' || s === 'draft') return undefined
  if (!customerDueDate) return undefined
  const d = new Date(customerDueDate)
  if (Number.isNaN(d.getTime())) return undefined

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((startOfDueDay.getTime() - startOfToday.getTime()) / 86400000)

  if (diffDays < 0) return 'due-overdue'
  if (diffDays <= 7) return 'due-soon'
  return undefined
}

/** 订单类型展示值：后端列表返回 label 字段存订单类型，兼容 orderType */
function orderTypeDisplay(item: OrderListItem): string {
  if (typeof item.orderTypeId === 'number') {
    const label = findOrderTypeLabelById(item.orderTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

function collaborationDisplay(item: OrderListItem): string {
  if (typeof item.collaborationTypeId === 'number') {
    const label = findCollaborationLabelById(item.collaborationTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

async function loadOptions() {
  // 1）基础选项：客户 / 业务员 / 订单类型 / 合作方式 / 二次工艺 / 加工厂
  try {
    const [custRes, salesRes, orderTypeRes, collabRes, secondaryRes, factoryRes] = await Promise.all([
      getCustomers({ page: 1, pageSize: 200 }),
      getSalespeople(),
      getDictTree('order_types'),
      getDictItems('collaboration'),
      getSupplierBusinessScopeOptions('工艺供应商'),
      getDictOptions('factories'),
    ])

    const custList = (custRes.data?.list ?? []) as CustomerItem[]
    customerOptions.value = custList.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))

    salespersonOptions.value = salesRes.data ?? []

    const orderTypeVals = orderTypeRes.data ?? []
    orderTypeTree.value = Array.isArray(orderTypeVals) ? orderTypeVals : []

    const collabVals = collabRes.data ?? []
    collaborationItems.value = Array.isArray(collabVals)
      ? collabVals.map((item: any) => ({ id: item.id, value: item.value }))
      : []

    const secondaryVals = secondaryRes.data ?? []
    secondaryProcessOptions.value = secondaryVals.map((v: string) => ({ label: v, value: v }))

    const factoryVals = factoryRes.data ?? []
    factoryOptions.value = factoryVals.map((v: string) => ({ label: v, value: v }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      console.warn('订单筛选选项加载失败：', getErrorMessage(e, '选项加载失败'))
    }
  }

  // 2）跟单员单独请求，避免影响其他选项
  try {
    const merchRes = await getMerchandisers()
    merchandiserOptions.value = merchRes.data ?? []
  } catch (e: unknown) {
    // 跟单员加载失败时，仅保留为空列表，不影响其他筛选
    if (!isErrorHandled(e)) {
      console.warn('跟单员选项加载失败：', getErrorMessage(e, '选项加载失败'))
    }
  }
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN')
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

function buildQuery(): OrderListQuery {
  const q: OrderListQuery = {
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    customer: filter.customer || undefined,
    orderTypeId: filter.orderTypeId ?? undefined,
    processItem: filter.processItem || undefined,
    salesperson: filter.salesperson || undefined,
    merchandiser: filter.merchandiser || undefined,
    factory: filter.factory || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (currentStatus.value !== 'all') {
    q.status = currentStatus.value
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  if (completedRange.value && completedRange.value.length === 2) {
    q.completedStart = completedRange.value[0]
    q.completedEnd = completedRange.value[1]
  }
  return q
}

function buildCountQuery(): Omit<OrderListQuery, 'status' | 'page' | 'pageSize'> {
  const q: Omit<OrderListQuery, 'status' | 'page' | 'pageSize'> = {
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    customer: filter.customer || undefined,
    orderTypeId: filter.orderTypeId ?? undefined,
    processItem: filter.processItem || undefined,
    salesperson: filter.salesperson || undefined,
    merchandiser: filter.merchandiser || undefined,
    factory: filter.factory || undefined,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  if (completedRange.value && completedRange.value.length === 2) {
    q.completedStart = completedRange.value[0]
    q.completedEnd = completedRange.value[1]
  }
  return q
}

function getStatusTabLabel(tab: { label: string; value: string }) {
  const count = tab.value === 'all' ? statusTotal.value : (statusCounts.value[tab.value] ?? 0)
  return `${tab.label}(${count})`
}

async function load() {
  loading.value = true
  try {
    const [listRes, countsRes] = await Promise.all([getOrders(buildQuery()), getOrderStatusCounts(buildCountQuery())])
    const data = listRes.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    }
    const countsData = countsRes.data
    statusTotal.value = countsData?.total ?? 0
    statusCounts.value = countsData?.byStatus ?? {}
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

/** @param byUser 仅当用户按回车或点击搜索按钮时为 true，输入防抖触发时为 false */
function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  filter.customer = ''
  filter.orderTypeId = null
  filter.processItem = ''
  filter.salesperson = ''
  filter.merchandiser = ''
  filter.factory = ''
  orderDateRange.value = null
  completedRange.value = null
  currentStatus.value = 'all'
  pagination.page = 1
  resetSelection()
  load()
}

function onStatusChange() {
  pagination.page = 1
  resetSelection()
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

async function onBatchDelete() {
  if (!hasSelection.value) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条订单吗？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteOrders(selectedIds.value)
    ElMessage.success('已删除选中订单')
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
  }
}

function openReviewDialog() {
  if (!hasSelection.value || !isPendingReviewTab.value) return
  reviewDialog.visible = true
  reviewDialog.reason = ''
}

async function onReviewApprove() {
  if (!hasSelection.value || !isPendingReviewTab.value) return
  reviewDialog.submittingApprove = true
  try {
    await reviewOrders(selectedIds.value)
    ElMessage.success('审核成功')
    reviewDialog.visible = false
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '审核失败'))
  } finally {
    reviewDialog.submittingApprove = false
  }
}

async function onReviewReject() {
  if (!hasSelection.value || !isPendingReviewTab.value) return
  const reason = reviewDialog.reason?.trim()
  if (!reason) {
    ElMessage.warning('请输入退回原因')
    return
  }
  reviewDialog.submittingReject = true
  try {
    await reviewRejectOrders(selectedIds.value, reason)
    ElMessage.success('已退回为草稿')
    reviewDialog.visible = false
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '退回失败'))
  } finally {
    reviewDialog.submittingReject = false
  }
}

async function onBatchCopyToDraft() {
  if (!hasSelection.value) return
  try {
    await ElMessageBox.confirm(`确定将选中的 ${selectedIds.value.length} 条订单复制为草稿吗？`, '复制为草稿', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await copyOrdersToDraft(selectedIds.value)
    ElMessage.success('已复制为草稿')
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '复制失败'))
  }
}

async function onShowSizePopover(order: OrderListItem) {
  const id = order.id
  if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
  sizePopoverLoadingId.value = id
  try {
    const res = await getOrderSizeBreakdown(id)
    sizeBreakdownCache.value[id] = res.data ?? { headers: [], rows: [] }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
    }
  } finally {
    if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
  }
}

function openEdit(order: OrderListItem) {
  router.push({ name: 'OrdersEdit', params: { id: order.id } })
}

function openView(order: OrderListItem) {
  router.push({ name: 'OrdersDetail', params: { id: order.id } })
}

function openCost(order: OrderListItem) {
  router.push(`/orders/cost/${order.id}`)
}

async function openRemark(order: OrderListItem) {
  remarkDialog.visible = true
  remarkDialog.order = order
  remarkDialog.loading = true
  remarkDialog.list = []
  remarkDialog.content = ''
  try {
    const res = await getOrderRemarks(order.id)
    remarkDialog.list = res.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      ElMessage.error(getErrorMessage(e, '备注加载失败'))
    }
  } finally {
    remarkDialog.loading = false
  }
}

async function onSubmitRemark() {
  const order = remarkDialog.order
  const content = remarkDialog.content?.trim()
  if (!order) return
  if (!content) {
    ElMessage.warning('请先填写备注内容')
    return
  }
  remarkDialog.submitting = true
  try {
    const res = await addOrderRemark(order.id, content)
    const created = res.data
    if (created) {
      remarkDialog.list.unshift(created)
      order.remarkCount = (order.remarkCount ?? 0) + 1
    }
    remarkDialog.content = ''
    ElMessage.success('备注已提交')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      ElMessage.error(getErrorMessage(e, '备注提交失败'))
    }
  } finally {
    remarkDialog.submitting = false
  }
}

function downloadExcel() {
  ElMessage.info('下载 Excel 功能将在后续统一实现')
}

function printOrder(_order: OrderListItem) {
  // 统一使用订单详情页进行打印，保证版式一致
  router.push({ name: 'OrdersDetail', params: { id: _order.id } })
}

async function openOperationLog(order: OrderListItem) {
  logDialog.visible = true
  logDialog.order = order
  logDialog.loading = true
  logDialog.logs = []
  try {
    const res = await getOrderLogs(order.id)
    logDialog.logs = res.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      ElMessage.error(getErrorMessage(e, '操作记录加载失败'))
    }
  } finally {
    logDialog.loading = false
  }
}

function onCreateOrder() {
  router.push({ name: 'OrdersEdit', query: { new: '1' } })
}

/** 从 URL query 恢复筛选（如从主页待办跳转进入） */
function applyQueryFromRoute() {
  const q = route.query as Record<string, string | undefined>
  if (q.merchandiser != null && q.merchandiser !== '') {
    filter.merchandiser = q.merchandiser
  }
  if (q.status != null && q.status !== '' && q.status !== 'all') {
    currentStatus.value = q.status
  }
  if (q.completedStart != null && q.completedEnd != null) {
    completedRange.value = [q.completedStart, q.completedEnd]
  }
}

onMounted(() => {
  applyQueryFromRoute()
  load()
  loadOptions()
  loadStatusTabs()
})

watch(
  () => filter.orderNo,
  (v) => {
    if (!v || !String(v).trim()) orderNoLabelVisible.value = false
  },
)
watch(
  () => filter.skuCode,
  (v) => {
    if (!v || !String(v).trim()) skuCodeLabelVisible.value = false
  },
)

watchEffect(() => {
  // 预留：当筛选条件发生明显变化时，可在此埋点或做其它处理
  void filter.orderNo
})
</script>

<style scoped>
.orders-list-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  margin-bottom: var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.status-tabs-left {
  flex: 1;
  min-width: 0;
}

.status-tabs-right {
  flex-shrink: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar :deep(.el-form-item) {
  margin-bottom: 0;
}

.range-single.el-date-editor--daterange :deep(.el-range-separator) {
  display: none;
}
.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) {
  display: none;
}
.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) {
  width: 100%;
}
.range-single.el-date-editor--daterange :deep(.el-range__close-icon) {
  margin-left: 0;
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

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

.order-card-image :deep(.el-image) {
  width: 100%;
  height: 100%;
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

.order-card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 2px;
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

.qty-popover-table {
  width: 100%;
  border-collapse: collapse;
}

.qty-popover-table .qty-label {
  padding: 2px 4px;
  color: var(--color-text-muted, #909399);
  white-space: nowrap;
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: right;
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
}

/* 订单类型 + 工艺 同一行：左侧标签（仅值），右侧工艺 */
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

.order-tags-row .order-type-tag,
.order-tags-row .process-item-tag {
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

.pagination-wrap {
  margin-top: var(--space-md);
  display: flex;
  justify-content: flex-end;
}

.json-preview {
  margin: 0;
  padding: 12px;
  border-radius: var(--radius);
  background-color: #0f172a;
  color: #e5e7eb;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  max-height: 400px;
  overflow: auto;
}

.log-order-brief {
  margin-bottom: var(--space-sm);
  font-size: 13px;
  color: var(--color-text, #303133);
}

.log-order-no {
  font-weight: 600;
  margin-bottom: 4px;
}

.log-order-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}

.operation-log-item {
  font-size: 13px;
}

.operation-log-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.operation-log-operator,
.operation-log-action {
  font-weight: 500;
}

.operation-log-row {
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
}

.operation-log-label {
  flex-shrink: 0;
  color: var(--color-text-muted, #909399);
}

.operation-log-value {
  flex: 1;
  word-break: break-all;
}

.remark-order-brief {
  margin-bottom: var(--space-sm);
  font-size: 13px;
  color: var(--color-text, #303133);
}

.remark-order-no {
  font-weight: 600;
  margin-bottom: 4px;
}

.remark-order-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}

.remark-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.remark-list {
  max-height: 260px;
  overflow: auto;
}

.remark-item {
  font-size: 13px;
}

.remark-item-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}

.remark-operator {
  font-weight: 500;
}

.remark-time {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}

.remark-item-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.remark-editor {
  margin-top: var(--space-sm);
}

.remark-editor-label {
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--color-text, #303133);
}
</style>
