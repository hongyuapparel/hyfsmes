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
              :loading="outboundLoading"
              @click="openOutboundDialog"
            >
              出库
            </el-button>
          </div>
        </div>

        <el-table
          v-loading="loading"
          :data="list"
          border
          stripe
          class="finished-table"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" align="center" />
          <el-table-column prop="createdAt" label="入库时间" width="160" align="center" />
          <el-table-column prop="orderNo" label="订单号" min-width="110" show-overflow-tooltip />
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.imageUrl"
                :src="row.imageUrl"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 6px"
                :preview-src-list="[row.imageUrl]"
                preview-teleported
              />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="90" align="right">
            <template #default="{ row }">
              <el-tooltip
                placement="top"
                effect="light"
                :show-after="250"
                :hide-after="0"
                :disabled="!row.orderId"
                popper-class="finished-qty-popper"
                @show="ensureColorSizeBreakdown(row.orderId)"
              >
                <template #content>
                  <div class="qty-tooltip">
                    <template v-if="row.orderId && colorSizeCache[row.orderId]?.loading">
                      <div class="qty-tooltip-loading">加载中...</div>
                    </template>
                    <template v-else-if="row.orderId && colorSizeCache[row.orderId]?.error">
                      <div class="qty-tooltip-error">明细加载失败</div>
                    </template>
                    <template v-else>
                      <div v-if="!row.orderId || (colorSizeCache[row.orderId]?.headers?.length ?? 0) === 0" class="qty-tooltip-empty">
                        暂无明细
                      </div>
                      <div v-else class="qty-tooltip-grid">
                        <div class="qty-tooltip-row qty-tooltip-head">
                          <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                          <div
                            v-for="(h, idx) in colorSizeCache[row.orderId].headers"
                            :key="idx"
                            class="qty-tooltip-cell"
                          >
                            {{ h }}
                          </div>
                        </div>
                        <div
                          v-for="(r, rIdx) in colorSizeCache[row.orderId].rows"
                          :key="rIdx"
                          class="qty-tooltip-row"
                        >
                          <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                          <div
                            v-for="(v, vIdx) in r.values"
                            :key="vIdx"
                            class="qty-tooltip-cell qty-tooltip-num"
                          >
                            {{ v }}
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
                <span class="qty-hover">{{ row.quantity }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="出厂价" width="100" align="right">
            <template #default="{ row }">
              {{ formatPrice(row.unitPrice) }}
            </template>
          </el-table-column>
          <el-table-column label="总价" width="100" align="right">
            <template #default="{ row }">
              {{ formatTotalPrice(row.quantity, row.unitPrice) }}
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
          <el-table-column prop="location" label="存放地址" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="88" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[20, 40, 60]"
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
            :style="getFilterRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <el-table v-loading="outboundLoading2" :data="outboundList" border stripe class="finished-table">
          <el-table-column prop="createdAt" label="出库时间" width="160" align="center">
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.imageUrl"
                :src="row.imageUrl"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 6px"
                :preview-src-list="[row.imageUrl]"
                preview-teleported
              />
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
                <span class="qty-hover">{{ row.quantity }}</span>
              </el-tooltip>
              <span v-else>{{ row.quantity }}</span>
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
          <el-table-column prop="pickupUserName" label="领走人" width="120" show-overflow-tooltip />
          <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip />
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 40, 60]"
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
        <el-form-item label="位置登记" prop="location">
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
      width="640"
      destroy-on-close
      @close="resetOutboundForm"
    >
      <el-form
        ref="outboundFormRef"
        :model="outboundForm"
        :rules="outboundRules"
        label-width="80px"
      >
        <el-form-item label="领走人" prop="pickupUserId">
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
        <el-form-item v-if="outboundSizeBreakdown.headers.length" label="颜色尺码明细">
          <div class="outbound-size-wrap">
            <el-table :data="outboundSizeBreakdown.rows" border size="small">
              <el-table-column label="颜色" min-width="100">
                <template #default="{ row }">
                  {{ row.colorName || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-for="(h, hIdx) in outboundSizeBreakdown.headers"
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
            <div class="outbound-size-footer">明细合计：{{ outboundBreakdownTotal }}</div>
          </div>
        </el-form-item>
        <div v-else class="detail-muted">该记录暂无颜色尺码明细，无法按明细出库。</div>
        <p v-if="outboundDialog.row" class="outbound-tip">
          当前库存：{{ outboundDialog.row.quantity }}
        </p>
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
      width="640"
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
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="订单号" prop="orderNo">
              <el-input v-model="createForm.orderNo" placeholder="选填，不填则不关联订单" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="SKU" prop="skuCode">
              <el-input v-model="createForm.skuCode" placeholder="请输入SKU编号" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="尺寸数量">
              <div class="create-size-table-wrap">
                <el-table :data="sizeRows" border size="small" class="create-size-table">
                  <el-table-column label="尺寸（如 S/M/L）" min-width="140">
                    <template #default="{ row }">
                      <el-input v-model="row.size" placeholder="尺寸" clearable size="small" />
                    </template>
                  </el-table-column>
                  <el-table-column label="数量" width="120" align="right">
                    <template #default="{ row }">
                      <el-input-number
                        v-model="row.quantity"
                        :min="0"
                        :precision="0"
                        controls-position="right"
                        size="small"
                        style="width: 100%"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="70" align="center">
                    <template #default="{ $index }">
                      <el-button
                        v-if="sizeRows.length > 1"
                        type="danger"
                        link
                        size="small"
                        @click="removeSizeRow($index)"
                      >
                        删除
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div class="create-size-footer">
                  <el-button type="primary" link size="small" @click="addSizeRow">+ 新增尺寸行</el-button>
                  <span class="create-size-total">合计数量：{{ sizeTotalQuantity }}</span>
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="仓库" prop="warehouseId">
              <el-select
                v-model="createForm.warehouseId"
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
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存类型" prop="inventoryTypeId">
              <el-select
                v-model="createForm.inventoryTypeId"
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
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="部门" prop="department">
              <el-select
                v-model="createForm.department"
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
          </el-col>
          <el-col :span="12">
            <el-form-item label="存放地址" prop="location">
              <el-input v-model="createForm.location" placeholder="请输入具体存放地址" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="图片">
              <ImageUploadArea v-model="createForm.imageUrl" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="createDialog.submitting" @click="submitCreate">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailDrawer.visible"
      title="库存详情"
      size="620px"
      destroy-on-close
      :with-header="true"
    >
      <div v-loading="detailDrawer.loading" class="detail-wrap">
        <div v-if="detailDrawer.data" class="detail-sections">
          <div class="detail-section">
            <div class="detail-section-title">基础信息</div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="入库时间">{{ detailDrawer.data.stock.createdAt }}</el-descriptions-item>
              <el-descriptions-item label="订单号">{{ detailDrawer.data.orderNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="SKU">{{ detailDrawer.data.stock.skuCode }}</el-descriptions-item>
              <el-descriptions-item label="数量">{{ detailDrawer.data.stock.quantity }}</el-descriptions-item>
              <el-descriptions-item label="出厂价">{{ formatPrice(detailDrawer.data.stock.unitPrice) }}</el-descriptions-item>
              <el-descriptions-item label="总价">{{ formatTotalPrice(detailDrawer.data.stock.quantity, detailDrawer.data.stock.unitPrice) }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">图片</div>
            <div class="detail-images">
              <div class="detail-image-card">
                <div class="detail-image-label">产品图</div>
                <el-image
                  v-if="detailDrawer.data.productImageUrl"
                  :src="detailDrawer.data.productImageUrl"
                  fit="cover"
                  style="width: 120px; height: 120px; border-radius: 8px"
                  :preview-src-list="[detailDrawer.data.productImageUrl]"
                  preview-teleported
                />
                <div v-else class="detail-image-empty">-</div>
              </div>
              <div class="detail-image-card">
                <div class="detail-image-label">库存图</div>
                <el-image
                  v-if="detailDrawer.data.stock.imageUrl"
                  :src="detailDrawer.data.stock.imageUrl"
                  fit="cover"
                  style="width: 120px; height: 120px; border-radius: 8px"
                  :preview-src-list="[detailDrawer.data.stock.imageUrl]"
                  preview-teleported
                />
                <div v-else class="detail-image-empty">-</div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">按颜色上传图片</div>
            <div v-if="detailDrawer.data.colorSize.colors.length" class="detail-color-grid">
              <div
                v-for="c in detailDrawer.data.colorSize.colors"
                :key="c"
                class="detail-color-item"
              >
                <div class="detail-color-name">{{ c }}</div>
                <ImageUploadArea
                  :model-value="getColorImageUrl(c)"
                  @update:model-value="(url) => saveColorImage(c, url)"
                />
              </div>
            </div>
            <div v-else class="detail-muted">暂无颜色列表（未关联订单或订单未维护颜色尺码）。</div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">可编辑信息</div>
            <el-form :model="detailEditForm" label-width="90px" class="detail-edit-form">
              <el-form-item label="部门">
                <el-select v-model="detailEditForm.department" filterable clearable style="width: 100%">
                  <el-option v-for="opt in departmentOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="库存类型">
                <el-select v-model="detailEditForm.inventoryTypeId" filterable clearable style="width: 100%">
                  <el-option v-for="opt in inventoryTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="仓库">
                <el-select v-model="detailEditForm.warehouseId" filterable clearable style="width: 100%">
                  <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="存放地址">
                <el-input v-model="detailEditForm.location" clearable />
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="detailEditForm.remark" type="textarea" :rows="2" placeholder="选填" />
              </el-form-item>
              <div class="detail-edit-actions">
                <el-button type="primary" :loading="detailDrawer.saving" @click="saveDetailMeta">保存</el-button>
              </div>
            </el-form>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
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
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getCustomers, type CustomerItem } from '@/api/customers'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const DATE_RANGE_WIDTH_EMPTY = '140px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? { color: ACTIVE_FILTER_COLOR } : undefined
}
function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  if (!orderNo || !showLabel) return undefined
  const text = `订单号：${String(orderNo)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  if (!skuCode || !showLabel) return undefined
  const text = `SKU：${String(skuCode)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

function getFilterRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

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
const list = ref<FinishedStockRow[]>([])
const customerOptions = ref<{ label: string; value: string }[]>([])
const warehouseOptions = ref<{ id: number; label: string }[]>([])
const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
const departmentOptions = ref<{ value: string; label: string }[]>([])
const loading = ref(false)
const inboundLoading = ref(false)
const outboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FinishedStockRow[]>([])

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
  return [dep, it, wh, loc].filter((x) => x).join(' / ') || '-'
}

function getColorImageUrl(colorName: string): string {
  return detailDrawer.colorImageMap[colorName] || ''
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

async function openDetail(row: FinishedStockRow) {
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
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    detailDrawer.saving = false
  }
}

async function saveColorImage(colorName: string, url: string) {
  if (!detailDrawer.stockId) return
  const imageUrl = (url ?? '').trim()
  if (!imageUrl) return
  try {
    await upsertFinishedStockColorImage(detailDrawer.stockId, { colorName, imageUrl })
    detailDrawer.colorImageMap[colorName] = imageUrl
    ElMessage.success('已保存图片')
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
  location: [{ required: true, message: '请输入位置登记', trigger: 'blur' }],
}

const outboundDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: FinishedStockRow | null
}>({ visible: false, submitting: false, row: null })
const outboundFormRef = ref<FormInstance>()
const outboundForm = reactive({
  pickupUserId: null as number | null,
})
const outboundRules: FormRules = {
  pickupUserId: [{ required: true, message: '请选择领走人', trigger: 'change' }],
}
const outboundMaxQty = computed(() => outboundDialog.row?.quantity ?? 0)
const pickupUserOptions = ref<FinishedPickupUserOption[]>([])
const outboundSizeBreakdown = reactive<{
  headers: string[]
  rows: Array<{ colorName: string; quantities: number[] }>
}>({
  headers: [],
  rows: [],
})
const outboundBreakdownTotal = computed(() =>
  outboundSizeBreakdown.rows.reduce(
    (sum, row) => sum + row.quantities.reduce((s, q) => s + (Number(q) || 0), 0),
    0,
  ),
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
  warehouseId: null as number | null,
  inventoryTypeId: null as number | null,
  department: '',
  location: '',
  imageUrl: '',
})
const createRules: FormRules = {
  skuCode: [{ required: true, message: '请输入SKU', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  department: [{ required: true, message: '请选择部门', trigger: 'change' }],
  location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
}

const sizeRows = ref<{ size: string; quantity: number }[]>([
  { size: '', quantity: 0 },
])

const sizeTotalQuantity = computed(() =>
  sizeRows.value.reduce((sum, row) => {
    const q = Number(row.quantity)
    return Number.isFinite(q) && q > 0 ? sum + q : sum
  }, 0),
)

function addSizeRow() {
  sizeRows.value.push({ size: '', quantity: 0 })
}

function removeSizeRow(index: number) {
  sizeRows.value.splice(index, 1)
  if (!sizeRows.value.length) sizeRows.value.push({ size: '', quantity: 0 })
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

async function load() {
  loading.value = true
  try {
    const res = await getFinishedStockList({
      tab: currentTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
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

async function openOutboundDialog() {
  if (storedRows.value.length === 0) return
  const row = storedRows.value[0]
  outboundDialog.row = row
  outboundForm.pickupUserId = null
  if (row.orderId) {
    await ensureColorSizeBreakdown(row.orderId)
  }
  const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
  outboundSizeBreakdown.headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
  outboundSizeBreakdown.rows = (breakdown?.rows ?? []).map((r) => ({
    colorName: r.colorName,
    quantities: outboundSizeBreakdown.headers.map(() => 0),
  }))
  outboundDialog.visible = true
}

function resetOutboundForm() {
  outboundDialog.row = null
  outboundForm.pickupUserId = null
  outboundSizeBreakdown.headers = []
  outboundSizeBreakdown.rows = []
  outboundFormRef.value?.clearValidate()
}

async function submitOutbound() {
  if (!outboundDialog.row) return
  await outboundFormRef.value?.validate().catch(() => {})
  if (outboundSizeBreakdown.headers.length === 0) {
    ElMessage.warning('暂无颜色尺码明细，无法出库')
    return
  }
  const qty = outboundBreakdownTotal.value
  if (qty <= 0 || qty > outboundDialog.row.quantity) {
    ElMessage.warning('出库数量无效')
    return
  }
  outboundDialog.submitting = true
  try {
    await finishedOutbound(
      outboundDialog.row.id,
      qty,
      outboundForm.pickupUserId,
      outboundSizeBreakdown.headers.length > 0
        ? {
            headers: outboundSizeBreakdown.headers,
            rows: outboundSizeBreakdown.rows.map((r) => ({
              colorName: r.colorName,
              quantities: r.quantities.map((q) => Number(q) || 0),
            })),
          }
        : null,
    )
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
  createForm.warehouseId = null
  createForm.inventoryTypeId = null
  createForm.department = ''
  createForm.location = ''
  createForm.imageUrl = ''
  sizeRows.value = [{ size: '', quantity: 0 }]
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
      warehouseId: createForm.warehouseId,
      inventoryTypeId: createForm.inventoryTypeId ?? undefined,
      department: createForm.department,
      location: createForm.location,
      imageUrl: createForm.imageUrl || undefined,
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
  if (unitPrice == null || unitPrice === '') return '-'
  const n = Number(unitPrice)
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}

function formatTotalPrice(quantity: number, unitPrice: string | undefined): string {
  const n = Number(unitPrice)
  if (!Number.isFinite(n) || !Number.isFinite(quantity)) return '-'
  return (quantity * n).toFixed(2)
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
    loadWarehouseOptions(),
    loadInventoryTypeOptions(),
    loadCustomerOptions(),
    loadDepartmentOptions(),
    loadPickupUserOptions(),
  ])
  await load()
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
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.range-single.el-date-editor--daterange :deep(.el-range-separator) {
  width: 0;
}
.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) {
  display: none;
}
.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) {
  width: 100%;
}
.range-single.el-date-editor--daterange :deep(.el-range__close-icon) {
  display: none;
}

.finished-table {
  margin-bottom: var(--space-md);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}

.qty-hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.detail-wrap {
  padding: 12px;
}

.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-section-title {
  font-weight: 600;
  margin-bottom: 8px;
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

.detail-color-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.detail-edit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
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

.outbound-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-top: -8px;
  margin-bottom: 0;
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

.create-form-grid .el-form-item {
  margin-bottom: var(--space-sm);
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
