<template>
  <div class="page-card page-card--fill inventory-fabric-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="tab-pane-scroll">
        <div class="filter-bar">
          <el-input
            v-model="filter.name"
            placeholder="面料名称"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('名称：', filter.name, nameLabelVisible)"
            :input-style="getFilterInputStyle(filter.name)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.name && nameLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                名称：
              </span>
            </template>
          </el-input>
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-date-picker
            v-model="inboundDateRange"
            type="daterange"
            range-separator=""
            start-placeholder="入库时间"
            end-placeholder=""
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            unlink-panels
            clearable
            size="large"
            :class="['filter-bar-item', 'filter-range', { 'range-single': !inboundDateRange }]"
            :style="getFilterRangeStyle(inboundDateRange)"
            @change="onSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openForm(null)">新增面料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              size="large"
              :disabled="selectedRows.length !== 1"
              @click="openOutboundDialog()"
            >
              出库
            </el-button>
          </div>
        </div>

        <div ref="fabricStockShellRef" class="list-page-table-shell">
        <el-table
          ref="fabricStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="fabric-table"
          :height="fabricStockTableHeight"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onFabricStockHeaderDragEnd"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" align="center" header-align="center" />
          <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb
                v-if="row.imageUrl"
                :raw-url="row.imageUrl"
                :width="compactImageSize"
                :height="compactImageSize"
              />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="面料名称" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="supplierName" label="供应商" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="warehouseLabel" label="仓库" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="storageLocation" label="存放地址" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="数量" width="100" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" header-align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="info" size="small" @click="openDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="load"
            @size-change="onPageSizeChange"
          />
        </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="tab-pane-scroll">
        <div class="filter-bar">
          <el-input v-model="outboundFilter.name" placeholder="面料名称" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-select v-model="outboundFilter.customerName" placeholder="客户" filterable clearable size="large" class="filter-bar-item" @change="onOutboundSearch(true)">
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            start-placeholder="出库时间"
            end-placeholder=""
            range-separator=""
            unlink-panels
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            size="large"
            :class="['filter-bar-item', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
            :style="getInventoryOutboundRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <div ref="fabricOutboundShellRef" class="list-page-table-shell">
        <el-table
          ref="fabricOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="fabric-table"
          :height="fabricOutboundTableHeight"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onFabricOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="时间" width="160" align="center" header-align="center" />
          <el-table-column prop="name" label="面料名称" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="pickupUserName" label="领取人" min-width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="出库数量" width="110" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="照片" :width="compactImageColumnMinWidth" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb
                v-if="row.photoUrl"
                :raw-url="row.photoUrl"
                :width="compactImageSize"
                :height="compactImageSize"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadOutbounds"
            @size-change="onOutboundPageSizeChange"
          />
        </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.isEdit ? '编辑面料' : '新增面料'"
      width="560"
      destroy-on-close
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="88px">
        <el-alert
          v-if="quickAddSource"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 10px"
          :title="`已按「${quickAddSource.name || '-'}」回填，提交后会把本次数量增量到该记录`"
        />
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="面料名称/编号" clearable />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number
            v-model="form.quantity"
            :min="0"
            :precision="2"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="form.unit" placeholder="如米、公斤" clearable />
        </el-form-item>
        <el-form-item label="客户">
          <el-select
            v-model="form.customerName"
            placeholder="请选择客户（可选）"
            filterable
            clearable
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="供应商">
          <el-select
            :key="fabricSupplierSelectKey"
            v-model="form.supplierId"
            placeholder="面料供应商（可选），按名称中的连续文字筛选"
            filterable
            clearable
            :loading="fabricSupplierOptionsLoading"
          >
            <el-option
              v-for="opt in fabricSupplierOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="form.warehouseId" placeholder="仓库（可选）" filterable clearable>
            <el-option
              v-for="opt in warehouseOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="存放地址">
          <el-input v-model="form.storageLocation" placeholder="存放位置（可选）" clearable />
        </el-form-item>
        <el-form-item label="图片" prop="imageUrl">
          <ImageUploadArea v-model="form.imageUrl" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="formDialog.submitting" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="outboundDialog.visible"
      title="面料出库"
      width="500"
      destroy-on-close
      @close="resetOutboundForm"
    >
      <el-form
        ref="outboundFormRef"
        :model="outboundForm"
        :rules="outboundRules"
        label-width="90px"
      >
        <el-form-item label="领取人" prop="pickupUserId">
          <el-select
            v-model="outboundForm.pickupUserId"
            placeholder="请选择领取人"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in fabricPickupUserOptions"
              :key="opt.id"
              :label="opt.displayName?.trim() || opt.username"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="出库数量" prop="quantity">
          <el-input-number
            v-model="outboundForm.quantity"
            :min="0.01"
            :max="outboundMaxQty"
            :precision="2"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="拍照" prop="photoUrl" required>
          <ImageUploadArea v-model="outboundForm.photoUrl" :compact="false" />
        </el-form-item>
        <el-form-item label="备注" prop="remark" required>
          <el-input
            v-model="outboundForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请填写谁领走以及用途"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="outboundDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="outboundDialog.submitting"
          :disabled="
            !outboundForm.pickupUserId ||
            !outboundForm.photoUrl ||
            !outboundForm.remark?.trim()
          "
          @click="submitOutbound"
        >
          确定出库
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailDrawer.visible"
      title="面料详情"
      size="560px"
      destroy-on-close
    >
      <div v-if="detailDrawer.row" class="detail-base">
        <div><span class="detail-label">名称：</span>{{ detailDrawer.row.name || '-' }}</div>
        <div><span class="detail-label">客户：</span>{{ detailDrawer.row.customerName || '-' }}</div>
        <div><span class="detail-label">供应商：</span>{{ detailDrawer.row.supplierName || '-' }}</div>
        <div><span class="detail-label">仓库：</span>{{ detailDrawer.row.warehouseLabel || '-' }}</div>
        <div><span class="detail-label">存放地址：</span>{{ detailDrawer.row.storageLocation || '-' }}</div>
        <div><span class="detail-label">当前库存：</span>{{ formatDisplayNumber(detailDrawer.row.quantity) }} {{ detailDrawer.row.unit || '' }}</div>
        <div><span class="detail-label">备注：</span>{{ detailDrawer.row.remark || '-' }}</div>
      </div>
      <div class="detail-log-title">操作记录</div>
      <el-timeline v-loading="detailDrawer.loading">
        <el-timeline-item
          v-for="log in detailDrawer.logs"
          :key="log.id"
          :timestamp="formatDate(log.createdAt)"
          placement="top"
        >
          {{ formatLogAction(log.action) }}｜操作人：{{ log.operatorUsername || '-' }}{{ log.remark ? `｜备注：${log.remark}` : '' }}
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFabricInventoryStock } from '@/composables/useFabricInventoryStock'
import { useFabricInventoryOutbound } from '@/composables/useFabricInventoryOutbound'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const pageTab = ref<'stock' | 'outbounds'>('stock')
const stock = useFabricInventoryStock()
const outbound = useFabricInventoryOutbound({
  selectedRows: stock.selectedRows,
  reloadStock: stock.load,
})

const {
  filter,
  inboundDateRange,
  nameLabelVisible,
  list,
  loading,
  pagination,
  selectedRows,
  customerOptions,
  fabricSupplierOptions,
  fabricSupplierSelectKey,
  fabricSupplierOptionsLoading,
  warehouseOptions,
  fabricStockTableRef,
  fabricStockShellRef,
  fabricStockTableHeight,
  onFabricStockHeaderDragEnd,
  formDialog,
  quickAddSource,
  formRef,
  form,
  formRules,
  detailDrawer,
  load,
  onSearch,
  debouncedSearch,
  onReset,
  onPageSizeChange,
  onSelectionChange,
  loadCustomerOptions,
  loadFabricSupplierOptions,
  loadWarehouseOptions,
  openForm,
  resetForm,
  submitForm,
  formatLogAction,
  openDetail,
} = stock

const {
  outboundFilter,
  outboundList,
  outboundLoading2,
  outboundPagination,
  fabricOutboundTableRef,
  fabricOutboundShellRef,
  fabricOutboundTableHeight,
  onFabricOutboundHeaderDragEnd,
  outboundDialog,
  outboundFormRef,
  outboundForm,
  outboundRules,
  outboundMaxQty,
  fabricPickupUserOptions,
  getInventoryOutboundRangeStyle,
  loadOutbounds,
  onOutboundSearch,
  onOutboundReset,
  onOutboundPageSizeChange,
  loadFabricPickupUserOptions,
  openOutboundDialog,
  resetOutboundForm,
  submitOutbound,
} = outbound

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    loadOutbounds()
  }
}

onMounted(() => {
  loadCustomerOptions()
  loadFabricSupplierOptions()
  loadWarehouseOptions()
  loadFabricPickupUserOptions()
  load()
})

</script>

<style scoped>
.inventory-fabric-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.inventory-fabric-page .fabric-table {
  flex: 1;
  min-height: 0;
}

.fabric-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.detail-base {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-label {
  color: var(--color-text-muted);
}

.detail-log-title {
  margin: 8px 0 12px;
  font-weight: 600;
}

</style>
