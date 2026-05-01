<template>
  <SimpleInventoryDetailDrawer
    :visible="visible"
    title="面料详情"
    :loading="loading"
    :fields="fields"
    :image-url="row?.imageUrl || ''"
    :logs="logs"
    :format-log-action="formatLogAction"
    @update:visible="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FabricItem, FabricOperationLog } from '@/api/inventory'
import { formatDisplayNumber } from '@/utils/display-number'
import SimpleInventoryDetailDrawer from '@/components/inventory/SimpleInventoryDetailDrawer.vue'

type DetailField = { label: string; value: string }
type DetailLog = { id: number; operatorUsername: string; action: string; remark: string; createdAt: string }

const props = defineProps<{
  visible: boolean
  row: FabricItem | null
  loading: boolean
  logs: FabricOperationLog[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const fields = computed<DetailField[]>(() => {
  const row = props.row
  if (!row) return []
  return [
    { label: '名称', value: row.name || '-' },
    { label: '客户', value: row.customerName || '-' },
    { label: '供应商', value: row.supplierName || '-' },
    { label: '仓库', value: row.warehouseLabel || '-' },
    { label: '存放地址', value: row.storageLocation || '-' },
    { label: '当前库存', value: `${formatDisplayNumber(row.quantity)} ${row.unit || ''}`.trim() },
    { label: '备注', value: row.remark || '-' },
  ]
})

const logs = computed<DetailLog[]>(() =>
  props.logs.map((log) => ({
    id: log.id,
    operatorUsername: log.operatorUsername,
    action: log.action,
    remark: log.remark,
    createdAt: log.createdAt,
  })),
)

function formatLogAction(action: string): string {
  const map: Record<string, string> = {
    create: '新建',
    inbound: '新增入库',
    update: '编辑',
    outbound: '出库',
    delete: '删除',
  }
  return map[action] ?? action ?? '操作'
}
</script>
