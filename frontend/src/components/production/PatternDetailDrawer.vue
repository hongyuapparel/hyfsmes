<template>
  <AppDrawer v-model="visible" title="纸样工作区" :size="1060" :min-size="760" :max-size="1400" resizable :before-close="beforeClose" @closed="onClosed">
    <div v-if="row" class="pattern-workspace">
      <ProductionDetailSection>
        <ProductionOrderBriefPanel :brief="brief" :image-width="96" :image-height="160" />
      </ProductionDetailSection>
      <ProductionDetailSection title="打样安排">
        <template #actions>
          <el-button v-if="canAssign && row.canAssign" type="primary" size="small" :disabled="busy || saving" @click="emit('assign')">分配师傅</el-button>
        </template>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="当前进度">{{ patternStatusLabel(row.patternStatus) }}</el-descriptions-item>
          <el-descriptions-item label="纸样师">{{ row.patternMaster || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="车版师">{{ row.sampleMaker || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="客户交期判定"><el-tooltip :content="row.timeRatingReason"><span><SlaJudgeTag :text="row.timeRating" /><span v-if="row.overdueDays != null && row.overdueDays > 0"> {{ row.overdueDays }} 天</span></span></el-tooltip></el-descriptions-item>
          <el-descriptions-item label="到纸样时间">{{ formatDateTime(row.arrivedAtPattern) }}</el-descriptions-item>
          <el-descriptions-item label="完成时间">{{ formatDateTime(row.completedAt) }}</el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="实际用料">
        <template #actions>
          <el-text v-if="editMode" type="info" size="small" role="status">{{ hasUnsavedChanges ? '有修改尚未保存' : '正在编辑用料' }}</el-text>
          <el-button v-if="!editMode && canEdit" type="primary" size="small" :disabled="loading || busy || saving" @click="enterEdit">修改用料</el-button>
          <el-button v-if="editMode" size="small" :disabled="saving || busy" @click="cancelEdit">取消</el-button>
          <el-button v-if="editMode && canEdit" size="small" type="primary" :disabled="loading || busy" :loading="saving" @click="handleSave">保存用料</el-button>
          <el-button v-if="showComplete && !editMode" size="small" type="primary" :disabled="loading || saving || busy" @click="emit('complete')">确认完成</el-button>
        </template>
        <div v-loading="loading" class="pattern-workspace-materials">
          <PatternMaterialsPanel :form="materialsForm" :options="materialTypeOptions" :editing="editMode && canEdit" :busy="saving || loading || busy" @add="addMaterialRow" @remove="removeMaterialRow" />
        </div>
      </ProductionDetailSection>
      <ProductionDetailSection title="样品图片">
        <template #actions>
          <el-button v-if="canEditImage && row.patternStatus === 'completed'" size="small" :disabled="busy || saving" @click="emit('edit-image')">修改样品图片</el-button>
        </template>
        <AppImageThumb v-if="row.sampleImageUrl" :raw-url="row.sampleImageUrl" variant="dialog" />
        <el-text v-else type="info" size="small">暂无样品图片（选填）</el-text>
      </ProductionDetailSection>
      <el-alert v-if="logsError" :title="logsError" type="error" :closable="false" />
      <OperationLogsSection v-else :logs="displayLogs" />
    </div>

  </AppDrawer>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import PatternMaterialsPanel from './PatternMaterialsPanel.vue'
import { formatDateTime } from '@/utils/date-format'
import { patternStatusLabel } from '@/composables/usePatternList'
import { type PatternListItem, type PatternMaterialRow } from '@/api/production-pattern'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import AppDrawer from '@/components/AppDrawer.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'

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
  hasUnsavedChanges: boolean
  canAssign: boolean
  canComplete: boolean
  canEditImage: boolean
  busy: boolean
  canEdit: boolean
  materialsForm: MaterialsForm
  materialTypeOptions: { id: number; label: string }[]
  logsError?: string
  logs: Array<{ id: string | number; operatorUsername: string; createdAt: string; summary: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
  'enter-edit': []
  'cancel-edit': []
  save: []
  assign: []
  complete: []
  'edit-image': []
  'add-material-row': []
  'remove-material-row': [index: number]
}>()

const displayLogs = computed(() => props.logs.map(log => ({ ...log, createdAt: formatDateTime(log.createdAt) })))
const showComplete = computed(() => props.canComplete && props.row != null && props.row.patternStatus !== 'completed')
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
  if (props.loading || props.saving || props.busy || !props.canEdit) return
  emit('enter-edit')
  editMode.value = true
}

async function cancelEdit() {
  if (!await canDiscardChanges()) return
  emit('cancel-edit')
  editMode.value = false
}

function handleSave() {
  if (props.loading || props.saving || props.busy || !props.canEdit || !editMode.value) return
  emit('save')
}

let discardPromptOpen = false
async function canDiscardChanges(): Promise<boolean> {
  if (props.saving || props.busy || discardPromptOpen) return false
  if (!props.hasUnsavedChanges) return true
  discardPromptOpen = true
  try {
    await ElMessageBox.confirm('修改尚未保存，关闭后会丢失这些修改。', '放弃修改？', {
      confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning',
      closeOnClickModal: false,
    })
    return true
  } catch { return false }
  finally { discardPromptOpen = false }
}

async function beforeClose(done: () => void) {
  if (await canDiscardChanges()) done()
}

watch(() => props.row?.orderId, () => { editMode.value = false })

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

<style scoped>
.pattern-workspace, .pattern-workspace-materials { display: flex; flex-direction: column; gap: var(--space-sm); }
.pattern-workspace { flex: 1; min-height: 0; overflow-y: auto; }
.pattern-workspace > * { flex-shrink: 0; }
</style>
