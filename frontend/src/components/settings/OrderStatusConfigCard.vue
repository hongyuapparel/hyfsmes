<template>
  <div v-show="active">
    <h3 class="section-title">订单流转规则</h3>
    <p class="section-desc">在这里维护销售订单从草稿到完成的各个状态，以及在不同状态下通过按钮或自动事件流转到下一状态的规则。仅影响配置，不会自动修改历史订单。</p>
    <div class="status-layout">
      <div class="status-list">
        <div class="status-list-header">
          <span>订单状态</span>
          <el-button type="primary" size="small" @click="state.openCreateStatus">新增状态</el-button>
        </div>
        <el-table :data="state.statusList" size="small" border highlight-current-row row-key="id" @current-change="state.onCurrentStatusChange">
          <el-table-column prop="label" label="名称" width="160" />
          <el-table-column prop="sortOrder" label="排序" width="80" />
          <el-table-column prop="isFinal" label="终态" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.isFinal" type="success" size="small">是</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="state.openEditStatus(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="state.removeStatus(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="transition-list">
        <div class="transition-header">
          <div class="transition-title">
            <span>流程链路</span>
            <span class="transition-subtitle">（按整条链路管理与编辑）</span>
          </div>
          <div class="transition-actions">
            <el-button type="primary" plain size="small" @click="state.openChainDialog">新增流程链路</el-button>
          </div>
        </div>
        <el-table ref="chainTableRef" :data="state.chainList" size="small" border row-key="chain.id">
          <el-table-column label="" width="44" align="center">
            <template #default><span class="chain-drag-handle" title="拖拽调整顺序">≡</span></template>
          </el-table-column>
          <el-table-column label="名称" width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.chain.name }}</template>
          </el-table-column>
          <el-table-column label="链路内容" min-width="360" show-overflow-tooltip>
            <template #default="{ row }">{{ state.buildChainSummary(row.steps) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="state.openEditChain(row)">编辑链路</el-button>
              <el-button link type="primary" size="small" @click="state.duplicateChain(row)">复制链路</el-button>
              <el-button link type="danger" size="small" @click="state.removeChain(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog v-model="state.statusDialog.visible" :title="state.statusDialog.isEdit ? '编辑状态' : '新增状态'" width="420px">
      <el-form :model="state.statusForm" label-width="100px" size="default">
        <el-form-item label="名称"><el-input v-model="state.statusForm.label" placeholder="如 草稿、待审单" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="state.statusForm.sortOrder" :min="0" :controls="false" style="width: 100%" /></el-form-item>
        <el-form-item label="是否终态"><el-switch v-model="state.statusForm.isFinal" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="state.statusDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="state.submitStatus">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-if="false" v-model="state.transitionDialog.visible" :title="state.transitionDialog.isEdit ? '编辑流转规则' : '新增流转规则'" width="520px">
      <el-form :model="state.transitionForm" label-width="120px" size="default">
        <el-form-item label="当前订单状态"><el-input :model-value="state.getStatusLabel(state.transitionForm.fromStatus)" disabled /></el-form-item>
        <el-form-item label="流转到哪个状态">
          <el-select v-model="state.transitionForm.toStatus" placeholder="选择目标状态" style="width: 100%">
            <el-option v-for="status in state.statusList" :key="status.id" :label="status.label" :value="status.code" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="state.transitionDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="state.submitTransition">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="state.chainDialog.visible" :title="state.chainEdit.id ? '编辑流程链路' : '新增流程链路'" width="900px" destroy-on-close>
      <p class="section-desc">按顺序配置每一步：从哪个状态、通过什么动作、到哪个状态。</p>
      <el-form label-width="120px" size="default">
        <el-form-item label="链路名称"><el-input v-model="state.chainForm.name" placeholder="如：默认主流程" /></el-form-item>
        <el-form-item label="适用订单类型">
          <el-select v-model="state.chainForm.orderTypeIds" multiple collapse-tags collapse-tags-tooltip clearable filterable placeholder="不选表示全部订单类型" style="width: 100%">
            <el-option v-for="opt in state.chainOrderTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用合作方式">
          <el-select v-model="state.chainForm.collaborationTypeIds" multiple collapse-tags collapse-tags-tooltip clearable filterable placeholder="不选表示全部合作方式" style="width: 100%">
            <el-option v-for="opt in state.chainCollaborationOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用工艺">
          <el-select v-model="state.chainForm.hasProcessItem" clearable placeholder="不选表示全部" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="仅有工艺项目" value="has" />
            <el-option label="仅无工艺项目" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item label="流程步骤">
          <div class="chain-steps">
            <div v-for="(step, index) in state.chainForm.steps" :key="index" class="chain-step-row">
              <span class="step-num">第 {{ index + 1 }} 步</span>
              <el-select v-model="step.fromStatusCode" placeholder="从状态" size="small" style="width: 120px">
                <el-option v-for="status in state.statusList" :key="status.id" :label="status.label" :value="status.code" />
              </el-select>
              <span class="step-arrow">→</span>
              <el-select v-model="step.toStatusCode" placeholder="到状态" size="small" style="width: 120px">
                <el-option v-for="status in state.statusList" :key="status.id" :label="status.label" :value="status.code" />
              </el-select>
              <el-select v-model="step.triggerType" placeholder="触发方式" size="small" style="width: 100px">
                <el-option label="按钮操作" value="button" />
                <el-option label="自动事件" value="auto_event" />
              </el-select>
              <el-select v-model="step.triggerCode" placeholder="触发动作" size="small" style="width: 140px">
                <el-option v-for="opt in TRIGGER_ACTION_OPTIONS" :key="opt.code" :label="opt.label" :value="opt.code" />
              </el-select>
              <el-button type="danger" link size="small" :disabled="state.chainForm.steps.length <= 1" @click="state.removeChainStep(index)">删除</el-button>
            </div>
          </div>
          <el-button type="primary" plain size="small" @click="state.addChainStep">添加一步</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="state.chainDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="state.submitChain">确定（保存整条链路）</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { watch, toRaw } from 'vue'
import { TRIGGER_ACTION_OPTIONS } from '@/composables/useOrderSettingsStatus'

const props = defineProps<{ active: boolean; state: any }>()
const state = props.state
const chainTableRef = toRaw(state).chainTableRef

watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await state.loadStatuses()
    await state.loadChains()
    await state.loadOrderTypesForChain()
    await state.loadCollaborationOptionsForChain()
  },
  { immediate: true },
)
</script>

<style scoped>
.section-title { margin: 0 0 var(--space-sm); font-size: var(--font-size-body); font-weight: 600; }
.section-desc { font-size: var(--font-size-caption); color: var(--el-text-color-secondary); margin: 0 0 var(--space-sm); }
.status-layout { display: flex; flex-direction: column; gap: 16px; margin-top: var(--space-md); }
.status-list, .transition-list { min-width: 0; }
.status-list-header { display: flex; justify-content: flex-start; align-items: center; margin-bottom: var(--space-xs); gap: var(--space-sm); }
.transition-header { display: flex; justify-content: flex-start; align-items: center; margin-bottom: var(--space-xs); gap: 12px; }
.transition-title { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.transition-subtitle { font-size: var(--font-size-caption); color: var(--el-text-color-secondary); }
.transition-actions { display: flex; gap: 8px; }
.chain-steps { margin-bottom: var(--space-sm); max-width: 100%; overflow-x: auto; padding-bottom: 4px; }
.chain-step-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: nowrap; }
.chain-step-row .step-num { width: 52px; font-size: var(--font-size-caption); color: var(--el-text-color-secondary); }
.chain-step-row .step-arrow { color: var(--el-text-color-secondary); }
.chain-drag-handle { display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; cursor: grab; user-select: none; color: var(--el-text-color-secondary); }
.chain-drag-handle:active { cursor: grabbing; }
.chain-drag-ghost { opacity: 0.6; }
@media (max-width: 1100px) { .chain-step-row { flex-wrap: wrap; } }
</style>
