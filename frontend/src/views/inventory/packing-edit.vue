<template>
  <div class="page-card packing-edit-page" v-loading="edit.loading.value">
    <div class="edit-header">
      <div class="edit-title">
        <el-button link @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <span class="edit-code">{{ edit.code.value ? `装箱单 ${edit.code.value}` : '新建装箱单' }}</span>
        <el-tag v-if="edit.isShipped.value" type="success" size="small">已发货</el-tag>
        <el-tag v-else-if="edit.listId.value" type="info" size="small">草稿</el-tag>
        <span v-if="edit.isShipped.value" class="edit-shipped-tip">可修改装箱方式，保存不影响库存</span>
      </div>
      <div class="edit-actions">
        <el-button v-if="edit.detail.value" :type="edit.isShipped.value ? 'primary' : ''" @click="openDoc">客户单</el-button>
        <el-button v-if="edit.detail.value" @click="openLabels">箱贴</el-button>
        <el-button v-if="edit.detail.value" @click="onExport">导出 Excel</el-button>
        <el-button @click="grid.addBox()">加箱</el-button>
        <template v-if="!edit.isShipped.value">
          <el-button :loading="edit.saving.value" @click="edit.save()">保存草稿</el-button>
          <el-button type="primary" :loading="shipping" @click="onShip">确认发货</el-button>
        </template>
        <el-button v-else type="primary" :loading="edit.saving.value" @click="edit.save()">保存修改</el-button>
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
            placeholder="选择或输入客户"
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
            placeholder="选择或输入业务员"
          >
            <el-option v-for="s in edit.salespersonOptions.value" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="PO#">
          <el-input v-model="edit.form.poNo" placeholder="选填，箱贴抬头优先用 PO" />
        </el-form-item>
        <el-form-item label="小满单号">
          <el-input v-model="edit.form.xiaomanOrderNo" placeholder="选填，仅供财务审核，不打印" />
        </el-form-item>
        <el-form-item label="装箱日期">
          <el-date-picker
            v-model="edit.form.packDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            placeholder="装箱日期"
          />
        </el-form-item>
        <el-form-item label="备注" class="head-form-remark">
          <el-input v-model="edit.form.remark" placeholder="整单备注" />
        </el-form-item>
        <el-form-item label="公司抬头">
          <el-tooltip content="开启后箱贴/客户单顶部显示公司名" placement="top">
            <el-switch v-model="edit.form.showCompany" />
          </el-tooltip>
        </el-form-item>
      </div>
    </el-form>

    <PackingGrid
      ref="packingGridRef"
      :flat-rows="grid.flatRows.value"
      :size-headers="grid.sizeHeaders.value"
      :totals="grid.totals.value"
      @add-size-at="onAddSizeAt"
      @rename-size="onRenameSize"
      @remove-size-at="onRemoveSizeAt"
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
const packingGridRef = ref<InstanceType<typeof PackingGrid> | null>(null)
const shipping = ref(false)
const labelsVisible = ref(false)
const docVisible = ref(false)

function openLabels() {
  if (!edit.detail.value) return
  docVisible.value = false
  labelsVisible.value = true
}

function openDoc() {
  if (!edit.detail.value) return
  labelsVisible.value = false
  docVisible.value = true
}

function onExport() {
  if (!edit.detail.value) return
  exportPackingListExcel(edit.detail.value)
}

function goBack() {
  router.push('/inventory/packing')
}

function onAddSizeAt(index: number) {
  const at = grid.addSizeColumn(index)
  // 标准码已自动填好不抢焦点；仅当标准码用尽留了空列时才聚焦让用户手填
  if (!grid.sizeHeaders.value[at]) packingGridRef.value?.focusSizeHeader(at)
}

function onRenameSize(index: number, oldName: string) {
  if (grid.commitSizeHeader(index, oldName) === 'duplicate') ElMessage.warning('该尺码列已存在')
}

async function onRemoveSizeAt(index: number) {
  const size = grid.sizeHeaders.value[index]
  const hasQty = !!size && grid.boxes.value.some((box) => box.items.some((item) => (item.sizeQuantities[size] ?? 0) > 0))
  if (hasQty) {
    try {
      await ElMessageBox.confirm(`「${size}」列已有填写数量，删除将一并清除，是否继续？`, '删除尺码列', { type: 'warning' })
    } catch {
      return
    }
  }
  grid.removeSizeColumnAt(index)
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
    await ElMessageBox.confirm(`共 ${boxCount} 箱 / ${totalQty} 件，确认发货？发货后将扣减待仓/成品库存（发货后仍可修改装箱方式，不影响库存）。`, '确认发货', { type: 'warning' })
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

.edit-shipped-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
}

.head-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(190px, 1fr));
  gap: 0 var(--space-lg);
}

.head-form-grid :deep(.el-form-item) {
  margin-bottom: var(--space-sm);
}

.head-form-remark {
  grid-column: span 2;
}
</style>
