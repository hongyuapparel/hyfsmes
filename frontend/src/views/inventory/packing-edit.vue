<template>
  <div class="page-card packing-edit-page" v-loading="edit.loading.value">
    <div class="edit-header">
      <div class="edit-title">
        <el-button link @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <span class="edit-code">{{ edit.code.value ? `装箱单 ${edit.code.value}` : '新建装箱单' }}</span>
        <el-tag v-if="edit.isReadonly.value" type="success" size="small">已发货</el-tag>
        <el-tag v-else-if="edit.listId.value" type="info" size="small">草稿</el-tag>
      </div>
      <div class="edit-actions">
        <el-button v-if="edit.detail.value" :type="edit.isReadonly.value ? 'primary' : ''" @click="openDoc">客户单</el-button>
        <el-button v-if="edit.detail.value" @click="openLabels">箱贴</el-button>
        <el-button v-if="edit.detail.value" @click="onExport">导出 Excel</el-button>
        <template v-if="!edit.isReadonly.value">
          <el-button @click="grid.addBox()">加箱</el-button>
          <el-button :loading="edit.saving.value" @click="edit.save()">保存草稿</el-button>
          <el-button type="primary" :loading="shipping" @click="onShip">确认发货</el-button>
        </template>
        <template v-else>
          <el-button @click="goBack">返回</el-button>
        </template>
      </div>
    </div>

    <el-form class="head-form" label-width="76px" @submit.prevent>
      <div class="head-form-grid">
        <el-form-item label="客户">
          <el-select
            v-model="edit.form.customerName"
            filterable
            allow-create
            default-first-option
            :placeholder="edit.isReadonly.value ? '' : '选择或输入客户'"
            :disabled="edit.isReadonly.value"
            @change="edit.onCustomerChange"
          >
            <el-option v-for="c in edit.customerOptions.value" :key="c.id" :label="c.companyName" :value="c.companyName" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务员">
          <el-select
            v-model="edit.form.serviceManager"
            filterable
            allow-create
            default-first-option
            clearable
            :placeholder="edit.isReadonly.value ? '' : '选择或输入业务员'"
            :disabled="edit.isReadonly.value"
          >
            <el-option v-for="u in edit.userOptions.value" :key="u.id" :label="u.displayName || u.username" :value="u.displayName || u.username" />
          </el-select>
        </el-form-item>
        <el-form-item label="PO#">
          <el-input v-model="edit.form.poNo" :placeholder="edit.isReadonly.value ? '' : '选填，箱贴抬头优先用 PO'" :disabled="edit.isReadonly.value" />
        </el-form-item>
        <el-form-item label="装箱日期">
          <el-date-picker
            v-model="edit.form.packDate"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="edit.isReadonly.value ? '' : '装箱日期'"
            :disabled="edit.isReadonly.value"
          />
        </el-form-item>
        <el-form-item label="公司抬头">
          <el-switch v-model="edit.form.showCompany" :disabled="edit.isReadonly.value" />
          <span v-if="!edit.isReadonly.value" class="head-form-tip">箱贴/客户单是否显示公司名</span>
        </el-form-item>
        <el-form-item label="备注" class="head-form-remark">
          <el-input v-model="edit.form.remark" :placeholder="edit.isReadonly.value ? '' : '整单备注'" :disabled="edit.isReadonly.value" />
        </el-form-item>
      </div>
    </el-form>

    <PackingGrid
      :flat-rows="grid.flatRows.value"
      :size-headers="grid.sizeHeaders.value"
      :totals="grid.totals.value"
      :disabled="edit.isReadonly.value"
      @insert-size="onInsertSize"
      @remove-size="onRemoveSize"
      @copy-box="grid.copyBox"
      @remove-box="onRemoveBox"
      @add-item="grid.addItemToBox"
      @pick-goods="openPicker"
      @remove-item="grid.removeItem"
    />

    <PackingGoodsPickerDialog
      :visible="picker.visible"
      :customer-name="edit.form.customerName"
      :allocation="grid.allocationBySource.value"
      @update:visible="picker.visible = $event"
      @picked="onPicked"
    />

    <PackingLabelPrint
      v-if="edit.detail.value"
      :visible="labelsVisible"
      :detail="edit.detail.value"
      @update:visible="labelsVisible = $event"
    />

    <PackingDocument
      v-if="edit.detail.value"
      :visible="docVisible"
      :detail="edit.detail.value"
      @update:visible="docVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { shipPackingList, type PickableLine } from '@/api/packing-lists'
import { usePackingGridRows } from '@/composables/usePackingGridRows'
import { usePackingListEdit } from '@/composables/usePackingListEdit'
import PackingGrid from '@/components/packing/PackingGrid.vue'
import PackingGoodsPickerDialog from '@/components/packing/PackingGoodsPickerDialog.vue'
import PackingLabelPrint from '@/components/packing/PackingLabelPrint.vue'
import PackingDocument from '@/components/packing/PackingDocument.vue'
import { exportPackingListExcel } from '@/utils/packing-export'

const route = useRoute()
const router = useRouter()
const grid = usePackingGridRows()
const edit = usePackingListEdit(grid)
const picker = reactive({ visible: false, boxIndex: 0 })
const shipping = ref(false)
const labelsVisible = ref(false)
const docVisible = ref(false)

function openLabels() {
  if (!edit.detail.value) return
  labelsVisible.value = true
}

function openDoc() {
  if (!edit.detail.value) return
  docVisible.value = true
}

function onExport() {
  if (!edit.detail.value) return
  exportPackingListExcel(edit.detail.value)
}

function goBack() {
  router.push('/inventory/packing')
}

async function onInsertSize() {
  let value = ''
  try {
    const res = await ElMessageBox.prompt('请输入尺码名（如 XL）', '新增尺码列', { inputPattern: /\S+/, inputErrorMessage: '尺码名不能为空' })
    value = res.value
  } catch {
    return
  }
  if (!grid.insertSizeHeader(value)) ElMessage.warning('该尺码列已存在')
}

async function onRemoveSize(size: string) {
  const hasQty = grid.boxes.value.some((box) => box.items.some((item) => (item.sizeQuantities[size] ?? 0) > 0))
  if (hasQty) {
    try {
      await ElMessageBox.confirm(`「${size}」列已有填写数量，删除将一并清除，是否继续？`, '删除尺码列', { type: 'warning' })
    } catch {
      return
    }
  }
  grid.removeSizeHeader(size)
}

async function onRemoveBox(boxIndex: number) {
  const box = grid.boxes.value[boxIndex]
  const hasContent = box?.items.some((item) => item.styleNo || item.colorName || Object.keys(item.sizeQuantities).length)
  if (hasContent) {
    try {
      await ElMessageBox.confirm(`确定删除第 ${boxIndex + 1} 箱及其明细吗？`, '删除箱', { type: 'warning' })
    } catch {
      return
    }
  }
  grid.removeBox(boxIndex)
  if (!grid.boxes.value.length) grid.addBox()
}

function openPicker(boxIndex: number) {
  picker.boxIndex = boxIndex
  picker.visible = true
}

function onPicked(lines: PickableLine[]) {
  edit.addPickedLines(picker.boxIndex, lines)
}

async function onShip() {
  if (!edit.form.customerName.trim()) {
    ElMessage.warning('请先填写客户')
    return
  }
  const overs = grid.validateAgainstPicked(edit.pickedLines.value)
  if (overs.length) {
    const lines = overs
      .map((o) => `${o.styleNo || '-'} ${o.colorName || ''}${o.sizeName ? ` ${o.sizeName}码` : ''}：已分配 ${o.allocated} > 可发 ${o.available}`)
      .join('\n')
    ElMessageBox.alert(lines, '存在超发，请先调整数量', { type: 'warning' })
    return
  }
  const { boxCount, totalQty } = grid.totals.value
  try {
    await ElMessageBox.confirm(`共 ${boxCount} 箱 / ${totalQty} 件，确认发货？发货后将扣减待仓/成品库存且不可修改。`, '确认发货', { type: 'warning' })
  } catch {
    return
  }
  shipping.value = true
  let shipped = false
  try {
    // 新建单先保存但不导航：导航会重挂载组件，后续发货结果只会更新到旧实例上
    const saved = await edit.save(true, false)
    if (!saved || !edit.listId.value) return
    await shipPackingList(edit.listId.value)
    shipped = true
    ElMessage.success('已发货')
  } catch (e) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '发货失败'))
  } finally {
    shipping.value = false
  }
  if (!edit.listId.value) return
  if (!route.params.id) await router.replace(`/inventory/packing/edit/${edit.listId.value}`)
  else if (shipped) await edit.load()
}

onMounted(async () => {
  edit.loadOptions()
  await edit.load()
  if (route.query.action === 'labels') openLabels()
  if (route.query.action === 'doc') openDoc()
  if (route.query.action === 'export') onExport()
})

// 新建页（无 id 路由）被 keep-alive 复活时，旧实例可能还带着上一单的状态（发货后路由已换成 /edit/:id），
// 此时必须重置为全新空单；带 id 的编辑页不在此重置，避免覆盖用户未保存的修改
onActivated(() => {
  if (!route.params.id && edit.listId.value) edit.load()
})
</script>

<style scoped>
.packing-edit-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.edit-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.edit-code {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
}

.head-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 0 var(--space-md);
}

.head-form-grid :deep(.el-form-item) {
  margin-bottom: var(--space-sm);
}

.head-form-remark {
  grid-column: span 2;
}

.head-form-tip {
  margin-left: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-caption);
}
</style>
