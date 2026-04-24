<template>
  <el-dialog
    :model-value="visible"
    title="发货"
    width="860"
    class="outbound-dialog-centered"
    destroy-on-close
    @update:model-value="onVisibleChange"
    @close="onClose"
  >
    <el-form
      :ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
    >
      <el-form-item label="领取人" prop="pickupUserId">
        <el-select
          v-model="form.pickupUserId"
          placeholder="请选择业务员"
          filterable
          clearable
          style="width: 260px"
        >
          <el-option
            v-for="opt in pickupUserOptions"
            :key="opt.id"
            :label="opt.displayName || opt.username"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <div class="outbound-batch-head">
        <span>客户：{{ outboundSelectedCustomer }}</span>
        <span>选中记录：{{ items.length }}</span>
        <span>发货总数：{{ outboundGrandTotal }}</span>
      </div>
      <div class="outbound-batch-list">
        <div
          v-for="item in items"
          :key="item.row.id"
          class="outbound-batch-card"
        >
          <div class="outbound-card-meta">
            <div>订单号：{{ item.row.orderNo }}</div>
            <div>SKU：{{ item.row.skuCode }}</div>
            <div>客户：{{ item.row.customerName || '-' }}</div>
            <div>当前待处理：{{ item.row.quantity }}</div>
          </div>
          <div v-if="item.headers.length" class="outbound-size-wrap">
            <el-table
              :data="item.rows"
              border
              size="small"
              show-summary
              :summary-method="(p) => getOutboundTableSummaries(item, p)"
            >
              <el-table-column label="颜色" min-width="100">
                <template #default="{ row }">
                  {{ row.colorName || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-for="(h, hIdx) in item.headers"
                :key="hIdx"
                :label="h"
                min-width="80"
                align="center"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.quantities[hIdx]"
                    :min="0"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="行计" min-width="80" align="center">
                <template #default="{ row }">
                  {{ formatDisplayNumber(getOutboundRowTotal(row)) }}
                </template>
              </el-table-column>
            </el-table>
            <div class="outbound-size-footer">
              待处理数量：{{ formatDisplayNumber(item.row.quantity) }}，当前填写合计：{{
                formatDisplayNumber(getOutboundItemTotal(item))
              }}
            </div>
          </div>
          <div v-else class="detail-muted">该记录暂无颜色尺码明细，无法发货。</div>
        </div>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="$emit('submit')">
        确定发货
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
type PendingOutboundDialogItem = {
  row: {
    id: number
    orderNo: string
    skuCode: string
    customerName?: string
    quantity: number
  }
  headers: string[]
  rows: Array<{ colorName: string; quantities: number[] }>
}

type PickupUserOption = {
  id: number
  username: string
  displayName?: string
}

defineProps<{
  visible: boolean
  submitting: boolean
  items: PendingOutboundDialogItem[]
  formRef: object
  form: {
    pickupUserId: number | null
  }
  rules: object
  pickupUserOptions: PickupUserOption[]
  outboundSelectedCustomer: string
  outboundGrandTotal: number
  formatDisplayNumber: (value: unknown) => string | number
  getOutboundRowTotal: (row: { quantities: number[] }) => number
  getOutboundItemTotal: (item: PendingOutboundDialogItem) => number
  getOutboundTableSummaries: (
    item: PendingOutboundDialogItem,
    param: { columns: unknown[]; data: Array<{ quantities: number[] }> },
  ) => string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'submit'): void
}>()

function onVisibleChange(value: boolean) {
  emit('update:visible', value)
}

function onClose() {
  emit('close')
}

function onCancel() {
  emit('update:visible', false)
}
</script>

<style scoped>
.outbound-size-wrap {
  width: 100%;
}

.outbound-size-footer {
  margin-top: 8px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.outbound-batch-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  justify-content: center;
  text-align: center;
}

.outbound-batch-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 55vh;
  overflow: auto;
  padding-right: 4px;
}

.outbound-batch-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}

.outbound-card-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
  text-align: center;
}

.detail-muted {
  color: var(--el-text-color-secondary);
}
</style>

<style>
.outbound-dialog-centered .outbound-batch-card .el-table th.is-leaf,
.outbound-dialog-centered .outbound-batch-card .el-table td {
  text-align: center;
}

.outbound-dialog-centered .outbound-batch-card .cell {
  justify-content: center;
}

.outbound-dialog-centered .el-form-item__label {
  text-align: center;
}

.outbound-dialog-centered .el-input-number .el-input__inner {
  text-align: center;
}

.outbound-dialog-centered .outbound-batch-card .el-table__footer .cell {
  text-align: center;
}
</style>
