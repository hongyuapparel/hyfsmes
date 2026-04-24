<template>
  <el-drawer
    :model-value="visible"
    title="供应商详情"
    :size="`${width}px`"
    destroy-on-close
    class="supplier-detail-drawer"
    @update:model-value="(value) => emit('update:visible', value)"
  >
    <div class="detail-drawer-resizer" title="拖拽调整宽度" @mousedown="emit('start-resize', $event)" />
    <div v-loading="loading" class="supplier-detail-wrap">
      <template v-if="data">
        <div class="supplier-detail-grid">
          <div class="detail-label">供应商名称</div>
          <div class="detail-value">{{ data.name || '-' }}</div>
          <div class="detail-label">供应商类型</div>
          <div class="detail-value">{{ findSupplierTypeLabelById(data.supplierTypeId) || '-' }}</div>

          <div class="detail-label">业务范围</div>
          <div class="detail-value">
            <el-tag
              v-for="label in getScopeLabels(data.businessScopeIds, data.businessScopeId)"
              :key="label"
              size="small"
              class="scope-tag"
            >
              {{ label }}
            </el-tag>
            <span v-if="!getScopeLabels(data.businessScopeIds, data.businessScopeId).length">-</span>
          </div>
          <div class="detail-label">最近活跃时间</div>
          <div class="detail-value">{{ formatDateTime(data.lastActiveAt) }}</div>

          <div class="detail-label">联系人</div>
          <div class="detail-value">{{ data.contactPerson || '-' }}</div>
          <div class="detail-label">联系电话</div>
          <div class="detail-value">{{ data.contactInfo || '-' }}</div>

          <div class="detail-label">工厂地址</div>
          <div class="detail-value">{{ data.factoryAddress || '-' }}</div>
          <div class="detail-label">结款时间</div>
          <div class="detail-value">{{ data.settlementTime || '-' }}</div>
          <div class="detail-label">备注</div>
          <div class="detail-value">{{ data.remark || '-' }}</div>
        </div>

        <div class="recent-records">
          <div class="recent-title">最近合作记录（订单）</div>
          <el-table :data="recentRecords" border size="small" empty-text="暂无合作记录">
            <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip />
            <el-table-column prop="skuCode" label="SKU" min-width="120" show-overflow-tooltip />
            <el-table-column prop="refName" label="合作内容" min-width="140" show-overflow-tooltip />
            <el-table-column label="引用类型" width="90" align="center">
              <template #default="{ row }">{{ row.refType === 'material' ? '物料' : '工艺' }}</template>
            </el-table-column>
            <el-table-column label="下单时间" width="160" align="center">
              <template #default="{ row }">{{ formatDateTime(row.orderDate) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { formatDateTime } from '@/utils/date-format'
import type { SupplierItem, SupplierRecentRecordItem } from '@/api/suppliers'

defineProps<{
  visible: boolean
  width: number
  loading: boolean
  data: SupplierItem | null
  recentRecords: SupplierRecentRecordItem[]
  findSupplierTypeLabelById: (id: number | null | undefined) => string
  getScopeLabels: (ids: number[] | null | undefined, fallbackId?: number | null) => string[]
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'start-resize', value: MouseEvent): void
}>()
</script>

<style scoped>
.supplier-detail-wrap {
  padding: 0 12px 12px 12px;
}

.supplier-detail-grid {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 110px minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}

.detail-label,
.detail-value {
  padding: 10px;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.detail-label {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.detail-value {
  color: var(--el-text-color-regular);
  word-break: break-word;
}

.supplier-detail-grid > :nth-child(4n) {
  border-right: none;
}

.scope-tag {
  margin-right: 6px;
  margin-bottom: 6px;
}

.recent-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.detail-drawer-resizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 10px;
  height: 100%;
  z-index: 10;
  cursor: ew-resize;
}

.detail-drawer-resizer:hover {
  background: rgba(64, 158, 255, 0.12);
}
</style>
