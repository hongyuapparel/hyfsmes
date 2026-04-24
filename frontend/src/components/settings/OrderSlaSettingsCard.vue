<template>
  <div v-show="active">
    <h3 class="section-title">订单时效配置</h3>
    <p class="section-desc">
      为每个订单状态设置合理停留时长（小时），超过即视为超期，用于财务管理中的「订单流转时效报表」统计与绩效考核。
    </p>
    <div class="sla-actions">
      <el-button type="primary" size="small" @click="openSlaDialog()">新增配置</el-button>
    </div>
    <el-table :data="slaList" size="small" border row-key="id">
      <el-table-column label="状态" width="140">
        <template #default="{ row }">{{ row.orderStatus?.label ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="合理时长（小时）" width="140" align="right">
        <template #default="{ row }">{{ formatDisplayNumber(row.limitHours) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.enabled" type="success" size="small">是</el-tag>
          <el-tag v-else type="info" size="small">否</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openSlaDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="removeSla(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="slaDialog.visible" :title="slaDialog.id ? '编辑时效配置' : '新增时效配置'" width="400px" @close="slaDialog.id = undefined">
      <el-form :model="slaForm" label-width="120px" size="default">
        <el-form-item label="订单状态">
          <el-select v-model="slaForm.orderStatusId" placeholder="选择状态" style="width: 100%" :disabled="!!slaDialog.id">
            <el-option v-for="status in slaStatusOptions" :key="status.id" :label="status.label" :value="status.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="合理时长（小时）">
          <el-input-number v-model="slaForm.limitHours" :min="0" :precision="2" :controls="false" style="width: 100%" placeholder="如 4、48" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="slaForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="slaDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitSla">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { toRef, watch } from 'vue'
import { type OrderStatusItem } from '@/api/order-status-config'
import { formatDisplayNumber } from '@/utils/display-number'
import { useOrderSettingsSla } from '@/composables/useOrderSettingsSla'

const props = defineProps<{
  active: boolean
  statusList: OrderStatusItem[]
  ensureStatuses: () => Promise<void>
}>()

const {
  slaList,
  slaDialog,
  slaForm,
  slaStatusOptions,
  loadSlaList,
  openSlaDialog,
  submitSla,
  removeSla,
} = useOrderSettingsSla(toRef(props, 'statusList'))

watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await props.ensureStatuses()
    await loadSlaList()
  },
  { immediate: true },
)
</script>

<style scoped>
.section-title {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: 600;
}
.section-desc {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--space-sm);
}
.sla-actions {
  margin-bottom: var(--space-sm);
}
</style>
