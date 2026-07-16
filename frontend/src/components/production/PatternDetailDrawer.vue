<template>
  <ProductionDetailDrawerShell
    v-model="visible"
    title="纸样详情"
    :size="760"
    :resizable="true"
    @closed="onClosed"
  >
    <template v-if="row">
      <ProductionDetailSection>
        <ProductionOrderBriefPanel :brief="brief" />
      </ProductionDetailSection>
      <ProductionDetailSection title="业务扩展信息">
        <el-descriptions :column="2" border size="small" class="pattern-brief-extra">
          <el-descriptions-item label="纸样师">
            {{ (row.patternMaster ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="车版师">
            {{ (row.sampleMaker ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="纸样状态">
            {{ patternStatusLabel(row.patternStatus) }}
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="时效与节点">
        <el-descriptions :column="2" border size="small" class="pattern-brief-extra">
          <el-descriptions-item label="到纸样时间">
            {{ formatDateTime(row.arrivedAtPattern) }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{ formatDateTime(row.completedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="时效判定">
            <SlaJudgeTag :text="row.timeRating" />
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="纸样物料/裁片清单">
        <template #actions>
          <el-button
            v-if="!editMode && canEdit"
            size="small"
            text
            type="primary"
            class="materials-head-btn"
            :disabled="loading"
            @click="enterEdit"
          >
            <el-icon><Edit /></el-icon>
            <span>编辑</span>
          </el-button>
          <template v-if="editMode">
            <el-button size="small" :disabled="saving" @click="cancelEdit">取消</el-button>
            <el-button
              type="primary"
              size="small"
              :loading="saving"
              :disabled="loading"
              @click="handleSave"
            >
              保存
            </el-button>
          </template>
        </template>

        <el-table v-loading="loading" :data="materialsForm.materials" border size="small" class="materials-table">
          <el-table-column label="物料类型" min-width="110" align="center">
            <template #default="{ row: matRow }">
              <el-select
                v-model="matRow.materialTypeId"
                placeholder="选择"
                filterable
                clearable
                size="small"
                style="width: 100%"
                :disabled="!canEdit || !editMode"
              >
                <el-option v-for="opt in materialTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="物料名称" min-width="180" align="center">
            <template #default="{ row: matRow }">
              <el-input v-model="matRow.materialName" size="small" :disabled="!canEdit || !editMode" />
            </template>
          </el-table-column>
          <el-table-column label="幅宽(cm)" width="120" align="center">
            <template #default="{ row: matRow }">
              <el-input
                v-model="matRow.fabricWidth"
                size="small"
                placeholder="如 183cm"
                :disabled="!canEdit || !editMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="单件用量(米)" width="110" align="center">
            <template #default="{ row: matRow }">
              <el-input-number
                v-model="matRow.usagePerPiece"
                :min="0"
                :formatter="formatMaterialUsageQtyDisplay"
                :parser="parseMaterialUsageQtyInput"
                :controls="false"
                size="small"
                :disabled="!canEdit || !editMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="裁片数量" width="110" align="center">
            <template #default="{ row: matRow }">
              <el-input-number
                v-model="matRow.cuttingQuantity"
                :min="0"
                :controls="false"
                size="small"
                :disabled="!canEdit || !editMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="200" align="center">
            <template #default="{ row: matRow }">
              <el-input v-model="matRow.remark" size="small" :disabled="!canEdit || !editMode" />
            </template>
          </el-table-column>
          <el-table-column v-if="canEdit && editMode" label="操作" width="70" fixed="right" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeMaterialRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="editMode" class="materials-add-row">
          <el-button link type="primary" size="small" :disabled="loading" @click="addMaterialRow">
            <el-icon><Plus /></el-icon>
            <span>新增一行</span>
          </el-button>
        </div>

        <div class="materials-remark">
          <div class="materials-remark-label">备注</div>
          <div class="materials-remark-field">
            <el-input
              v-model="materialsForm.remark"
              type="textarea"
              size="small"
              :autosize="{ minRows: 1, maxRows: 8 }"
              placeholder="可选"
              :disabled="!canEdit || !editMode"
            />
          </div>
        </div>
      </ProductionDetailSection>
      <ProductionDetailSection>
        <OperationLogsSection :logs="logs" />
      </ProductionDetailSection>
    </template>
  </ProductionDetailDrawerShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Edit, Plus } from '@element-plus/icons-vue'
import { formatDateTime } from '@/utils/date-format'
import { patternStatusLabel } from '@/composables/usePatternList'
import { type PatternListItem, type PatternMaterialRow } from '@/api/production-pattern'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import {
  formatMaterialUsageQtyDisplay,
  parseMaterialUsageQtyInput,
} from '@/utils/material-usage-qty'

interface MaterialsForm {
  materials: PatternMaterialRow[]
  remark: string
}

const props = defineProps<{
  modelValue: boolean
  row: PatternListItem | null
  brief: ProductionOrderBriefModel
  loading: boolean
  saving: boolean
  canEdit: boolean
  materialsForm: MaterialsForm
  materialTypeOptions: { id: number; label: string }[]
  logs: Array<{ id: string | number; operatorUsername: string; createdAt: string; summary: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
  'enter-edit': []
  'cancel-edit': []
  save: []
  'add-material-row': []
  'remove-material-row': [index: number]
}>()

const visible = ref(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (!v) editMode.value = false
  },
)
watch(visible, (v) => {
  emit('update:modelValue', v)
})

const editMode = ref(false)

function enterEdit() {
  emit('enter-edit')
  editMode.value = true
}

function cancelEdit() {
  emit('cancel-edit')
  editMode.value = false
}

function handleSave() {
  emit('save')
}

function onSaveSuccess() {
  editMode.value = false
}

function addMaterialRow() {
  emit('add-material-row')
}

function removeMaterialRow(index: number) {
  emit('remove-material-row', index)
}

function onClosed() {
  editMode.value = false
  emit('closed')
}

defineExpose({ onSaveSuccess })
</script>
