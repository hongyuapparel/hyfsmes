<template>
  <div class="page-card inventory-finished-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="filter-bar">
          <el-input
            v-model="filter.orderNo"
            placeholder="订单号"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
            :input-style="getFilterInputStyle(filter.orderNo)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.orderNo && orderNoLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                订单号：
              </span>
            </template>
          </el-input>
          <el-input
            v-model="filter.skuCode"
            placeholder="SKU"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
            :input-style="getFilterInputStyle(filter.skuCode)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.skuCode && skuCodeLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                SKU：
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
          <el-select
            v-model="filter.inventoryTypeId"
            placeholder="库存类型"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
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
            <el-button type="primary" size="large" @click="openCreateDialog">新增库存</el-button>
            <el-button
              v-if="hasPendingSelection"
              type="primary"
              size="large"
              :loading="inboundLoading"
              @click="openInboundDialog"
            >
              入库
            </el-button>
            <el-button
              v-if="hasStoredSelection"
              type="warning"
              size="large"
              :loading="outboundDialog.submitting"
              @click="openOutboundDialog"
            >
              出库
            </el-button>
          </div>
        </div>

        <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

        <el-table
          ref="finishedStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="finished-table"
          @header-dragend="onFinishedStockHeaderDragEnd"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" align="center" />
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="图片" width="90" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="90" align="center" header-align="center">
            <template #default="{ row }">
              <el-tooltip
                placement="top"
                effect="light"
                :show-after="250"
                :hide-after="0"
                :disabled="!qtyTooltipEnabled(row)"
                popper-class="finished-qty-popper"
                @show="onQtyTooltipShow(row)"
              >
                <template #content>
                  <div class="qty-tooltip">
                    <template v-if="row.orderId && !row.sizeBreakdown?.headers?.length && colorSizeCache[row.orderId]?.loading">
                      <div class="qty-tooltip-loading">加载中...</div>
                    </template>
                    <template v-else-if="row.orderId && !row.sizeBreakdown?.headers?.length && colorSizeCache[row.orderId]?.error">
                      <div class="qty-tooltip-error">明细加载失败</div>
                    </template>
                    <template v-else>
                      <div v-if="getPreviewHeaders(row).length === 0 || getPreviewRows(row).length === 0" class="qty-tooltip-empty">
                        暂无明细
                      </div>
                      <div v-else class="qty-tooltip-grid">
                        <div class="qty-tooltip-row qty-tooltip-head">
                          <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                          <div
                            v-for="(h, idx) in getPreviewHeaders(row)"
                            :key="idx"
                            class="qty-tooltip-cell"
                          >
                            {{ h }}
                          </div>
                        </div>
                        <div
                          v-for="(r, rIdx) in getPreviewRows(row)"
                          :key="rIdx"
                          class="qty-tooltip-row"
                        >
                          <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                          <div
                            v-for="(v, vIdx) in r.values"
                            :key="vIdx"
                            class="qty-tooltip-cell qty-tooltip-num"
                          >
                            {{ formatDisplayNumber(v) }}
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
                <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="出厂价" width="100" align="center" header-align="center">
            <template #default="{ row }">
              {{ formatPrice(row.unitPrice) }}
            </template>
          </el-table-column>
          <el-table-column label="总价" width="100" align="center" header-align="center">
            <template #default="{ row }">
              {{ formatTotalPrice(row.quantity, row.unitPrice) }}
            </template>
          </el-table-column>
          <el-table-column prop="department" label="部门" min-width="90" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="库存类型" min-width="100" show-overflow-tooltip align="center" header-align="center">
            <template #default="{ row }">
              {{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="仓库" min-width="90" show-overflow-tooltip align="center" header-align="center">
            <template #default="{ row }">
              {{ findWarehouseLabelById(row.warehouseId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="location" label="存放地址" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="入库时间" width="160" align="center" header-align="center" />
          <el-table-column prop="orderNo" label="订单号" min-width="110" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="操作" width="88" align="center" header-align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap pagination-wrap--with-summary">
          <div class="pagination-summary">总件数：{{ stockListFooterQuantity }} 件</div>
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
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="filter-bar">
          <el-input v-model="outboundFilter.orderNo" placeholder="订单号" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-input v-model="outboundFilter.skuCode" placeholder="SKU" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-select v-model="outboundFilter.customerName" placeholder="客户" filterable clearable size="large" class="filter-bar-item" @change="onOutboundSearch(true)">
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            range-separator=""
            start-placeholder="出库时间"
            end-placeholder=""
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            unlink-panels
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

        <el-table
          ref="finishedOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="finished-table"
          @header-dragend="onFinishedOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="出库时间" width="160" align="center">
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column label="出库数量" width="90" align="right">
            <template #default="{ row }">
              <el-tooltip
                v-if="row.sizeBreakdown?.headers?.length && row.sizeBreakdown?.rows?.length"
                placement="top"
                effect="light"
                popper-class="finished-qty-popper"
              >
                <template #content>
                  <div class="qty-tooltip">
                    <div class="qty-tooltip-grid">
                      <div class="qty-tooltip-row qty-tooltip-head">
                        <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                        <div v-for="(h, idx) in row.sizeBreakdown.headers" :key="idx" class="qty-tooltip-cell">
                          {{ h }}
                        </div>
                      </div>
                      <div v-for="(r, rIdx) in row.sizeBreakdown.rows" :key="rIdx" class="qty-tooltip-row">
                        <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                        <div v-for="(v, vIdx) in r.quantities" :key="vIdx" class="qty-tooltip-cell qty-tooltip-num">
                          {{ v }}
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
              </el-tooltip>
              <span v-else>{{ formatDisplayNumber(row.quantity) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="department" label="部门" min-width="90" show-overflow-tooltip />
          <el-table-column label="库存类型" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="仓库" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">
              {{ findWarehouseLabelById(row.warehouseId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="pickupUserName" label="领取人" width="120" show-overflow-tooltip />
          <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip />
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        </el-table>

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
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="inboundDialog.visible"
      title="入库（填写货物存放地址）"
      width="440"
      destroy-on-close
      @close="resetInboundForm"
    >
      <el-form
        ref="inboundFormRef"
        :model="inboundForm"
        :rules="inboundRules"
        label-width="100px"
      >
        <el-form-item label="仓库" prop="warehouseId">
          <el-select
            v-model="inboundForm.warehouseId"
            placeholder="请选择仓库"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in warehouseOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库存类型" prop="inventoryTypeId">
          <el-select
            v-model="inboundForm.inventoryTypeId"
            placeholder="请选择库存类型"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="department">
          <el-select
            v-model="inboundForm.department"
            placeholder="请选择部门"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in departmentOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="存放地址" prop="location">
          <el-input v-model="inboundForm.location" placeholder="请输入货物存放地址" clearable />
        </el-form-item>
        <el-form-item label="图片" prop="imageUrl">
          <ImageUploadArea v-model="inboundForm.imageUrl" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="inboundDialog.submitting" @click="submitInbound">
          确定入库
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="outboundDialog.visible"
      title="出库"
      width="860"
      destroy-on-close
      @close="resetOutboundForm"
    >
      <el-form
        ref="outboundFormRef"
        :model="outboundForm"
        :rules="outboundRules"
        label-width="80px"
      >
        <el-form-item label="领取人" prop="pickupUserId">
          <el-select
            v-model="outboundForm.pickupUserId"
            placeholder="请选择业务员"
            filterable
            clearable
            style="width: 260px"
          >
            <el-option
              v-for="opt in pickupUserOptions"
              :key="opt.id"
              :label="opt.displayName || opt.username"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <div class="outbound-batch-head">
          <span>客户：{{ outboundSelectedCustomer }}</span>
          <span>选中记录：{{ outboundDialog.items.length }}</span>
          <span>出库总数：{{ outboundGrandTotal }}</span>
        </div>
        <div class="outbound-batch-list">
          <div
            v-for="item in outboundDialog.items"
            :key="item.row.id"
            class="outbound-batch-card"
          >
            <div class="outbound-card-meta">
              <div>订单号：{{ item.row.orderNo }}</div>
              <div>SKU：{{ item.row.skuCode }}</div>
              <div>客户：{{ item.row.customerName || '-' }}</div>
              <div>当前库存：{{ formatDisplayNumber(item.row.quantity) }}</div>
            </div>
            <div v-if="item.headers.length" class="outbound-size-wrap">
              <el-table :data="item.rows" border size="small">
                <el-table-column label="颜色" min-width="100">
                  <template #default="{ row }">
                    {{ row.colorName || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-for="(h, hIdx) in item.headers"
                  :key="hIdx"
                  :label="h"
                  min-width="80"
                  align="right"
                >
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.quantities[hIdx]"
                      :min="0"
                      :precision="0"
                      controls-position="right"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                </el-table-column>
              </el-table>
              <div class="outbound-size-footer">该记录合计：{{ getOutboundItemTotal(item) }}</div>
            </div>
            <div v-else class="detail-muted">该记录暂无颜色尺码明细，无法按明细出库。</div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="outboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="outboundDialog.submitting" @click="submitOutbound">
          确定出库
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="createDialog.visible"
      title="新增库存"
      width="960"
      destroy-on-close
      @close="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="90px"
        class="create-form-grid"
      >
        <div class="create-sections">
          <div class="detail-section">
            <div class="detail-section-title">基础信息与产品图</div>
            <div class="detail-basic-main">
              <div class="detail-basic-grid">
                <div class="detail-basic-label">订单号</div>
                <div class="detail-basic-value">
                  <el-input v-model="createForm.orderNo" placeholder="选填，不填则不关联订单" clearable size="small" />
                </div>
                <div class="detail-basic-label">SKU</div>
                <div class="detail-basic-value">
                  <el-input v-model="createForm.skuCode" placeholder="选择 SKU" clearable size="small">
                    <template #suffix>
                      <el-button
                        link
                        type="primary"
                        size="small"
                        @click.stop="openCreateSkuDialog"
                      >
                        选择
                      </el-button>
                    </template>
                  </el-input>
                </div>

                <div class="detail-basic-label">部门</div>
                <div class="detail-basic-value">
                  <el-select
                    v-model="createForm.department"
                    placeholder="请选择部门"
                    filterable
                    clearable
                    size="small"
                  >
                    <el-option
                      v-for="opt in departmentOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </div>
                <div class="detail-basic-label">库存类型</div>
                <div class="detail-basic-value">
                  <el-select
                    v-model="createForm.inventoryTypeId"
                    placeholder="请选择库存类型"
                    filterable
                    clearable
                    size="small"
                  >
                    <el-option
                      v-for="opt in inventoryTypeOptions"
                      :key="opt.id"
                      :label="opt.label"
                      :value="opt.id"
                    />
                  </el-select>
                </div>
                <div class="detail-basic-label">仓库</div>
                <div class="detail-basic-value">
                  <el-select
                    v-model="createForm.warehouseId"
                    placeholder="请选择仓库"
                    filterable
                    clearable
                    size="small"
                  >
                    <el-option
                      v-for="opt in warehouseOptions"
                      :key="opt.id"
                      :label="opt.label"
                      :value="opt.id"
                    />
                  </el-select>
                </div>

                <div class="detail-basic-label">存放地址</div>
                <div class="detail-basic-value">
                  <el-input v-model="createForm.location" placeholder="请输入具体存放地址" clearable size="small" />
                </div>

                <div class="detail-basic-label">备注</div>
                <div class="detail-basic-value detail-basic-value-span-3">
                  <el-input v-model="createForm.remark" placeholder="选填" clearable size="small" />
                </div>

              </div>
              <div class="detail-product-image-panel">
                <div class="detail-image-label">产品图</div>
                <ImageUploadArea v-model="createForm.imageUrl" compact />
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-head">
              <div class="detail-section-title">颜色图片与码数明细</div>
              <div class="detail-head-actions">
                <el-button type="primary" link size="small" @click="addCreateColorRow">+ 新增颜色</el-button>
                <el-button type="primary" link size="small" @click="addCreateSizeColumn">+ 新增尺码列</el-button>
              </div>
            </div>
            <div class="create-size-table-wrap">
              <el-table
                :data="createSizeTableRows"
                border
                size="small"
                class="create-size-table detail-color-size-table"
                show-summary
                :summary-method="getCreateColorSizeSummary"
              >
                <el-table-column label="颜色" width="88" align="center" header-align="center">
                  <template #default="{ row }">
                    <el-input v-model="row.colorName" placeholder="颜色" clearable size="small" />
                  </template>
                </el-table-column>
                <el-table-column label="颜色图片" width="122" align="center" header-align="center">
                  <template #default="{ row }">
                    <ImageUploadArea v-model="row.imageUrl" compact />
                  </template>
                </el-table-column>
                <el-table-column
                  v-for="(size, idx) in createSizeHeaders"
                  :key="`create-size-${idx}`"
                  min-width="64"
                  align="center"
                  header-align="center"
                >
                  <template #header>
                    <div class="b-header-cell">
                      <el-input
                        v-model="createSizeHeaders[idx]"
                        size="small"
                        class="b-header-input"
                        :input-style="{ textAlign: 'center' }"
                      />
                      <el-button
                        v-if="createSizeHeaders.length > 1"
                        link
                        type="danger"
                        size="small"
                        class="b-header-remove"
                        @click.stop="removeCreateSizeColumn(idx)"
                      >
                        <el-icon><Close /></el-icon>
                      </el-button>
                    </div>
                  </template>
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.quantities[idx]"
                      :min="0"
                      :precision="0"
                      :controls="false"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="合计" width="72" align="center" header-align="center">
                  <template #default="{ row }">{{ sumDetailRowQty(row.quantities) }}</template>
                </el-table-column>
                <el-table-column label="出厂价" width="88" align="center" header-align="center">
                  <template #default>
                    <el-input
                      v-model="createForm.unitPrice"
                      placeholder="请输入"
                      clearable
                      size="small"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="总价" width="120" align="center" header-align="center">
                  <template #default="{ row }">{{ createRowTotalPrice(row.quantities) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="48" align="center" header-align="center">
                  <template #default="{ $index }">
                    <el-button
                      v-if="createSizeTableRows.length > 1"
                      type="danger"
                      link
                      size="small"
                      class="create-row-remove-btn"
                      @click="removeCreateColorRow($index)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="createDialog.submitting" @click="submitCreate">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="createSkuDialogVisible"
      title="选择 SKU"
      width="760px"
      destroy-on-close
    >
      <el-input
        v-model="createSkuKeyword"
        placeholder="输入 SKU 或客户搜索"
        clearable
        style="max-width: 320px; margin-bottom: 10px"
      />
      <el-table
        v-loading="createSkuDialogLoading"
        :data="filteredCreateSkuProducts"
        border
        stripe
        height="420"
      >
        <el-table-column label="图片" width="90" align="center">
          <template #default="{ row }">
            <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
            <span v-else class="text-placeholder">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="skuCode" label="SKU 编号" min-width="160" />
        <el-table-column label="客户" min-width="180">
          <template #default="{ row }">
            {{ row.customer?.companyName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="productGroup" label="产品分组" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="90" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onSelectCreateSku(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="createSkuDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailDrawer.visible"
      title="库存详情"
      :size="`${detailDrawerWidth}px`"
      destroy-on-close
      :with-header="true"
      class="finished-detail-drawer"
    >
      <div class="detail-drawer-resizer" title="拖拽调整宽度" @mousedown="startResizeDetailDrawer" />
      <div v-loading="detailDrawer.loading" class="detail-wrap">
        <div v-if="detailDrawer.data" class="detail-sections">
          <div class="detail-top-row">
            <div class="detail-section">
              <div class="detail-section-head">
                <div class="detail-section-title">基础信息与产品图</div>
                <div class="detail-head-actions">
                  <el-button
                    v-if="!detailMetaEditing"
                    size="small"
                    text
                    type="primary"
                    class="detail-head-btn"
                    @click="toggleDetailEditMode"
                  >
                    <el-icon><Edit /></el-icon>
                    <span>编辑</span>
                  </el-button>
                  <template v-else>
                    <el-button
                      size="small"
                      type="success"
                      class="detail-head-btn"
                      :loading="detailDrawer.saving"
                      @click="saveDetailMeta"
                    >
                      保存
                    </el-button>
                    <el-button
                      size="small"
                      class="detail-head-btn"
                      @click="toggleDetailEditMode"
                    >
                      取消
                    </el-button>
                  </template>
                </div>
              </div>
              <div class="detail-basic-main">
                <div class="detail-basic-grid">
                  <div class="detail-basic-label">入库时间</div>
                  <div class="detail-basic-value">{{ formatDateTime(detailDrawer.data.stock.createdAt) }}</div>
                  <div class="detail-basic-label">订单号</div>
                  <div class="detail-basic-value">{{ detailDrawer.data.orderNo || '-' }}</div>

                  <div class="detail-basic-label">SKU</div>
                  <div class="detail-basic-value">{{ detailDrawer.data.stock.skuCode }}</div>
                  <div class="detail-basic-label">客户</div>
                  <div class="detail-basic-value">{{ detailDrawer.data.stock.customerName || '-' }}</div>

                  <div class="detail-basic-label">库存类型</div>
                  <div class="detail-basic-value">
                    <el-select
                      v-if="detailMetaEditing"
                      v-model="detailEditForm.inventoryTypeId"
                      filterable
                      clearable
                      size="small"
                    >
                      <el-option v-for="opt in inventoryTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
                    </el-select>
                    <span v-else>{{ findInventoryTypeLabelById(detailDrawer.data.stock.inventoryTypeId) || '-' }}</span>
                  </div>

                  <div class="detail-basic-label">仓库</div>
                  <div class="detail-basic-value">
                    <el-select
                      v-if="detailMetaEditing"
                      v-model="detailEditForm.warehouseId"
                      filterable
                      clearable
                      size="small"
                    >
                      <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
                    </el-select>
                    <span v-else>{{ findWarehouseLabelById(detailDrawer.data.stock.warehouseId) || '-' }}</span>
                  </div>
                  <div class="detail-basic-label">部门</div>
                  <div class="detail-basic-value">
                    <el-select
                      v-if="detailMetaEditing"
                      v-model="detailEditForm.department"
                      filterable
                      clearable
                      size="small"
                    >
                      <el-option v-for="opt in departmentOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                    <span v-else>{{ detailDrawer.data.stock.department || '-' }}</span>
                  </div>

                  <div class="detail-basic-label">存放地址</div>
                  <div class="detail-basic-value">
                    <el-input
                      v-if="detailMetaEditing"
                      v-model="detailEditForm.location"
                      clearable
                      size="small"
                    />
                    <span v-else>{{ detailDrawer.data.stock.location || '-' }}</span>
                  </div>

                  <div class="detail-basic-label">备注</div>
                  <div class="detail-basic-value detail-basic-value-span-3">
                    <el-input
                      v-if="detailMetaEditing"
                      v-model="detailEditForm.remark"
                      clearable
                      size="small"
                      placeholder="选填"
                    />
                    <span v-else>{{ detailEditForm.remark || '-' }}</span>
                  </div>
                </div>
                <div class="detail-product-image-panel">
                  <div class="detail-image-label">产品图（可更换）</div>
                  <ImageUploadArea
                    v-if="detailMetaEditing"
                    compact
                    :model-value="getDisplayProductImage()"
                    @update:model-value="saveProductImage"
                  />
                  <AppImageThumb
                    v-else-if="getDisplayProductImage()"
                    :raw-url="getDisplayProductImage()!"
                    :width="160"
                    :height="120"
                  />
                  <div v-else class="detail-image-empty">-</div>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">颜色图片与码数明细</div>
            <div
              v-if="detailDrawer.data.colorSize.headers.length && detailDisplayColorSizeRows.length"
              class="detail-color-size-table-wrap"
            >
              <el-table
                :data="detailDisplayColorSizeRows"
                border
                size="small"
                class="detail-color-size-table"
                show-summary
                :summary-method="getDetailColorSizeSummary"
              >
                <el-table-column label="颜色" width="88" align="center" header-align="center">
                  <template #default="{ row }">
                    {{ row.colorName || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="颜色图片" width="122" align="center" header-align="center">
                  <template #default="{ row }">
                    <ImageUploadArea
                      v-if="detailMetaEditing"
                      class="detail-color-image-editor"
                      compact
                      :model-value="getColorImageUrl(row.colorName)"
                      @update:model-value="(url) => saveColorImage(row.colorName, url)"
                    />
                    <AppImageThumb
                      v-else-if="getColorImageUrl(row.colorName)"
                      :raw-url="getColorImageUrl(row.colorName)!"
                      variant="table"
                    />
                    <span v-else class="text-placeholder">-</span>
                  </template>
                </el-table-column>
                <el-table-column
                  v-for="(size, sizeIdx) in detailDrawer.data.colorSize.headers"
                  :key="`size-${sizeIdx}`"
                  :label="size"
                  min-width="64"
                  align="center"
                  header-align="center"
                >
                  <template #default="{ row }">
                    {{ Number(row.quantities?.[sizeIdx] ?? 0) || 0 }}
                  </template>
                </el-table-column>
                <el-table-column label="合计" width="72" align="center" header-align="center">
                  <template #default="{ row }">
                    {{ sumDetailRowQty(row.quantities) }}
                  </template>
                </el-table-column>
                <el-table-column label="出厂价" width="88" align="center" header-align="center">
                  <template #default>
                    {{ detailTableUnitPrice }}
                  </template>
                </el-table-column>
                <el-table-column label="总价" width="120" align="center" header-align="center">
                  <template #default="{ row }">
                    {{ detailRowTotalPrice(row.quantities) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="detail-muted">暂无颜色尺码明细（未关联订单或订单未维护颜色尺码）。</div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">操作记录</div>
            <div v-if="detailDrawer.data.adjustLogs.length" class="detail-logs">
              <div v-for="log in detailDrawer.data.adjustLogs" :key="log.id" class="detail-log-item">
                <div class="detail-log-head">
                  <span class="detail-log-user">{{ log.operatorUsername || '-' }}</span>
                  <span class="detail-log-time">{{ log.createdAt }}</span>
                </div>
                <div class="detail-log-body">
                  <div class="detail-log-line">前：{{ formatMetaSnapshot(log.before) }}</div>
                  <div class="detail-log-line">后：{{ formatMetaSnapshot(log.after) }}</div>
                  <div v-if="log.remark" class="detail-log-remark">备注：{{ log.remark }}</div>
                </div>
              </div>
            </div>
            <div v-else class="detail-muted">暂无操作记录</div>
          </div>
        </div>
        <div v-else class="detail-muted">暂无数据</div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Edit, Close, Delete } from '@element-plus/icons-vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  getFinishedStockList,
  doPendingInbound,
  finishedOutbound,
  getFinishedPickupUserOptions,
  createFinishedStock,
  getFinishedOutboundRecords,
  getFinishedStockDetail,
  updateFinishedStockMeta,
  upsertFinishedStockColorImage,
  type FinishedStockRow,
  type FinishedOutboundRecord,
  type FinishedPickupUserOption,
} from '@/api/inventory'
import { getProducts, type ProductItem } from '@/api/products'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getCustomers, type CustomerItem } from '@/api/customers'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

const pageTab = ref<'stock' | 'outbounds'>('stock')
const currentTab = ref<string>('stored')
const filter = reactive<{
  orderNo: string
  skuCode: string
  customerName: string
  inventoryTypeId: number | null
}>({ orderNo: '', skuCode: '', customerName: '', inventoryTypeId: null })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const inboundDateRange = ref<[string, string] | null>(null)
const list = ref<FinishedStockRow[]>([])
const finishedStockTableRef = ref()
const finishedOutboundTableRef = ref()
const customerOptions = ref<{ label: string; value: string }[]>([])
const createSkuDialogVisible = ref(false)
const createSkuDialogLoading = ref(false)
const createSkuKeyword = ref('')
const createSkuProducts = ref<ProductItem[]>([])
const warehouseOptions = ref<{ id: number; label: string }[]>([])
const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
const departmentOptions = ref<{ value: string; label: string }[]>([])
const loading = ref(false)
const inboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
/** 当前筛选下全量匹配的总件数（接口返回）；有表格勾选时底部改为已选行的件数合计 */
const stockTotalQuantity = ref(0)
const selectedRows = ref<FinishedStockRow[]>([])

const stockListFooterQuantity = computed(() => {
  if (selectedRows.value.length > 0) {
    return selectedRows.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  }
  return stockTotalQuantity.value
})

const detailDrawer = reactive<{
  visible: boolean
  loading: boolean
  saving: boolean
  stockId: number | null
  data: any | null
  colorImageMap: Record<string, string>
}>({
  visible: false,
  loading: false,
  saving: false,
  stockId: null,
  data: null,
  colorImageMap: {},
})
const DETAIL_DRAWER_MIN_WIDTH = 760
const DETAIL_DRAWER_DEFAULT_WIDTH = 900
const DETAIL_DRAWER_MAX_MARGIN = 48
const DETAIL_DRAWER_WIDTH_STORAGE_KEY = 'inventory_finished_detail_drawer_width'
const detailDrawerWidth = ref(DETAIL_DRAWER_DEFAULT_WIDTH)
const resizeRafId = ref<number | null>(null)
const resizeMoveHandler = ref<((evt: MouseEvent) => void) | null>(null)
const resizeUpHandler = ref<(() => void) | null>(null)
const detailMetaEditing = ref(false)

const detailEditForm = reactive<{
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
  remark: string
}>({
  department: '',
  inventoryTypeId: null,
  warehouseId: null,
  location: '',
  remark: '',
})

function formatMetaSnapshot(v: any): string {
  if (!v) return '-'
  const dep = v.department ?? ''
  const it = v.inventoryTypeId != null ? findInventoryTypeLabelById(v.inventoryTypeId) : ''
  const wh = v.warehouseId != null ? findWarehouseLabelById(v.warehouseId) : ''
  const loc = v.location ?? ''
  const qty = v.quantity != null && v.quantity !== '' ? `数量 ${v.quantity}` : ''
  const up = v.unitPrice != null && v.unitPrice !== '' ? `出厂价 ${formatPrice(String(v.unitPrice))}` : ''
  return [dep, it, wh, loc, qty, up].filter((x) => x).join(' / ') || '-'
}

function getColorImageUrl(colorName: string): string {
  return detailDrawer.colorImageMap[colorName] || ''
}

function getDisplayProductImage(): string {
  return detailDrawer.data?.stock?.imageUrl || detailDrawer.data?.productImageUrl || ''
}

function getDetailDrawerMaxWidth() {
  return Math.max(DETAIL_DRAWER_MIN_WIDTH, window.innerWidth - DETAIL_DRAWER_MAX_MARGIN)
}

function clampDetailDrawerWidth(width: number) {
  return Math.min(Math.max(width, DETAIL_DRAWER_MIN_WIDTH), getDetailDrawerMaxWidth())
}

function loadSavedDetailDrawerWidth() {
  try {
    const raw = window.localStorage.getItem(DETAIL_DRAWER_WIDTH_STORAGE_KEY)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return DETAIL_DRAWER_DEFAULT_WIDTH
    return clampDetailDrawerWidth(parsed)
  } catch {
    return DETAIL_DRAWER_DEFAULT_WIDTH
  }
}

function persistDetailDrawerWidth(width: number) {
  try {
    window.localStorage.setItem(DETAIL_DRAWER_WIDTH_STORAGE_KEY, String(clampDetailDrawerWidth(width)))
  } catch {
    // 忽略本地存储异常，不影响主流程
  }
}

function setDetailDrawerResizing(active: boolean) {
  document.body.classList.toggle('detail-drawer-resizing', active)
}

function stopResizeDetailDrawer() {
  if (resizeMoveHandler.value) {
    window.removeEventListener('mousemove', resizeMoveHandler.value)
    resizeMoveHandler.value = null
  }
  if (resizeUpHandler.value) {
    window.removeEventListener('mouseup', resizeUpHandler.value)
    resizeUpHandler.value = null
  }
  if (resizeRafId.value != null) {
    window.cancelAnimationFrame(resizeRafId.value)
    resizeRafId.value = null
  }
  setDetailDrawerResizing(false)
}

function startResizeDetailDrawer(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = detailDrawerWidth.value
  let latestX = startX
  const onMouseMove = (evt: MouseEvent) => {
    latestX = evt.clientX
    if (resizeRafId.value != null) return
    resizeRafId.value = window.requestAnimationFrame(() => {
      resizeRafId.value = null
      // 右侧抽屉：向左拖动变宽，向右拖动变窄
      const delta = startX - latestX
      detailDrawerWidth.value = clampDetailDrawerWidth(startWidth + delta)
    })
  }
  const onMouseUp = () => {
    stopResizeDetailDrawer()
    persistDetailDrawerWidth(detailDrawerWidth.value)
  }
  stopResizeDetailDrawer()
  resizeMoveHandler.value = onMouseMove
  resizeUpHandler.value = onMouseUp
  setDetailDrawerResizing(true)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

async function saveProductImage(url: string) {
  if (!detailDrawer.stockId) return
  try {
    await updateFinishedStockMeta(detailDrawer.stockId, { imageUrl: (url ?? '').trim() })
    if (detailDrawer.data?.stock) detailDrawer.data.stock.imageUrl = (url ?? '').trim()
    ElMessage.success('产品图已更新')
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function sumDetailRowQty(quantities: unknown[]): number {
  if (!Array.isArray(quantities)) return 0
  return quantities.reduce<number>((sum, q) => sum + (Number(q) || 0), 0)
}

const detailDisplayColorSizeRows = computed(() => {
  const data = detailDrawer.data as any
  const headers: string[] = Array.isArray(data?.colorSize?.headers) ? data.colorSize.headers : []
  const rows: Array<{ colorName: string; quantities: number[] }> = Array.isArray(data?.colorSize?.rows)
    ? data.colorSize.rows
    : []
  const stockQty = Math.max(0, Math.trunc(Number(data?.stock?.quantity) || 0))
  if (!headers.length || !rows.length) return []

  const orderTotal = rows.reduce(
    (sum, r) => sum + (Array.isArray(r.quantities) ? r.quantities.reduce((s, q) => s + (Number(q) || 0), 0) : 0),
    0,
  )
  if (orderTotal === stockQty) return rows

  const weights: number[] = []
  rows.forEach((r) => {
    for (let i = 0; i < headers.length; i += 1) {
      weights.push(Math.max(0, Number(r.quantities?.[i]) || 0))
    }
  })
  const allocated = allocateByWeight(weights, stockQty)
  let cursor = 0
  return rows.map((r) => {
    const quantities: number[] = []
    for (let i = 0; i < headers.length; i += 1) {
      quantities.push(allocated[cursor] ?? 0)
      cursor += 1
    }
    return {
      colorName: r.colorName,
      quantities,
    }
  })
})

const detailTableTotalQty = computed(() =>
  detailDisplayColorSizeRows.value.reduce((sum, row) => sum + sumDetailRowQty(row.quantities), 0),
)

const detailTableUnitPrice = computed(() => formatPrice(detailDrawer.data?.stock?.unitPrice))

const detailTableTotalPrice = computed(() =>
  formatTotalPrice(detailTableTotalQty.value, detailDrawer.data?.stock?.unitPrice),
)

function detailRowTotalPrice(quantities: unknown[]): string {
  return formatTotalPrice(sumDetailRowQty(quantities), detailDrawer.data?.stock?.unitPrice)
}

function getDetailColorSizeSummary({ columns }: { columns: Array<{ label?: string }> }) {
  const headersLen = Array.isArray(detailDrawer.data?.colorSize?.headers) ? detailDrawer.data.colorSize.headers.length : 0
  const sumQtyColIndex = 2 + headersLen
  const unitPriceColIndex = 3 + headersLen
  const totalPriceColIndex = 4 + headersLen
  return columns.map((_, index) => {
    if (index === 0) return '汇总'
    if (index === sumQtyColIndex) return String(detailTableTotalQty.value)
    if (index === unitPriceColIndex) return detailTableUnitPrice.value
    if (index === totalPriceColIndex) return detailTableTotalPrice.value
    return ''
  })
}

/** 有订单可走接口拉明细，或手动入库带了 sizeBreakdown（列表快照） */
function qtyTooltipEnabled(row: FinishedStockRow): boolean {
  if (row.sizeBreakdown?.headers?.length && row.sizeBreakdown.rows?.length) return true
  return !!row.orderId
}

function onQtyTooltipShow(row: FinishedStockRow) {
  if (row.sizeBreakdown?.headers?.length && row.sizeBreakdown.rows?.length) return
  if (row.orderId) void ensureColorSizeBreakdown(row.orderId)
}

function allocateByWeight(weights: number[], total: number): number[] {
  const safeTotal = Math.max(0, Math.trunc(Number(total) || 0))
  if (!weights.length) return []
  const sumWeight = weights.reduce((s, w) => s + Math.max(0, Number(w) || 0), 0)
  if (safeTotal <= 0) return weights.map(() => 0)
  if (sumWeight <= 0) {
    const arr = weights.map(() => 0)
    arr[0] = safeTotal
    return arr
  }
  const exact = weights.map((w) => (Math.max(0, Number(w) || 0) * safeTotal) / sumWeight)
  const base = exact.map((v) => Math.floor(v))
  let remain = safeTotal - base.reduce((s, n) => s + n, 0)
  const order = exact
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  let i = 0
  while (remain > 0 && order.length > 0) {
    base[order[i % order.length].idx] += 1
    remain -= 1
    i += 1
  }
  return base
}

/**
 * 将颜色×尺码格按权重缩放到 targetQty（与当前库存 row.quantity 对齐）。
 * 支持表头末列为「合计」时仅对尺码列分摊，末列写每行小计。
 */
function scaleColorSizeRowsToQuantity(
  headers: string[],
  rows: Array<{ colorName?: string; values?: number[] }>,
  targetQty: number,
): Array<{ colorName: string; values: number[] }> {
  if (!headers.length || !rows.length) return []
  const hasTotalCol = headers[headers.length - 1] === '合计'
  const sizeColCount = hasTotalCol ? Math.max(0, headers.length - 1) : headers.length
  if (sizeColCount <= 0) return []
  const weights: number[] = []
  rows.forEach((r) => {
    for (let i = 0; i < sizeColCount; i += 1) {
      weights.push(Math.max(0, Number(r.values?.[i]) || 0))
    }
  })
  const weightSum = weights.reduce((s, n) => s + n, 0)
  const safeTarget = Math.max(0, Math.trunc(Number(targetQty) || 0))
  if (weightSum <= 0) {
    return rows.map((r) => ({
      colorName: String(r.colorName ?? ''),
      values: hasTotalCol ? [...Array(sizeColCount).fill(0), 0] : Array(sizeColCount).fill(0),
    }))
  }
  const allocated = weightSum === safeTarget ? [...weights] : allocateByWeight(weights, safeTarget)
  let cursor = 0
  return rows.map((r) => {
    const sizeValues: number[] = []
    for (let i = 0; i < sizeColCount; i += 1) {
      sizeValues.push(allocated[cursor] ?? 0)
      cursor += 1
    }
    const rowTotal = sizeValues.reduce((s, n) => s + n, 0)
    return {
      colorName: String(r.colorName ?? ''),
      values: hasTotalCol ? [...sizeValues, rowTotal] : sizeValues,
    }
  })
}

/** 出库弹窗：用手动快照初始化各尺码出库数，与列表悬停同一套「按当前库存缩放」逻辑 */
function initOutboundRowsFromStockSnapshot(
  row: FinishedStockRow,
  headers: string[],
): Array<{ colorName: string; quantities: number[] }> {
  const snap = row.sizeBreakdown
  if (!snap?.rows?.length || !headers.length) return []
  const cacheLikeRows = snap.rows.map((r) => ({
    colorName: r.colorName,
    values: Array.isArray(r.values) ? [...r.values] : [],
  }))
  const scaled = scaleColorSizeRowsToQuantity(headers, cacheLikeRows, row.quantity)
  return scaled.map((r) => ({ colorName: r.colorName, quantities: [...r.values] }))
}

function buildOutboundDialogItem(row: FinishedStockRow): FinishedOutboundDialogItem {
  const snap = row.sizeBreakdown
  if (snap?.headers?.length && snap.rows?.length) {
    const headers = snap.headers.filter((h) => h !== '合计')
    const rows = initOutboundRowsFromStockSnapshot(row, headers)
    return { row, headers, rows }
  }
  const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
  const headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
  return {
    row,
    headers,
    rows: (breakdown?.rows ?? []).map((r) => ({
      colorName: r.colorName,
      quantities: headers.map(() => 0),
    })),
  }
}

function outboundRowLabel(item: FinishedOutboundDialogItem): string {
  const no = item.row.orderNo?.trim()
  return no ? `订单 ${no} / ${item.row.skuCode}` : `SKU ${item.row.skuCode}`
}

/** 列表悬停：手动快照表头常无「合计」列，与订单明细一致需在右侧补一列行小计 */
function getSnapshotTooltipHeaders(snap: NonNullable<FinishedStockRow['sizeBreakdown']>): string[] {
  const h = snap.headers
  if (!h.length) return []
  if (h[h.length - 1] === '合计') return [...h]
  return [...h, '合计']
}

function getPreviewHeaders(row: FinishedStockRow): string[] {
  const snap = row.sizeBreakdown
  if (snap?.headers?.length) return getSnapshotTooltipHeaders(snap)
  if (!row.orderId) return []
  return colorSizeCache[row.orderId]?.headers ?? []
}

function getPreviewRows(row: FinishedStockRow) {
  const targetQty = Math.max(0, Math.trunc(Number(row.quantity) || 0))
  const snap = row.sizeBreakdown
  if (snap?.headers?.length && snap.rows?.length) {
    const headers = getSnapshotTooltipHeaders(snap)
    const cacheLikeRows = snap.rows.map((r) => ({
      colorName: r.colorName,
      values: Array.isArray(r.values) ? [...r.values] : [],
    }))
    return scaleColorSizeRowsToQuantity(headers, cacheLikeRows, targetQty)
  }
  if (!row.orderId) return []
  const cache = colorSizeCache[row.orderId]
  if (!cache || cache.loading || cache.error || !cache.headers.length || !cache.rows.length) return []
  return scaleColorSizeRowsToQuantity(cache.headers, cache.rows, targetQty)
}

async function loadDetail(stockId: number) {
  detailDrawer.loading = true
  detailDrawer.saving = false
  detailDrawer.stockId = stockId
  detailDrawer.data = null
  detailDrawer.colorImageMap = {}
  try {
    const res = await getFinishedStockDetail(stockId)
    const data = res.data as any
    detailDrawer.data = data
    detailEditForm.department = data?.stock?.department ?? ''
    detailEditForm.inventoryTypeId = data?.stock?.inventoryTypeId ?? null
    detailEditForm.warehouseId = data?.stock?.warehouseId ?? null
    detailEditForm.location = data?.stock?.location ?? ''
    detailEditForm.remark = ''
    detailMetaEditing.value = false
    const map: Record<string, string> = {}
    ;(data?.colorImages ?? []).forEach((r: any) => {
      if (r?.colorName) map[String(r.colorName)] = String(r.imageUrl ?? '')
    })
    detailDrawer.colorImageMap = map
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    detailDrawer.loading = false
  }
}

function toggleDetailEditMode() {
  if (!detailMetaEditing.value && detailDrawer.data?.stock) {
    detailEditForm.department = detailDrawer.data.stock.department ?? ''
    detailEditForm.inventoryTypeId = detailDrawer.data.stock.inventoryTypeId ?? null
    detailEditForm.warehouseId = detailDrawer.data.stock.warehouseId ?? null
    detailEditForm.location = detailDrawer.data.stock.location ?? ''
    detailEditForm.remark = ''
  }
  detailMetaEditing.value = !detailMetaEditing.value
}

async function openDetail(row: FinishedStockRow) {
  detailDrawerWidth.value = loadSavedDetailDrawerWidth()
  detailDrawer.visible = true
  await loadDetail(row.id)
}

async function saveDetailMeta() {
  if (!detailDrawer.stockId) return
  detailDrawer.saving = true
  try {
    await updateFinishedStockMeta(detailDrawer.stockId, {
      department: detailEditForm.department,
      inventoryTypeId: detailEditForm.inventoryTypeId,
      warehouseId: detailEditForm.warehouseId,
      location: detailEditForm.location,
      remark: detailEditForm.remark || undefined,
    })
    ElMessage.success('保存成功')
    await loadDetail(detailDrawer.stockId)
    await load()
    detailMetaEditing.value = false
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    detailDrawer.saving = false
  }
}

async function saveColorImage(colorName: string, url: string) {
  if (!detailDrawer.stockId) return
  const imageUrl = (url ?? '').trim()
  try {
    await upsertFinishedStockColorImage(detailDrawer.stockId, { colorName, imageUrl })
    if (imageUrl) {
      detailDrawer.colorImageMap[colorName] = imageUrl
      ElMessage.success('已保存图片')
    } else {
      delete detailDrawer.colorImageMap[colorName]
      ElMessage.success('已清除图片')
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

const colorSizeCache = reactive<Record<
  number,
  {
    loading: boolean
    error: boolean
    headers: string[]
    rows: Array<{ colorName: string; values: number[] }>
  }
>>({})

async function ensureColorSizeBreakdown(orderId: number) {
  if (!orderId) return
  const existing = colorSizeCache[orderId]
  if (existing && (existing.loading || existing.headers.length > 0 || existing.error)) return
  colorSizeCache[orderId] = { loading: true, error: false, headers: [], rows: [] }
  try {
    const res = await getOrderColorSizeBreakdown(orderId)
    const data = (res.data ?? { headers: [], rows: [] }) as OrderColorSizeBreakdownRes
    colorSizeCache[orderId] = {
      loading: false,
      error: false,
      headers: Array.isArray(data.headers) ? data.headers : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
    }
  } catch {
    colorSizeCache[orderId] = { loading: false, error: true, headers: [], rows: [] }
  }
}

const outboundFilter = reactive<{
  orderNo: string
  skuCode: string
  customerName: string
  dateRange: [string, string] | []
}>({ orderNo: '', skuCode: '', customerName: '', dateRange: [] })
const outboundList = ref<FinishedOutboundRecord[]>([])
const outboundLoading2 = ref(false)
const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { onHeaderDragEnd: onFinishedStockHeaderDragEnd, restoreColumnWidths: restoreFinishedStockColumnWidths } =
  useTableColumnWidthPersist('inventory-finished-stock')
const { onHeaderDragEnd: onFinishedOutboundHeaderDragEnd, restoreColumnWidths: restoreFinishedOutboundColumnWidths } =
  useTableColumnWidthPersist('inventory-finished-outbounds')

function getInventoryOutboundRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  if (!hasValue) return getFilterRangeStyle(v)
  const w = '240px'
  return { ...getFilterRangeStyle(v), width: w, minWidth: w, flex: `0 0 ${w}` }
}

const pendingRows = computed(() => selectedRows.value.filter((r) => r.type === 'pending'))
const storedRows = computed(() => selectedRows.value.filter((r) => r.type === 'stored'))
const hasPendingSelection = computed(() => pendingRows.value.length > 0)
const hasStoredSelection = computed(() => storedRows.value.length > 0)

const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const inboundFormRef = ref<FormInstance>()
const inboundForm = reactive<{
  warehouseId: number | null
  inventoryTypeId: number | null
  department: string
  location: string
  imageUrl: string
}>({
  warehouseId: null,
  inventoryTypeId: null,
  department: '',
  location: '',
  imageUrl: '',
})
const inboundRules: FormRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  department: [{ required: true, message: '请选择部门', trigger: 'change' }],
  location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
}

type FinishedOutboundDialogItem = {
  row: FinishedStockRow
  headers: string[]
  rows: Array<{ colorName: string; quantities: number[] }>
}

const outboundDialog = reactive<{
  visible: boolean
  submitting: boolean
  items: FinishedOutboundDialogItem[]
}>({ visible: false, submitting: false, items: [] })
const outboundFormRef = ref<FormInstance>()
const outboundForm = reactive({
  pickupUserId: null as number | null,
})
const outboundRules: FormRules = {
  pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
}
const pickupUserOptions = ref<FinishedPickupUserOption[]>([])
const outboundSelectedCustomer = computed(() => {
  const first = outboundDialog.items[0]?.row?.customerName?.trim()
  return first || '-'
})
const outboundGrandTotal = computed(() =>
  outboundDialog.items.reduce((sum, item) => sum + getOutboundItemTotal(item), 0),
)

const createDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const createFormRef = ref<FormInstance>()
const createForm = reactive({
  orderNo: '',
  skuCode: '',
  quantity: 1,
  unitPrice: '',
  warehouseId: null as number | null,
  inventoryTypeId: null as number | null,
  department: '',
  location: '',
  imageUrl: '',
  remark: '',
})
const createRules: FormRules = {
  skuCode: [{ required: true, message: '请选择SKU', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  department: [{ required: true, message: '请选择部门', trigger: 'change' }],
  location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
}

const createSizeHeaders = ref<string[]>(['S'])
const createSizeTableRows = ref<Array<{ colorName: string; imageUrl: string; quantities: number[] }>>([
  { colorName: '默认', imageUrl: '', quantities: [0] },
])

const sizeTotalQuantity = computed(() =>
  createSizeTableRows.value.reduce((sum, row) => {
    const rowSum = row.quantities.reduce((s, qty) => {
      const q = Number(qty)
      return Number.isFinite(q) && q > 0 ? s + q : s
    }, 0)
    return sum + rowSum
  }, 0),
)

const createTableTotalPrice = computed(() =>
  formatTotalPrice(sizeTotalQuantity.value, createForm.unitPrice || undefined),
)

function createRowTotalPrice(quantities: unknown[]): string {
  return formatTotalPrice(sumDetailRowQty(quantities), createForm.unitPrice || undefined)
}

function getCreateColorSizeSummary({ columns }: { columns: Array<{ label?: string }> }) {
  const headersLen = createSizeHeaders.value.length
  const sumQtyColIndex = 2 + headersLen
  const unitPriceColIndex = 3 + headersLen
  const totalPriceColIndex = 4 + headersLen
  return columns.map((_, index) => {
    if (index === 0) return '汇总'
    if (index === sumQtyColIndex) return String(sizeTotalQuantity.value)
    if (index === unitPriceColIndex) return formatPrice(createForm.unitPrice || undefined)
    if (index === totalPriceColIndex) return createTableTotalPrice.value
    return ''
  })
}

function normalizeCreateSizeRows() {
  const len = createSizeHeaders.value.length
  createSizeTableRows.value.forEach((row) => {
    if (!Array.isArray(row.quantities)) row.quantities = []
    if (row.quantities.length < len) row.quantities.push(...Array(len - row.quantities.length).fill(0))
    else if (row.quantities.length > len) row.quantities.splice(len)
  })
}

function addCreateSizeColumn() {
  createSizeHeaders.value.push(`尺码${createSizeHeaders.value.length + 1}`)
  normalizeCreateSizeRows()
}

function addCreateColorRow() {
  createSizeTableRows.value.push({
    colorName: '',
    imageUrl: '',
    quantities: Array(createSizeHeaders.value.length).fill(0),
  })
}

function removeCreateColorRow(index: number) {
  createSizeTableRows.value.splice(index, 1)
  if (!createSizeTableRows.value.length) {
    createSizeTableRows.value.push({
      colorName: '默认',
      imageUrl: '',
      quantities: Array(createSizeHeaders.value.length).fill(0),
    })
  }
}

function removeCreateSizeColumn(index: number) {
  if (createSizeHeaders.value.length <= 1) return
  createSizeHeaders.value.splice(index, 1)
  normalizeCreateSizeRows()
}

async function loadCustomerOptions() {
  try {
    const res = await getCustomers({ page: 1, pageSize: 200, sortBy: 'companyName', sortOrder: 'asc' })
    const list = (res.data?.list ?? []) as CustomerItem[]
    customerOptions.value = list.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))
  } catch (e: unknown) {
    console.warn('客户选项加载失败')
  }
}

const filteredCreateSkuProducts = computed(() => {
  const kw = createSkuKeyword.value.trim().toLowerCase()
  if (!kw) return createSkuProducts.value
  return createSkuProducts.value.filter((item) => {
    const sku = String(item.skuCode ?? '').toLowerCase()
    const customer = String(item.customer?.companyName ?? '').toLowerCase()
    return sku.includes(kw) || customer.includes(kw)
  })
})

async function loadCreateSkuProducts() {
  createSkuDialogLoading.value = true
  try {
    const res = await getProducts({ page: 1, pageSize: 300 })
    createSkuProducts.value = res.data?.list ?? []
  } catch {
    createSkuProducts.value = []
  } finally {
    createSkuDialogLoading.value = false
  }
}

async function openCreateSkuDialog() {
  createSkuDialogVisible.value = true
  if (!createSkuProducts.value.length) {
    await loadCreateSkuProducts()
  }
}

function onSelectCreateSku(row: ProductItem) {
  createForm.skuCode = row.skuCode || ''
  if (row.imageUrl && !createForm.imageUrl) {
    createForm.imageUrl = row.imageUrl
  }
  createSkuDialogVisible.value = false
}

async function load() {
  loading.value = true
  try {
    const [startDate, endDate] =
      inboundDateRange.value && inboundDateRange.value.length === 2 ? inboundDateRange.value : ['', '']
    const res = await getFinishedStockList({
      tab: currentTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId ?? undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      stockTotalQuantity.value = Number(data.totalQuantity ?? 0) || 0
      restoreFinishedStockColumnWidths(finishedStockTableRef.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    loadOutbounds()
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  filter.customerName = ''
  filter.inventoryTypeId = null
  inboundDateRange.value = null
  currentTab.value = 'stored'
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: FinishedStockRow[]) {
  selectedRows.value = rows
}

function openInboundDialog() {
  if (!pendingRows.value.length) return
  inboundDialog.visible = true
}

function resetInboundForm() {
  inboundForm.warehouseId = null
  inboundForm.inventoryTypeId = null
  inboundForm.department = ''
  inboundForm.location = ''
  inboundForm.imageUrl = ''
  inboundFormRef.value?.clearValidate()
}

async function submitInbound() {
  await inboundFormRef.value?.validate().catch(() => {})
  const ids = pendingRows.value.map((r) => r.id)
  if (!ids.length) return
  inboundDialog.submitting = true
  try {
    await doPendingInbound({
      ids,
      warehouseId: inboundForm.warehouseId,
      inventoryTypeId: inboundForm.inventoryTypeId ?? undefined,
      department: inboundForm.department,
      location: inboundForm.location,
      imageUrl: inboundForm.imageUrl || undefined,
    })
    ElMessage.success('入库成功')
    inboundDialog.visible = false
    selectedRows.value = []
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    inboundDialog.submitting = false
  }
}

function mergeStockRowWithList(row: FinishedStockRow): FinishedStockRow {
  const fresh = list.value.find((x) => x.id === row.id && x.type === row.type)
  return fresh ? { ...row, ...fresh } : row
}

async function openOutboundDialog() {
  if (storedRows.value.length === 0) return
  const rows = storedRows.value.map((r) => mergeStockRowWithList(r))
  const customerNames = Array.from(new Set(rows.map((row) => row.customerName?.trim() || '__EMPTY__')))
  if (customerNames.length > 1) {
    ElMessage.warning('批量出库请只选择同一客户的记录')
    return
  }
  outboundForm.pickupUserId = null
  const orderIdsToPrefetch = Array.from(
    new Set(
      rows
        .filter((r) => {
          if (!r.orderId) return false
          if (r.sizeBreakdown?.headers?.length && r.sizeBreakdown.rows?.length) return false
          return true
        })
        .map((r) => r.orderId as number),
    ),
  )
  await Promise.all(orderIdsToPrefetch.map((orderId) => ensureColorSizeBreakdown(orderId)))
  outboundDialog.items = rows.map((row) => buildOutboundDialogItem(row))
  outboundDialog.visible = true
}

function resetOutboundForm() {
  outboundDialog.items = []
  outboundForm.pickupUserId = null
  outboundFormRef.value?.clearValidate()
}

function getOutboundItemTotal(item: FinishedOutboundDialogItem) {
  return item.rows.reduce(
    (sum, row) => sum + row.quantities.reduce((rowSum, q) => rowSum + (Number(q) || 0), 0),
    0,
  )
}

async function submitOutbound() {
  if (!outboundDialog.items.length) return
  const valid = await outboundFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const invalidItem = outboundDialog.items.find((item) => {
    const qty = getOutboundItemTotal(item)
    return item.headers.length === 0 || qty <= 0 || qty > item.row.quantity
  })
  if (invalidItem) {
    const qty = getOutboundItemTotal(invalidItem)
    const label = outboundRowLabel(invalidItem)
    if (invalidItem.headers.length === 0) {
      ElMessage.warning(`${label} 暂无颜色尺码明细，无法出库`)
    } else if (qty <= 0) {
      ElMessage.warning(`${label} 请填写出库数量`)
    } else {
      ElMessage.warning(`${label} 的出库数量不能大于当前库存`)
    }
    return
  }
  outboundDialog.submitting = true
  try {
    await finishedOutbound({
      items: outboundDialog.items.map((item) => ({
        id: item.row.id,
        quantity: getOutboundItemTotal(item),
        sizeBreakdown: {
          headers: item.headers,
          rows: item.rows.map((row) => ({
            colorName: row.colorName,
            quantities: row.quantities.map((q) => Number(q) || 0),
          })),
        },
      })),
      pickupUserId: outboundForm.pickupUserId,
    })
    ElMessage.success('出库成功')
    outboundDialog.visible = false
    selectedRows.value = []
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundDialog.submitting = false
  }
}

function openCreateDialog() {
  createDialog.visible = true
  resetCreateForm()
}

function resetCreateForm() {
  createForm.orderNo = ''
  createForm.skuCode = ''
  createForm.quantity = 1
  createForm.unitPrice = ''
  createForm.warehouseId = null
  createForm.inventoryTypeId = null
  createForm.department = ''
  createForm.location = ''
  createForm.imageUrl = ''
  createForm.remark = ''
  createSizeHeaders.value = ['S']
  createSizeTableRows.value = [{ colorName: '默认', imageUrl: '', quantities: [0] }]
  createFormRef.value?.clearValidate()
}

async function submitCreate() {
  await createFormRef.value?.validate().catch(() => {})
  const totalQty = sizeTotalQuantity.value
  if (!totalQty || totalQty <= 0) {
    ElMessage.warning('请填写尺寸对应的数量')
    return
  }
  createForm.quantity = totalQty
  createDialog.submitting = true
  try {
    await createFinishedStock({
      orderNo: createForm.orderNo?.trim() || undefined,
      skuCode: createForm.skuCode,
      quantity: createForm.quantity,
      unitPrice: createForm.unitPrice?.trim() || undefined,
      warehouseId: createForm.warehouseId,
      inventoryTypeId: createForm.inventoryTypeId ?? undefined,
      department: createForm.department,
      location: createForm.location,
      imageUrl: createForm.imageUrl || undefined,
      remark: createForm.remark?.trim() || undefined,
      colorSize: {
        headers: createSizeHeaders.value.map((h) => String(h ?? '').trim()),
        rows: createSizeTableRows.value.map((r) => ({
          colorName: r.colorName,
          imageUrl: r.imageUrl,
          quantities: [...r.quantities],
        })),
      },
    })
    ElMessage.success('新增库存成功')
    createDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    createDialog.submitting = false
  }
}

function formatPrice(unitPrice: string | undefined): string {
  if (unitPrice == null || unitPrice === '') return '￥0'
  const n = Number(unitPrice)
  return Number.isFinite(n) ? `￥${formatDisplayNumber(n)}` : '￥0'
}

function formatTotalPrice(quantity: number, unitPrice: string | undefined): string {
  const n = Number(unitPrice)
  if (!Number.isFinite(n) || !Number.isFinite(quantity)) return '￥0'
  return `￥${formatDisplayNumber(quantity * n)}`
}

function findWarehouseLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const item = warehouseOptions.value.find((w) => w.id === id)
  return item?.label ?? ''
}

function findInventoryTypeLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const item = inventoryTypeOptions.value.find((o) => o.id === id)
  return item?.label ?? ''
}

async function loadWarehouseOptions() {
  try {
    const res = await getSystemOptionsList('warehouses')
    const list = (res.data ?? []) as SystemOptionItem[]
    warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    warehouseOptions.value = []
  }
}

async function loadInventoryTypeOptions() {
  try {
    const res = await getSystemOptionsList('inventory_types')
    const list = (res.data ?? []) as SystemOptionItem[]
    inventoryTypeOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    inventoryTypeOptions.value = []
  }
}

async function loadDepartmentOptions() {
  try {
    const res = await getSystemOptionsList('org_departments')
    const list = (res.data ?? []) as SystemOptionItem[]
    departmentOptions.value = list.map((o) => ({ value: o.value, label: o.value }))
  } catch {
    departmentOptions.value = []
  }
}

async function loadPickupUserOptions() {
  try {
    const res = await getFinishedPickupUserOptions()
    pickupUserOptions.value = (res.data ?? []) as FinishedPickupUserOption[]
  } catch {
    pickupUserOptions.value = []
  }
}

onMounted(async () => {
  await Promise.all([
    loadCreateSkuProducts(),
    loadWarehouseOptions(),
    loadInventoryTypeOptions(),
    loadCustomerOptions(),
    loadDepartmentOptions(),
    loadPickupUserOptions(),
  ])
  await load()
  detailDrawerWidth.value = loadSavedDetailDrawerWidth()
})

onBeforeUnmount(() => {
  stopResizeDetailDrawer()
  detailDrawerWidth.value = DETAIL_DRAWER_DEFAULT_WIDTH
})

async function loadOutbounds() {
  outboundLoading2.value = true
  try {
    const [startDate, endDate] =
      Array.isArray(outboundFilter.dateRange) && outboundFilter.dateRange.length === 2
        ? outboundFilter.dateRange
        : ['', '']
    const res = await getFinishedOutboundRecords({
      orderNo: outboundFilter.orderNo || undefined,
      skuCode: outboundFilter.skuCode || undefined,
      customerName: outboundFilter.customerName || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: outboundPagination.page,
      pageSize: outboundPagination.pageSize,
    })
    const data = res.data
    outboundList.value = data?.list ?? []
    outboundPagination.total = data?.total ?? 0
    restoreFinishedOutboundColumnWidths(finishedOutboundTableRef.value)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundLoading2.value = false
  }
}

function onOutboundSearch(_byUser = false) {
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundReset() {
  outboundFilter.orderNo = ''
  outboundFilter.skuCode = ''
  outboundFilter.customerName = ''
  outboundFilter.dateRange = []
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundPageSizeChange() {
  outboundPagination.page = 1
  loadOutbounds()
}
</script>

<style scoped>
.inventory-finished-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.finished-table {
  margin-bottom: var(--space-md);
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.inventory-finished-page .pagination-wrap--with-summary {
  margin-top: var(--space-md);
  justify-content: space-between;
  align-items: center;
}

.inventory-finished-page .pagination-summary {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-secondary, #606266);
}

.qty-hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.detail-wrap {
  padding: 0 12px 12px 12px;
}

.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.detail-section-head .detail-section-title {
  margin-bottom: 0;
}

.detail-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-head-btn {
  padding-inline: 8px;
}

.detail-top-row {
  display: flex;
  gap: 0;
  align-items: stretch;
}

.detail-section {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-top-row .detail-section {
  flex: 1 1 100%;
  width: 100%;
}

.detail-basic-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  gap: 12px;
  align-items: stretch;
}

.detail-basic-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}

.detail-basic-label,
.detail-basic-value {
  min-width: 0;
  padding: 7px 10px;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.detail-basic-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}

.detail-basic-value {
  color: var(--el-text-color-regular);
  overflow: hidden;
}

.detail-basic-value-span-3 {
  grid-column: 2 / 5;
}

.detail-basic-grid > :nth-child(4n) {
  border-right: none;
}

.detail-basic-grid > :nth-last-child(-n + 2) {
  border-bottom: none;
}

.detail-product-image-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 170px;
  min-width: 170px;
}

.detail-images {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-image-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-image-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-image-empty,
.detail-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-color-size-table-wrap {
  width: 100%;
}

.detail-color-size-footer {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}

.detail-color-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.detail-edit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

/* 详情抽屉内：压缩顶部留白、保证表格内可点击控件可用 */
.finished-detail-drawer :deep(.el-drawer__header) {
  margin-bottom: 6px;
  padding-bottom: 0;
}

.finished-detail-drawer :deep(.el-drawer) {
  position: relative;
}

.finished-detail-drawer :deep(.el-drawer__body) {
  padding-top: 0;
}

.finished-detail-drawer :deep(.detail-color-size-table .el-table__cell) {
  overflow: visible;
  vertical-align: top;
}

.detail-drawer-resizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 10px;
  height: 100%;
  z-index: 10;
  cursor: ew-resize;
}

.detail-drawer-resizer:hover {
  background: rgba(64, 158, 255, 0.12);
}

:global(body.detail-drawer-resizing) {
  cursor: ew-resize !important;
  user-select: none !important;
}

:global(body.detail-drawer-resizing *) {
  user-select: none !important;
}

.finished-detail-drawer :deep(.detail-color-size-table .image-upload-area) {
  min-height: 92px;
}

.finished-detail-drawer :deep(.el-form-item__label),
.finished-detail-drawer :deep(.el-input__inner),
.finished-detail-drawer :deep(.el-select__selected-item),
.finished-detail-drawer :deep(.el-table),
.finished-detail-drawer :deep(.el-table th),
.finished-detail-drawer :deep(.el-table td) {
  font-size: 12px;
}

.finished-detail-drawer :deep(.detail-product-image-panel .image-upload-area) {
  width: 100%;
}

.finished-detail-drawer :deep(.detail-basic-grid .el-select),
.finished-detail-drawer :deep(.detail-basic-grid .el-input) {
  width: 100%;
  max-width: 100%;
}

.finished-detail-drawer :deep(.detail-basic-grid .el-select__wrapper) {
  min-width: 0 !important;
}

.finished-detail-drawer :deep(.detail-color-image-editor.image-upload-area) {
  min-height: 64px;
}

.finished-detail-drawer :deep(.detail-color-image-editor .preview-img) {
  width: 60px;
  height: 60px;
}

.detail-logs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-log-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.detail-log-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-log-body {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.detail-log-remark {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}

.outbound-size-wrap {
  width: 100%;
}

.outbound-size-footer {
  margin-top: 8px;
  text-align: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.outbound-batch-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
}

.outbound-batch-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 55vh;
  overflow: auto;
  padding-right: 4px;
}

.outbound-batch-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}

.outbound-card-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}

.create-form-grid .el-form-item {
  margin-bottom: var(--space-sm);
}

.create-sections {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.create-size-table-wrap {
  width: 100%;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  overflow: hidden;
}

.create-size-table {
  margin: 0;
}

.create-size-table .el-table__inner-wrapper::before {
  display: none;
}

.b-header-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding-right: 10px;
}

.b-header-input {
  width: 100%;
  flex: 1;
  min-width: 0;
  text-align: center;
}

.b-header-input :deep(.el-input__wrapper) {
  padding-left: 1px;
  padding-right: 1px;
}

.b-header-input :deep(.el-input__inner) {
  text-align: center;
}

.b-header-remove {
  position: absolute;
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  padding: 0;
  min-height: 10px;
  min-width: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.b-header-remove :deep(.el-icon) {
  font-size: 8px;
  line-height: 8px;
}

.b-header-cell:hover .b-header-remove {
  opacity: 1;
}

.create-row-remove-btn {
  padding: 0;
}

.create-size-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-bg-subtle, #f5f6f8);
  border-top: 1px solid var(--el-border-color-lighter);
}

.create-size-total {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

@media (max-width: 860px) {
  .detail-top-row {
    flex-direction: column;
  }
  .detail-basic-main {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
/* tooltip 弹层在 body 下，需用全局样式；通过 popper-class 精确作用范围 */
.finished-qty-popper {
  padding: 0;
}

.finished-qty-popper .el-popper__arrow::before {
  border: 1px solid var(--el-border-color-lighter);
}

.finished-qty-popper .qty-tooltip {
  max-width: 520px;
  padding: 10px 12px;
}

.finished-qty-popper .qty-tooltip-loading,
.finished-qty-popper .qty-tooltip-error,
.finished-qty-popper .qty-tooltip-empty {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
}

.finished-qty-popper .qty-tooltip-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.finished-qty-popper .qty-tooltip-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(44px, auto);
  align-items: center;
  gap: 2px;
}

.finished-qty-popper .qty-tooltip-cell {
  padding: 4px 6px;
  border-radius: 4px;
  background: #f5f6f8;
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.finished-qty-popper .qty-tooltip-head .qty-tooltip-cell {
  background: #eef1f6;
  font-weight: 600;
}

.finished-qty-popper .qty-tooltip-color {
  min-width: 72px;
}
</style>
