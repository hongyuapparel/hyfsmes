<template>
  <div class="tab-pane-scroll">
    <el-form class="filter-bar" @submit.prevent>
      <el-input
        v-model="outboundFilter.orderNo"
        placeholder="订单号（自动出库）"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('订单号（自动出库）', outboundFilter.orderNo, false)"
        :input-style="getFilterInputStyle(outboundFilter.orderNo)"
        @keyup.enter="onSearch"
      />
      <el-select
        v-model="outboundFilter.outboundType"
        placeholder="出库类型"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(outboundFilter.outboundType ? `出库类型：${outboundFilter.outboundType === 'order_auto' ? '订单自动出库' : '手动出库'}` : '', '出库类型')"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="outboundFilter.outboundType">出库类型：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option label="订单自动出库" value="order_auto" />
        <el-option label="手动出库" value="manual" />
      </el-select>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': outboundFilter.dateRange && outboundFilter.dateRange.length === 2 }"
        :style="getFilterRangeStyle(outboundFilter.dateRange as [string, string] | [], '出库时间')"
      >
        <span v-if="outboundFilter.dateRange && outboundFilter.dateRange.length === 2" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">出库时间：</span>
        <el-date-picker
          v-model="outboundFilter.dateRange"
          type="daterange"
          :name="['accessoriesOutboundDateStart', 'accessoriesOutboundDateEnd']"
          :range-separator="outboundFilter.dateRange && outboundFilter.dateRange.length === 2 ? '~' : ''"
          start-placeholder="出库时间"
          end-placeholder=""
          unlink-panels
          clearable
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          size="large"
          :class="['filter-range', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
          @change="onSearch"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
      </div>
    </el-form>

    <div ref="shellRef" class="list-page-table-shell">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="outboundList"
        border
        stripe
        class="accessories-table"
        :height="tableHeight"
        :row-style="compactRowStyle"
        :cell-style="compactCellStyle"
        :header-cell-style="compactHeaderCellStyle"
        @header-dragend="onHeaderDragEnd"
      >
        <el-table-column prop="createdAt" label="时间" width="160" align="center">
          <template #default="{ row }">{{ row.createdAt }}</template>
        </el-table-column>
        <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
          <template #default="{ row }">
            <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" :width="compactImageSize" :height="compactImageSize" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="120" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column label="出库类型" width="110" align="center" header-align="center">
          <template #default="{ row }">{{ row.outboundType === 'order_auto' ? '订单自动出库' : '手动出库' }}</template>
        </el-table-column>
        <el-table-column label="出库数量" width="100" align="center" header-align="center">
          <template #default="{ row }">
            <AccessoryQtyCell :value="Number(row.quantity) || 0" :detail="row.sizeOutbound ?? null" />
          </template>
        </el-table-column>
        <el-table-column prop="beforeQuantity" label="出库前库存" width="110" align="center" header-align="center" />
        <el-table-column prop="afterQuantity" label="出库后库存" width="110" align="center" header-align="center" />
        <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" header-align="center" />
      </el-table>
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="totalQuantity"
      summary-label="出库数量"
      @current-change="load"
      @size-change="onPageSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getAccessoryOutboundRecords, type AccessoryOutboundRecord } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getFilterRangeStyle,
  getTextFilterStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import AppImageThumb from '@/components/AppImageThumb.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import AccessoryQtyCell from '@/components/inventory/AccessoryQtyCell.vue'

const outboundFilter = reactive<{ orderNo: string; outboundType: string; dateRange: [string, string] | [] }>({
  orderNo: '',
  outboundType: '',
  dateRange: [],
})
const outboundList = ref<AccessoryOutboundRecord[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const tableRef = ref()
const shellRef = ref<HTMLElement | null>(null)

const { compactHeaderCellStyle, compactCellStyle, compactRowStyle, compactImageSize, compactImageColumnMinWidth } = useCompactTableStyle()
const { tableHeight } = useFlexShellTableHeight(shellRef)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('inventory-accessories-outbounds')

const totalQuantity = computed(() => outboundList.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))

async function load() {
  loading.value = true
  try {
    const res = await getAccessoryOutboundRecords({
      orderNo: outboundFilter.orderNo || undefined,
      outboundType: outboundFilter.outboundType || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    outboundList.value = data?.list ?? []
    pagination.total = data?.total ?? 0
    restoreColumnWidths(tableRef.value)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  load()
}

function onReset() {
  outboundFilter.orderNo = ''
  outboundFilter.outboundType = ''
  outboundFilter.dateRange = []
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

onMounted(load)
</script>
