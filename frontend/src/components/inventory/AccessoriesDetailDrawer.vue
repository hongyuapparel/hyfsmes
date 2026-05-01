<template>
  <SimpleInventoryDetailDrawer
    :visible="visible"
    title="辅料详情"
    :loading="loading"
    :fields="fields"
    :image-url="row?.imageUrl || ''"
    :logs="logs"
    :format-log-action="formatLogAction"
    @update:visible="emit('update:visible', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AccessoryItem, AccessoryOperationLog } from '@/api/inventory'
import { formatDisplayNumber } from '@/utils/display-number'
import SimpleInventoryDetailDrawer from '@/components/inventory/SimpleInventoryDetailDrawer.vue'

type DetailField = { label: string; value: string }
type DetailLog = { id: number; operatorUsername: string; action: string; remark: string; createdAt: string }

const props = defineProps<{
  visible: boolean
  row: AccessoryItem | null
  loading: boolean
  logs: AccessoryOperationLog[]
  formatLogAction: (action: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const fields = computed<DetailField[]>(() => {
  const row = props.row
  if (!row) return []
  return [
    { label: '名称', value: row.name || '-' },
    { label: '类别', value: row.category || '-' },
    { label: '客户', value: row.customerName || '-' },
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
</script>
