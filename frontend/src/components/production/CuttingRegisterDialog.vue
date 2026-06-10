<template>
  <AppDialog
    v-model="visible"
    title="裁床登记"
    class="cutting-register-dialog"
    width="1020px"
    align-center
    destroy-on-close
    @close="emit('close')"
  >
    <template v-if="dialog.row">
      <CuttingBasicInfoBar :order-brief="form.orderBrief" />
      <p class="register-hint">
        按颜色、尺码填写<strong>实际裁剪件数</strong>（与订单 B 区一致）；下方登记布料领用与裁剪单价。
      </p>
      <CuttingQuantityMatrix
        v-model="form.actualCutRows"
        :headers="form.colorSizeHeaders"
        :matrix-max-height="320"
      />
      <el-divider content-position="left">物料用量明细</el-divider>
      <CuttingMaterialUsageTable
        v-model="form.materialUsageRows"
        :grand-pieces="actualCutGrandTotal"
      />
      <el-form :model="form" label-width="132px" class="cut-cost-form">
        <el-form-item label="裁剪部门">
          <el-select
            v-model="form.cuttingDepartment"
            placeholder="请选择"
            filterable
            clearable
            style="width: 240px"
            @change="emit('department-change')"
          >
            <el-option :label="selfDepartmentLabel" :value="selfDepartmentLabel" />
            <el-option
              v-for="opt in cuttingDepartmentOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isSelfCutting" label="裁剪人">
          <el-select
            v-model="form.cutterName"
            placeholder="请选择裁剪人"
            filterable
            clearable
            style="width: 240px"
          >
            <el-option
              v-for="opt in cutterOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isSelfCutting" label="本次净耗合计(米)">
          <span class="cut-readonly-num">{{ formatFabricGrand(fabricNetGrandTotal) }}</span>
          <span class="cut-readonly-hint">由上方物料明细自动汇总（领用 − 退回）</span>
        </el-form-item>
        <el-form-item label="裁剪单价（元/件）">
          <el-input-number
            :model-value="cuttingUnitPriceNum"
            :min="0"
            :precision="2"
            :controls="false"
            placeholder="元/件"
            style="width: 200px"
            @update:model-value="emit('update:cuttingUnitPriceNum', $event)"
          />
        </el-form-item>
        <el-form-item label="裁剪总成本（元）">
          <span class="cut-readonly-num">{{ formatDisplayNumber(cuttingTotalCostDisplay) }}</span>
          <span class="cut-readonly-hint">裁剪单价 × 实际裁剪数量合计</span>
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="emit('submit')">
        完成
      </el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CuttingListItem, CuttingMaterialUsagePayloadRow, CuttingRegisterOrderBrief } from '@/api/production-cutting'
import { formatDisplayNumber } from '@/utils/display-number'
import CuttingBasicInfoBar from '@/components/production-cutting/CuttingBasicInfoBar.vue'
import CuttingQuantityMatrix from '@/components/production-cutting/CuttingQuantityMatrix.vue'
import CuttingMaterialUsageTable from '@/components/production-cutting/CuttingMaterialUsageTable.vue'

interface RegisterForm {
  orderBrief: CuttingRegisterOrderBrief
  colorSizeHeaders: string[]
  actualCutRows: { colorName: string; quantities: number[]; remark?: string; imageUrl?: string }[]
  materialUsageRows: CuttingMaterialUsagePayloadRow[]
  cuttingDepartment: string
  cutterName: string
}

interface DialogState {
  visible: boolean
  submitting: boolean
  row: CuttingListItem | null
}

const props = defineProps<{
  dialog: DialogState
  form: RegisterForm
  selfDepartmentLabel: string
  cuttingDepartmentOptions: string[]
  isSelfCutting: boolean
  cutterOptions: string[]
  actualCutGrandTotal: number
  cuttingUnitPriceNum: number | undefined
  cuttingTotalCostDisplay: number
  fabricNetGrandTotal: number
  formatFabricGrand: (v: number) => string
}>()

const emit = defineEmits<{
  (e: 'update:dialog', val: DialogState): void
  (e: 'update:cuttingUnitPriceNum', val: number | undefined): void
  (e: 'close'): void
  (e: 'submit'): void
  (e: 'department-change'): void
}>()

const visible = computed({
  get: () => props.dialog.visible,
  set: (v) => emit('update:dialog', { ...props.dialog, visible: v }),
})
</script>

<style scoped>
.register-hint {
  margin-bottom: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.cut-cost-form {
  margin-top: var(--space-sm);
}

.cut-readonly-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-right: 8px;
}

.cut-readonly-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

<style>
.cutting-register-dialog.el-dialog {
  max-width: min(1020px, 96vw);
}
</style>
