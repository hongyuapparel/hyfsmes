<template>
  <AppDialog v-model="dialogVisible" title="批量补价" width="760" destroy-on-close
    :close-on-press-escape="!submitting" :show-close="!submitting">
    <el-alert
      title="每条面料单独填写当前实际成本单价；保存后只重估当前库存，不改历史出库金额。"
      type="info"
      :closable="false"
      show-icon
      class="batch-price-tip"
    />
    <el-table :data="rows" border max-height="460" class="editable-grid">
      <el-table-column prop="name" label="面料名称" min-width="220" show-overflow-tooltip />
      <el-table-column label="库存数量" width="130" align="center">
        <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }} {{ row.unit }}</template>
      </el-table-column>
      <el-table-column label="实际成本单价" width="200" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="row.unitPrice"
            :min="0"
            :precision="4"
            :disabled="submitting"
            controls-position="right"
            style="width: 100%"
          />
        </template>
      </el-table-column>
      <el-table-column label="库存金额" width="150" align="right">
        <template #default="{ row }">
          {{ row.unitPrice == null ? '未计价' : formatMoneyAligned(row.quantity * row.unitPrice) }}
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('confirm')">保存价格</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FabricBatchPriceRow } from '@/composables/useFabricBatchPricing'
import { formatDisplayNumber, formatMoneyAligned } from '@/utils/display-number'

const props = defineProps<{
  visible: boolean
  submitting: boolean
  rows: FabricBatchPriceRow[]
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm'): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => { if (!props.submitting) emit('update:visible', value) },
})
</script>

<style scoped>
.batch-price-tip { margin-bottom: 12px; }
</style>
