<template>
  <div class="home-todo-board">
    <div class="home-section-head">
      <h2 class="home-section-title">待办事项</h2>
      <el-popover placement="bottom-start" :width="320" trigger="click">
        <template #reference>
          <el-button link type="info" size="small">规则说明</el-button>
        </template>
        <div class="todo-rules-popover">
          <p><strong>待审核：</strong>订单状态为「待审单」(pending_review)，即已提交未审核的订单。</p>
          <p><strong>待我跟单：</strong>订单的跟单员等于当前登录用户的显示名（完全一致），仅非管理员显示。</p>
          <p><strong>即将到期：</strong>客户交期在今日起 7 天内（含今天）。</p>
          <p><strong>待仓处理：</strong>待仓处理表中状态为「待处理」的记录（尾部交接后、仓管未完成入库或直接发货）。</p>
          <p class="todo-rules-hint">全部为 0 时请检查：是否有待审单、交期是否在 7 天内、跟单员是否与当前用户显示名一致、是否有待仓处理记录。</p>
        </div>
      </el-popover>
    </div>

    <div v-if="hasAnyTodoCard" class="todo-sections">
      <section
        v-if="canReviewOrders"
        class="todo-section todo-section--default"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <span class="todo-section-title">{{ isAdmin ? '待审核(全部)' : '待我审核' }}</span>
          <span class="todo-section-count">{{ todoCounts.pendingReview }}</span>
          <el-link
            v-if="todoCounts.pendingReview > 0"
            type="primary"
            class="todo-section-link"
            :href="pendingReviewLink"
            @click.prevent="emit('orders-list', pendingReviewLink)"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.pendingReview.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>跟单员</th>
                <th>状态时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in todoLists.pendingReview"
                :key="item.id"
                class="todo-row"
                @click="emit('order-detail', item.id)"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</td>
                <td class="ellipsis" :title="item.merchandiser || '-'">{{ item.merchandiser || '-' }}</td>
                <td>{{ formatDate(item.statusTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-if="showMyMerchandiser"
        class="todo-section todo-section--default"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <span class="todo-section-title">待我跟单</span>
          <span class="todo-section-count">{{ todoCounts.myMerchandiser }}</span>
          <el-link
            v-if="todoCounts.myMerchandiser > 0"
            type="primary"
            class="todo-section-link"
            :href="myMerchandiserLink"
            @click.prevent="emit('orders-list', myMerchandiserLink)"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.myMerchandiser.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>交期</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in todoLists.myMerchandiser"
                :key="item.id"
                class="todo-row"
                @click="emit('order-detail', item.id)"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</td>
                <td>{{ formatDate(item.customerDueDate) }}</td>
                <td class="ellipsis" :title="item.status">{{ item.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-if="canAccessOrders"
        class="todo-section"
        :class="{
          'todo-section--warning': todoCounts.dueSoon > 0,
          'todo-section--default': todoCounts.dueSoon <= 0,
          'todo-section-loading': todoLoading,
        }"
      >
        <div class="todo-section-head">
          <el-icon v-if="todoCounts.dueSoon > 0" class="todo-section-icon"><WarningFilled /></el-icon>
          <span class="todo-section-title">{{ isAdmin ? '即将到期(7天内)(全部)' : '即将到期(7天内)' }}</span>
          <span class="todo-section-count">{{ todoCounts.dueSoon }}</span>
          <el-link
            v-if="todoCounts.dueSoon > 0"
            type="warning"
            class="todo-section-link"
            :href="dueSoonLink"
            @click.prevent="emit('orders-list', dueSoonLink)"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.dueSoon.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>跟单员</th>
                <th>交期</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in todoLists.dueSoon"
                :key="item.id"
                class="todo-row"
                @click="emit('order-detail', item.id)"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</td>
                <td class="ellipsis" :title="item.merchandiser || '-'">{{ item.merchandiser || '-' }}</td>
                <td>{{ formatDate(item.customerDueDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-if="canAccessPendingInbound"
        class="todo-section todo-section--default"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <span class="todo-section-title">{{ isAdmin ? '待仓处理(全部)' : '待仓处理' }}</span>
          <span class="todo-section-count">{{ todoCounts.pendingInbound }}</span>
          <el-link
            v-if="todoCounts.pendingInbound > 0"
            type="primary"
            class="todo-section-link"
            href="/inventory/pending"
            @click.prevent="emit('pending-inbound')"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.pendingInbound.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>SKU</th>
                <th>待处理数量</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in todoLists.pendingInbound"
                :key="`${item.orderId}-${item.skuCode}-${idx}`"
                class="todo-row"
                @click="emit('pending-inbound')"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.skuCode">{{ item.skuCode }}</td>
                <td>{{ formatDisplayNumber(item.quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <div v-else class="todo-empty">
      <span>暂无待办事项</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'
import type { HomeTodoCounts, HomeTodoLists } from '@/composables/useHomeTodo'
import { formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

defineProps<{
  todoLoading: boolean
  todoCounts: HomeTodoCounts
  todoLists: HomeTodoLists
  isAdmin: boolean
  canReviewOrders: boolean
  showMyMerchandiser: boolean
  canAccessOrders: boolean
  canAccessPendingInbound: boolean
  hasAnyTodoCard: boolean
  pendingReviewLink: string
  myMerchandiserLink: string
  dueSoonLink: string
}>()

const emit = defineEmits<{
  'orders-list': [href: string]
  'order-detail': [orderId: number]
  'pending-inbound': []
}>()
</script>

<style scoped>
.home-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.home-section-title {
  margin: 0;
  font-size: var(--font-size-title);
  font-weight: 600;
}

.todo-rules-popover p {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
  line-height: 1.5;
}

.todo-rules-popover .todo-rules-hint {
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary, #606266);
}

.todo-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

@media (max-width: 900px) {
  .todo-sections {
    grid-template-columns: 1fr;
  }
}

.todo-section {
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.todo-section--default {
  border: 1px solid var(--color-border);
  background: var(--color-bg-subtle, #f5f6f8);
}

.todo-section--warning {
  border: 1px solid var(--el-color-warning);
  background: var(--el-color-warning-light-9, #fdf6ec);
}

.todo-section-loading .todo-section-count {
  opacity: 0.7;
}

.todo-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.todo-section--warning .todo-section-head {
  border-bottom-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9, #fdf6ec);
}

.todo-section-icon {
  font-size: var(--font-size-subtitle);
  color: var(--el-color-warning);
}

.todo-section-title {
  font-size: var(--font-size-body);
  font-weight: 600;
}

.todo-section-count {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--el-color-primary);
}

.todo-section--warning .todo-section-count {
  color: var(--el-color-warning-dark-2, #b88230);
}

.todo-section-link {
  margin-left: auto;
}

.todo-table-wrap {
  overflow-x: auto;
  flex: 1;
  min-height: 0;
}

.todo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-body);
}

.todo-table th,
.todo-table td {
  padding: var(--space-xs, 6px) var(--space-sm);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.todo-table th {
  color: var(--color-text-secondary, #606266);
  font-weight: 500;
}

.todo-table tbody tr.todo-row {
  cursor: pointer;
}

.todo-table tbody tr.todo-row:hover {
  background: var(--el-fill-color-light);
}

.ellipsis {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-empty {
  padding: var(--space-lg);
  text-align: center;
  color: var(--color-text-secondary, #606266);
  font-size: var(--font-size-body);
}
</style>
