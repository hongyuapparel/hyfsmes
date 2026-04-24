<template>
  <div class="page-card order-edit-page" v-loading="pageLoading">
    <div class="page-header">
      <div class="left">
        <el-button link type="primary" @click="goBack">返回列表</el-button>
        <span class="title">订单编辑</span>
        <span v-if="orderNo" class="sub-title">订单号：{{ orderNo }}</span>
      </div>
      <div class="right">
        <el-button @click="goBack">取消</el-button>
        <el-button v-if="orderStatus === 'draft'" @click="onSaveDraft" :loading="saving">保存草稿</el-button>
        <el-button type="primary" @click="onSaveAndSubmit" :loading="submitting">提交</el-button>
      </div>
    </div>

    <!-- A 区：订单基本信息 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">A 订单基本信息</span>
        </div>
      </template>

      <el-row :gutter="16" class="a-area-row">
        <el-col :xs="24" :md="4" class="a-area-image-col">
          <div
            class="order-image-block"
            @click="triggerOrderImageUpload"
          >
            <div class="image-preview-wrap" v-if="form.imageUrl">
              <el-image :src="form.imageUrl" fit="contain" :preview-src-list="[form.imageUrl]" />
              <el-button text type="danger" size="small" class="image-remove" @click.stop="form.imageUrl = ''">
                移除
              </el-button>
            </div>
            <div v-else class="image-placeholder">
              <span>选择SKU后显示</span>
              <span class="image-upload-hint">点击上传图片</span>
            </div>
          </div>
          <input
            ref="orderImageFileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden-file-input"
            @change="onOrderImageFileChange"
          />
        </el-col>
        <el-col :xs="24" :md="20">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="basic-form" label-position="left">
        <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="8">
          <el-form-item label="SKU" prop="skuCode">
            <el-input
              v-model="form.skuCode"
              placeholder="选择 SKU"
              clearable
            >
              <template #suffix>
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click.stop="openSkuDialog"
                >
                  选择
                </el-button>
              </template>
            </el-input>
          </el-form-item>
        </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="订单号">
              <el-input v-model="orderNo" disabled />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="小满单号">
              <el-input v-model="form.xiaomanOrderNo" placeholder="可选填" />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="产品分组">
              <el-input :model-value="selectedSkuMeta.productGroupName" disabled placeholder="随 SKU 自动带出" />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="适用人群">
              <el-input :model-value="selectedSkuMeta.applicablePeopleName" disabled placeholder="随 SKU 自动带出" />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="合作方式" prop="collaborationTypeId">
              <el-select
                v-model="form.collaborationTypeId"
                placeholder="选择合作方式"
                clearable
                filterable
              >
                <el-option
                  v-for="opt in collaborationOptions"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.id"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="订单类型" prop="orderTypeId">
              <el-tree-select
                v-model="form.orderTypeId"
                :data="orderTypeTreeSelectData"
                placeholder="选择订单类型"
                filterable
                default-expand-all
                :render-after-expand="false"
                :fit-input-width="false"
                popper-class="order-type-tree-dropdown"
                node-key="value"
                :props="orderTypeTreeSelectProps"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="客户" prop="customerId">
              <el-input
                :model-value="customerDisplayText"
                placeholder="选择客户"
                readonly
                clearable
                :loading="customerLoading"
                @clear="clearSelectedCustomer"
              >
                <template #suffix>
                  <el-button
                    link
                    type="primary"
                    size="small"
                    @click.stop="openCustomerDialog"
                  >
                    选择
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="客户交期" prop="customerDueDate">
              <el-date-picker
                v-model="form.customerDueDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="下单日期">
              <el-date-picker
                v-model="form.orderDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="销售价" prop="salePrice" required>
              <el-input v-model="form.salePrice" placeholder="人民币" />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="跟单员" prop="merchandiser">
              <el-select
                v-model="form.merchandiser"
                placeholder="选择跟单员"
                filterable
                clearable
                :loading="userLoading"
                @change="onMerchandiserChange"
              >
                <el-option
                  v-for="u in merchandiserOptions"
                  :key="u.id"
                  :label="u.displayName || u.username"
                  :value="u.displayName || u.username"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="业务员">
              <el-select
                v-model="form.salesperson"
                placeholder="选择业务员"
                filterable
                clearable
                :loading="userLoading"
              >
                <el-option
                  v-for="u in salespersonOptions"
                  :key="u.id"
                  :label="u.displayName || u.username"
                  :value="u.displayName || u.username"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
        </el-col>
      </el-row>
    </el-card>

    <!-- B 区：颜色 / 数量 -->
    <el-card ref="bTableRef" class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">B 颜色 / 数量</span>
          <div class="block-actions">
            <el-button link type="primary" @click="addSizeColumn">新增尺码列</el-button>
            <el-button link type="primary" @click="addColorRow">新增颜色</el-button>
          </div>
        </div>
      </template>
      <el-table
        :data="colorRows"
        border
        show-summary
        sum-text="合计"
        :summary-method="bSummaryMethod"
        header-align="center"
      >
        <el-table-column label="颜色名称" min-width="120" align="center" header-align="center">
          <template #default="{ row, $index }">
            <div
              v-if="editingCell?.rowIndex === $index && editingCell?.col === 'color'"
              class="b-cell-edit"
              @blur="onBCellBlur"
            >
              <el-input
                ref="colorNameInputRef"
                v-model="row.colorName"
                placeholder="颜色名称"
                size="small"
                borderless
                @keydown.enter="editingCell = null"
              />
            </div>
            <div
              v-else
              class="b-cell-text"
              tabindex="0"
              @click="startEditBCell($index, 'color')"
              @focus="startEditBCell($index, 'color')"
            >
              {{ row.colorName || '—' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-for="(size, sIndex) in sizeHeaders"
          :key="'size-' + sIndex"
          :label="size"
          min-width="90"
          align="center"
          header-align="center"
        >
          <template #header>
            <div class="b-header-cell">
              <el-tooltip content="在当前列前新增尺码列" placement="top">
                <el-button
                  link
                  type="primary"
                  size="small"
                  class="b-header-insert"
                  @click.stop="insertSizeColumnBefore(sIndex)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
              </el-tooltip>
              <el-input
                v-model="sizeHeaders[sIndex]"
                size="small"
                class="b-header-input"
                :input-style="{ textAlign: 'center' }"
                @click.stop
              />
              <el-tooltip v-if="sizeHeaders.length > 1" content="删除此列" placement="top">
                <el-button
                  link
                  type="danger"
                  size="small"
                  class="b-header-remove"
                  @click.stop="removeSizeColumn(sIndex)"
                >
                  <el-icon><CircleClose /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </template>
          <template #default="{ row, $index }">
            <div
              v-if="editingCell?.rowIndex === $index && editingCell?.col === sIndex"
              class="b-cell-edit"
              @blur="onBCellBlur"
            >
              <el-input-number
                v-model="row.quantities[sIndex]"
                :min="0"
                :controls="false"
                class="qty-input"
                size="small"
                :ref="(el) => setColorCellRef(el, $index, sIndex)"
                @focus="setActiveColorCell($index, sIndex)"
                @keydown.stop="onColorCellKeydown($event, $index, sIndex)"
                @paste.stop.prevent="onColorCellPaste($event, $index, sIndex)"
              />
            </div>
            <div
              v-else
              class="b-cell-text"
              tabindex="0"
              @click="startEditBCell($index, sIndex)"
              @focus="startEditBCell($index, sIndex)"
            >
              {{ formatDisplayNumber(row.quantities[sIndex] ?? 0) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合计" width="80" align="center" header-align="center">
          <template #default="{ row }">
            {{ formatDisplayNumber(calcRowTotal(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120" align="center" header-align="center">
          <template #default="{ row, $index }">
            <div
              v-if="editingCell?.rowIndex === $index && editingCell?.col === 'remark'"
              class="b-cell-edit"
              @blur="onBCellBlur"
            >
              <el-input
                ref="remarkInputRef"
                v-model="row.remark"
                placeholder="备注"
                size="small"
                borderless
                @keydown.enter="editingCell = null"
              />
            </div>
            <div
              v-else
              class="b-cell-text"
              tabindex="0"
              @click="startEditBCell($index, 'remark')"
              @focus="startEditBCell($index, 'remark')"
            >
              {{ row.remark || '—' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center" header-align="center">
          <template #default="{ $index }">
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" size="small" circle @click="removeColorRow($index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- C 区：物料信息 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">C 物料信息</span>
          <el-button link type="primary" @click="addMaterialRow">新增物料</el-button>
        </div>
      </template>
      <el-table :data="materials" border size="small" class="materials-table">
        <el-table-column label="物料来源" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-select
              v-model="row.materialSourceId"
              placeholder="选择物料来源"
              filterable
              clearable
              :ref="(el) => setMaterialCellRef(el, $index, 0)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 0)"
            >
              <el-option
                v-for="opt in materialSourceOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="物料类型" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-select
              v-model="row.materialTypeId"
              placeholder="选择物料类型"
              filterable
              clearable
              @change="onMaterialTypeChange(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 1)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 1)"
            >
              <el-option
                v-for="opt in materialTypeOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="140" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-select
              v-model="row.supplierName"
              placeholder="选择或输入供应商"
              filterable
              allow-create
              default-first-option
              remote
              :remote-method="(kw: string) => searchMaterialSuppliers(kw, row)"
              :loading="supplierLoading"
              @visible-change="(visible: boolean) => onMaterialSupplierVisibleChange(visible, row)"
              @change="onSupplierChange(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 2)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 2)"
            >
              <el-option
                v-for="s in supplierOptions"
                :key="s.id"
                :label="s.name"
                :value="s.name"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="物料名称" min-width="160" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input
              v-model="row.materialName"
              placeholder="物料名称"
              :input-style="{ textAlign: 'center' }"
              :ref="(el) => setMaterialCellRef(el, $index, 3)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 3)"
            />
          </template>
        </el-table-column>
        <el-table-column label="颜色" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input
              v-model="row.color"
              placeholder="颜色"
              :input-style="{ textAlign: 'center' }"
              :ref="(el) => setMaterialCellRef(el, $index, 4)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 4)"
            />
          </template>
        </el-table-column>
        <el-table-column label="单件用量" width="100" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.usagePerPiece"
              :min="0"
              :precision="2"
              :controls="false"
              :input-style="{ textAlign: 'center' }"
              @update:modelValue="recalcPurchaseQuantity(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 5)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 5)"
            />
          </template>
        </el-table-column>
        <el-table-column label="损耗%" width="90" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.lossPercent"
              :min="0"
              :controls="false"
              :input-style="{ textAlign: 'center' }"
              @update:modelValue="recalcPurchaseQuantity(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 6)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 6)"
            />
          </template>
        </el-table-column>
        <el-table-column label="订单件数" width="100" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.orderPieces"
              :min="0"
              :controls="false"
              :input-style="{ textAlign: 'center' }"
              @update:modelValue="recalcPurchaseQuantity(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 7)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 7)"
            />
          </template>
        </el-table-column>
        <el-table-column label="采购总量" width="100" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.purchaseQuantity"
              :min="0"
              :precision="2"
              :controls="false"
              :input-style="{ textAlign: 'center' }"
              :readonly="true"
              :ref="(el) => setMaterialCellRef(el, $index, 8)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 8)"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input
              v-model="row.remark"
              placeholder="面料成分 / 克重等"
              :input-style="{ textAlign: 'center' }"
              :ref="(el) => setMaterialCellRef(el, $index, 9)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 9)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" header-align="center" align="center">
          <template #default="{ $index }">
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" size="small" circle @click="removeMaterialRow($index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- D 区：尺寸信息 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">D 尺寸信息</span>
          <div class="block-actions">
            <el-button link type="primary" @click="addSizeMetaColumn">新增部位列</el-button>
            <el-button link type="primary" @click="addSizeInfoRow">新增行</el-button>
            <el-button link type="primary" @click="copySizeInfoToClipboard">复制到剪贴板</el-button>
          </div>
        </div>
      </template>
      <el-table
        ref="sizeInfoTableRef"
        :data="sizeInfoRows"
        row-key="__rowKey"
        border
        size="small"
        class="size-info-table"
        header-align="center"
      >
        <el-table-column width="32" align="center" header-align="center">
          <template #default>
            <span class="size-row-drag-handle" title="拖拽排序">≡</span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="(header, idx) in sizeMetaHeaders"
          :key="'meta-' + idx"
          :label="header"
          min-width="100"
          align="center"
          header-align="center"
        >
          <template #header>
            <div class="b-header-cell">
              <el-input
                v-model="sizeMetaHeaders[idx]"
                size="small"
                class="b-header-input"
                @click.stop
              />
              <el-tooltip v-if="sizeMetaHeaders.length > 1" content="删除此列" placement="top">
                <el-button
                  link
                  type="danger"
                  size="small"
                  class="b-header-remove"
                  @click.stop="removeSizeMetaColumn(idx)"
                >
                  <el-icon><CircleClose /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </template>
          <template #default="{ row, $index }">
            <el-input
              v-model="row.metaValues[idx]"
              :ref="(el) => setSizeGridCellRef(el, $index, idx)"
              @keydown.stop="onSizeGridKeydown($event, $index, idx)"
              @paste.stop.prevent="onSizeGridPaste($event, $index, idx)"
            />
          </template>
        </el-table-column>
        <el-table-column
          v-for="(size, sIndex) in sizeHeaders"
          :key="'size-' + size"
          :label="size"
          min-width="72"
          align="center"
          header-align="center"
        >
          <template #header>
            <span>{{ sizeHeaders[sIndex] }}</span>
          </template>
          <template #default="{ row, $index }">
            <el-input
              v-model="row.sizeValues[sIndex]"
              size="small"
              :ref="(el) => setSizeGridCellRef(el, $index, sizeMetaHeaders.length + sIndex)"
              @keydown.stop="onSizeGridKeydown($event, $index, sizeMetaHeaders.length + sIndex)"
              @paste.stop.prevent="onSizeGridPaste($event, $index, sizeMetaHeaders.length + sIndex)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center" header-align="center">
          <template #default="{ $index }">
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" size="small" circle @click="removeSizeInfoRow($index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- E 区：工艺项目 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">E 工艺项目</span>
          <el-button link type="primary" @click="addProcessRow">新增工艺</el-button>
        </div>
      </template>
      <el-table :data="processItems" border class="process-items-table">
        <el-table-column label="工艺项目" min-width="160">
          <template #default="{ row }">
            <el-tree-select
              v-model="row.processName"
              placeholder="选择工艺项目"
              filterable
              clearable
              check-strictly
              :data="processOptions"
              :props="{ label: 'label', value: 'value', children: 'children' }"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="140">
          <template #default="{ row }">
            <el-select
              v-model="row.supplierName"
              placeholder="选择供应商"
              filterable
              clearable
              :remote-method="searchProcessSuppliers"
              remote
              :loading="supplierLoading"
            >
              <el-option
                v-for="s in supplierOptions"
                :key="s.id"
                :label="s.name"
                :value="s.name"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="部位" min-width="140">
          <template #default="{ row }">
            <el-input
              v-model="row.part"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              resize="none"
              placeholder="如：前幅 / 后幅 / 袖子"
            />
          </template>
        </el-table-column>
        <el-table-column label="工艺说明 / 备注" min-width="200">
          <template #default="{ row }">
            <el-input
              v-model="row.remark"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 8 }"
              resize="none"
              placeholder="说明 / 备注"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" size="small" circle @click="removeProcessRow($index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- F 区：生产要求 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">F 生产要求</span>
        </div>
      </template>
      <el-input
        v-model="productionRequirement"
        type="textarea"
        :rows="4"
        placeholder="填写文案、缝制难点、包装出货方式、分批出货、备注等生产要求"
      />
    </el-card>

    <!-- G 区：包装要求 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">G 包装要求</span>
          <el-button link type="primary" @click="addPackagingHeader">新增列</el-button>
        </div>
      </template>
      <div class="packaging-grid">
        <div
          v-for="(header, idx) in packagingHeaders"
          :key="header + idx"
          class="packaging-cell"
        >
          <div class="packaging-header">
            <el-input v-model="packagingHeaders[idx]" size="small" />
          </div>
          <div class="packaging-body">
            <div class="packaging-image" @click="triggerPackagingUpload(idx)">
              <img v-if="packagingCells[idx]?.imageUrl" :src="packagingCells[idx].imageUrl" alt="" />
              <span v-else>点击上传图片</span>
            </div>
            <el-input
              v-model="packagingCells[idx].accessoryName"
              placeholder="选择/填写辅料"
              size="small"
            >
              <template #suffix>
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click.stop="openAccessoryDialog(idx)"
                >
                  选择
                </el-button>
              </template>
            </el-input>
            <el-input
              v-model="packagingCells[idx].description"
              placeholder="信息备注"
              size="small"
            />
          </div>
          <div class="packaging-footer">
            <el-tooltip content="删除列" placement="top">
              <el-button link type="danger" size="small" circle @click="removePackagingHeader(idx)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div class="packaging-method">
        <span>包装方式：</span>
        <el-input v-model="packagingMethod" placeholder="如：每件单独装袋，每箱 20 件等" />
      </div>
      <input
        ref="packagingFileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden-file-input"
        @change="onPackagingFileChange"
      />
    </el-card>

    <AccessorySelectDialog
      v-model="accessoryDialogVisible"
      :loading="accessoryDialogLoading"
      :items="accessoryItems"
      @select="onSelectAccessory"
    />

    <SkuSelectDialog
      v-model="skuDialogVisible"
      :loading="skuDialogLoading"
      :items="skuProducts"
      :total="skuTotal"
      :page="skuPage"
      :page-size="skuPageSize"
      @select="onSelectSku"
      @page-change="onSkuPageChange"
      @page-size-change="onSkuPageSizeChange"
      @keyword-change="onSkuKeywordChange"
    />

    <CustomerSelectDialog
      v-model="customerDialogVisible"
      :loading="customerDialogLoading"
      :items="customerDialogList"
      :total="customerTotal"
      :page="customerPage"
      :page-size="customerPageSize"
      @select="onSelectCustomer"
      @page-change="onCustomerPageChange"
      @page-size-change="onCustomerPageSizeChange"
      @keyword-change="onCustomerKeywordChange"
    />

    <!-- H 区：图片附件 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">H 图片附件</span>
          <el-button link type="primary" @click="triggerAttachmentUpload">选择多图</el-button>
        </div>
      </template>
      <div class="attachments">
        <div
          v-for="(url, idx) in attachments"
          :key="url + idx"
          class="attachment-item"
          :class="{
            'is-dragging': draggingAttachmentIndex === idx,
            'is-drag-over': dragOverAttachmentIndex === idx,
          }"
          draggable="true"
          @dragstart="onAttachmentDragStart(idx, $event)"
          @dragover="onAttachmentDragOver(idx, $event)"
          @drop="onAttachmentDrop(idx, $event)"
          @dragend="onAttachmentDragEnd"
        >
          <AppImageThumb
            :raw-url="url"
            :width="120"
            :height="120"
            :preview-gallery="attachments"
            :preview-gallery-index="idx"
          />
          <el-tooltip content="删除" placement="top">
            <el-button
              link
              type="danger"
              size="small"
              class="attachment-remove"
              circle
              @click="removeAttachment(idx)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div v-if="!attachments.length" class="attachments-empty">暂无附件，可点击右上角选择上传</div>
      </div>
      <input
        ref="attachmentFileInputRef"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden-file-input"
        @change="onAttachmentFileChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AccessorySelectDialog from '@/components/orders/AccessorySelectDialog.vue'
import SkuSelectDialog from '@/components/orders/SkuSelectDialog.vue'
import CustomerSelectDialog from '@/components/orders/CustomerSelectDialog.vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createOrderDraft,
  getOrderDetail,
  submitOrder,
  updateOrderDraft,
  type OrderFormPayload,
} from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  getSupplierBusinessScopeTreeOptions,
  type SupplierBusinessScopeTreeNode,
} from '@/api/suppliers'
import { Delete, CircleClose, Plus } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { formatDisplayNumber } from '@/utils/display-number'
import { useOrderAttachments } from '@/composables/useOrderAttachments'
import { useOrderColorSizeMatrix } from '@/composables/useOrderColorSizeMatrix'
import { useOrderCustomerSelection } from '@/composables/useOrderCustomerSelection'
import { useOrderDetailHydration } from '@/composables/useOrderDetailHydration'
import { useOrderEditOptions } from '@/composables/useOrderEditOptions'
import { useOrderEditPayload } from '@/composables/useOrderEditPayload'
import { useOrderImageUpload } from '@/composables/useOrderImageUpload'
import { useOrderMaterials } from '@/composables/useOrderMaterials'
import { useOrderPackaging } from '@/composables/useOrderPackaging'
import { useOrderProcessItems } from '@/composables/useOrderProcessItems'
import { useOrderSizeInfo } from '@/composables/useOrderSizeInfo'
import { useOrderSkuSelection } from '@/composables/useOrderSkuSelection'

const route = useRoute()
const router = useRouter()

const {
  processOptions,
  salespersonOptions,
  merchandiserOptions,
  collaborationItems,
  collaborationOptions,
  orderTypeTree,
  orderTypeTreeSelectData,
  orderTypeTreeSelectProps,
  factoryOptions,
  customerOptions,
  userLoading,
  loadProcessOptions,
  loadSalespersonOptions,
  loadMerchandiserOptions,
  loadCollaborationOptions,
  loadOrderTypeTree,
  loadFactoryOptions,
  loadCustomerOptions,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  toOrderTypeTreeSelect,
} = useOrderEditOptions()

const {
  attachments,
  attachmentFileInputRef,
  draggingAttachmentIndex,
  dragOverAttachmentIndex,
  triggerAttachmentUpload,
  onAttachmentFileChange,
  removeAttachment,
  moveAttachment,
  onAttachmentDragStart,
  onAttachmentDragOver,
  onAttachmentDrop,
  onAttachmentDragEnd,
} = useOrderAttachments()

const {
  processItems,
  addProcessRow,
  removeProcessRow,
} = useOrderProcessItems()


/** 用于「再回订单编辑时打开上次编辑的订单」的 sessionStorage 键 */
const ORDERS_LAST_EDIT_ID = 'orders_last_edit_id'

const formRef = ref<FormInstance>()
const pageLoading = ref(false)

/** 是否有未保存的修改（用于离开前提示） */
const hasUnsavedChanges = ref(false)
/** 在 loadDetail / 初始化赋值时置 true，避免把“程序赋值”当成用户修改 */
let skipDirtyCheck = false

// 订单 ID：首次从路由参数初始化，之后在新建草稿成功后仅更新本地状态，避免再次路由跳转导致「新页面」感
const orderId = ref<number | undefined>(undefined)
// 订单当前状态：控制按钮显示（如提交后的订单不再显示「保存草稿」）
const orderStatus = ref<string>('draft')
const initialRouteId = route.params.id
if (initialRouteId) {
  const n = Number(initialRouteId)
  orderId.value = Number.isNaN(n) ? undefined : n
}

const orderNo = ref('')

const form = reactive<OrderFormPayload>({
  skuCode: '',
  xiaomanOrderNo: '',
  customerId: null,
  customerName: '',
  salesperson: '',
  merchandiser: '',
  merchandiserPhone: '',
  orderTypeId: null,
  collaborationTypeId: null,
  secondaryProcess: '',
  quantity: 0,
  exFactoryPrice: '',
  salePrice: '',
  orderDate: '',
  customerDueDate: '',
  imageUrl: '',
  colorSizeRows: [],
  colorSizeHeaders: [],
  materials: [],
  sizeInfoMetaHeaders: [],
  sizeInfoRows: [],
  processItems: [],
  productionRequirement: '',
  packagingHeaders: [],
  packagingCells: [],
  packagingMethod: '',
  attachments: [],
})

const {
  orderImageFileInputRef,
  triggerOrderImageUpload,
  onOrderImageFileChange,
} = useOrderImageUpload(form)

const {
  defaultPackagingHeaders,
  packagingHeaders,
  packagingCells,
  packagingMethod,
  packagingFileInputRef,
  accessoryDialogVisible,
  accessoryDialogLoading,
  accessoryItems,
  normalizePackagingCells,
  addPackagingHeader,
  removePackagingHeader,
  triggerPackagingUpload,
  onPackagingFileChange,
  openAccessoryDialog,
  onSelectAccessory,
} = useOrderPackaging()

const {
  materials,
  materialSourceOptions,
  materialTypeOptions,
  supplierOptions,
  supplierLoading,
  setMaterialCellRef,
  onMaterialCellKeydown,
  addMaterialRow,
  removeMaterialRow,
  loadMaterialTypes,
  loadMaterialSources,
  syncMaterialTypeIdsFromLabel,
  syncMaterialSourceIdsFromLabel,
  roundMaterialQty2,
  recalcPurchaseQuantity,
  onSupplierChange,
  searchProcessSuppliers,
  onMaterialTypeChange,
  onMaterialSupplierVisibleChange,
  searchMaterialSuppliers,
} = useOrderMaterials()

const rules: FormRules = {
  skuCode: [{ required: true, message: '请选择 SKU', trigger: 'change' }],
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  collaborationTypeId: [{ required: true, message: '请选择合作方式', trigger: 'change' }],
  orderTypeId: [{ required: true, message: '请选择订单类型', trigger: 'change' }],
  customerDueDate: [{ required: true, message: '请选择客户交期', trigger: 'change' }],
  salePrice: [
    {
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
        const str = String(value ?? '').trim()
        if (!str) return callback(new Error('请填写销售价'))
        const num = Number(str)
        if (!Number.isFinite(num) || num <= 0) return callback(new Error('销售价需大于 0'))
        return callback()
      },
      trigger: 'blur',
    },
  ],
  merchandiser: [{ required: true, message: '请选择跟单员', trigger: 'change' }],
}

// SKU 选择弹窗（从产品列表中选择）
const {
  customerLoading,
  customerDialogVisible,
  customerDialogLoading,
  customerDialogList,
  selectedCustomer,
  customerTotal,
  customerPage,
  customerPageSize,
  customerDisplayText,
  openCustomerDialog,
  onSelectCustomer,
  clearSelectedCustomer,
  ensureCustomerById,
  onCustomerPageChange,
  onCustomerPageSizeChange,
  onCustomerKeywordChange,
} = useOrderCustomerSelection(form)

const {
  skuDialogVisible,
  skuDialogLoading,
  skuProducts,
  skuTotal,
  skuPage,
  skuPageSize,
  skuProductGroupName,
  skuApplicablePeopleName,
  selectedSkuMeta,
  openSkuDialog,
  onSkuPageChange,
  onSkuPageSizeChange,
  onSelectSku,
  onSkuKeywordChange,
} = useOrderSkuSelection(form, selectedCustomer, ensureCustomerById)

const {
  defaultSizeHeaders,
  sizeHeaders,
  colorRows,
  editingCell,
  bTableRef,
  colorNameInputRef,
  remarkInputRef,
  setColorCellRef,
  setActiveColorCell,
  startEditBCell,
  onBCellBlur,
  onColorCellKeydown,
  parseClipboardText,
  onColorCellPaste,
  normalizeColorRows,
  ensureAtLeastOneColorRow,
  addColorRow,
  removeColorRow,
  addSizeColumn,
  insertSizeColumnBefore,
  removeSizeColumn,
  grandTotal,
  calcRowTotal,
  bSummaryMethod,
} = useOrderColorSizeMatrix({
  onSizeHeadersChange: () => normalizeSizeInfoRows(),
})

const {
  defaultSizeMetaHeaders,
  sizeMetaHeaders,
  sizeInfoRows,
  sizeInfoTableRef,
  setSizeGridCellRef,
  onSizeGridKeydown,
  onSizeGridPaste,
  normalizeSizeInfoRows,
  addSizeInfoRow,
  removeSizeInfoRow,
  initSizeInfoSortable,
  destroySizeInfoSortable,
  addSizeMetaColumn,
  removeSizeMetaColumn,
  copySizeInfoToClipboard,
  nextSizeInfoRowKey,
} = useOrderSizeInfo({
  sizeHeaders,
  parseClipboardText,
})

function onMerchandiserChange(val: string) {
  const u = merchandiserOptions.value.find((x) => (x.displayName || x.username) === val)
  if (u?.mobile && !form.merchandiserPhone) {
    form.merchandiserPhone = u.mobile
  }
}

// B 区：颜色 / 数量
const productionRequirement = ref('')

const {
  collectPayload,
} = useOrderEditPayload({
  form,
  formRef,
  grandTotal,
  colorRows,
  sizeHeaders,
  materials,
  sizeMetaHeaders,
  sizeInfoRows,
  processItems,
  productionRequirement,
  packagingHeaders,
  packagingCells,
  packagingMethod,
  attachments,
})

const {
  hydrateOrderDetail,
} = useOrderDetailHydration({
  form,
  orderNo,
  orderStatus,
  skuProductGroupName,
  skuApplicablePeopleName,
  ensureCustomerById,
  defaultSizeHeaders,
  sizeHeaders,
  colorRows,
  normalizeColorRows,
  ensureAtLeastOneColorRow,
  materials,
  roundMaterialQty2,
  recalcPurchaseQuantity,
  defaultSizeMetaHeaders,
  sizeMetaHeaders,
  sizeInfoRows,
  nextSizeInfoRowKey,
  normalizeSizeInfoRows,
  processItems,
  productionRequirement,
  defaultPackagingHeaders,
  packagingHeaders,
  packagingCells,
  normalizePackagingCells,
  packagingMethod,
  attachments,
})

// G 区：包装要求
// H 区：图片附件
// 监听表单与各区块数据变化，用于离开前未保存提示（程序赋值时用 skipDirtyCheck 忽略）
watch(
  () => [
    form,
    colorRows.value,
    sizeHeaders.value,
    materials.value,
    sizeMetaHeaders.value,
    sizeInfoRows.value,
    processItems.value,
    productionRequirement.value,
    packagingHeaders.value,
    packagingCells.value,
    packagingMethod.value,
    attachments.value,
  ],
  () => {
    if (!skipDirtyCheck) hasUnsavedChanges.value = true
  },
  { deep: true },
)

onBeforeRouteLeave((_to, _from, next) => {
  if (!hasUnsavedChanges.value) return next()
  ElMessageBox.confirm('当前有未保存的内容，离开后将无法恢复，确定要离开吗？', '提示', {
    confirmButtonText: '确定离开',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => next())
    .catch(() => next(false))
})

// 订单图片点击上传
const saving = ref(false)
const submitting = ref(false)

async function onSaveDraft() {
  const payload = await collectPayload().catch(() => undefined)
  if (!payload) return
  saving.value = true
  try {
    if (orderId.value) {
      const res = await updateOrderDraft(orderId.value, payload)
      ElMessage.success('草稿已保存')
      orderStatus.value = (res.data as any)?.status ?? orderStatus.value
      orderNo.value = res.data?.orderNo ?? orderNo.value
      hasUnsavedChanges.value = false
      sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(orderId.value))
    } else {
      const res = await createOrderDraft(payload)
      ElMessage.success('草稿已创建')
      const id = res.data?.id
      orderStatus.value = (res.data as any)?.status ?? 'draft'
      orderNo.value = res.data?.orderNo ?? ''
      if (id) {
        orderId.value = id
        sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(id))
        // 将 URL 更新为带 id 的编辑页，切到别页再切回同一标签时仍为该订单，不会变成空白新建页
        const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
        const title = `订单编辑 ${orderNo.value || id}`
        router.replace({ name: 'OrdersEdit', params: { id: String(id) }, query: { tabKey, tabTitle: title } })
      }
      hasUnsavedChanges.value = false
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function onSaveAndSubmit() {
  const payload = await collectPayload().catch(() => undefined)
  if (!payload) return
  submitting.value = true
  try {
    if (orderId.value) {
      await updateOrderDraft(orderId.value, payload)
      const res = await submitOrder(orderId.value)
      ElMessage.success('提交成功')
      orderNo.value = res.data?.orderNo ?? orderNo.value
      orderStatus.value = (res.data as any)?.status ?? orderStatus.value
      hasUnsavedChanges.value = false
      sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(orderId.value))
    } else {
      const draftRes = await createOrderDraft(payload)
      const id = draftRes.data?.id
      if (id) {
        orderId.value = id
        sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(id))
        const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
        const title = `订单编辑 ${draftRes.data?.orderNo || id}`
        router.replace({ name: 'OrdersEdit', params: { id: String(id) }, query: { tabKey, tabTitle: title } })
        const res = await submitOrder(id)
        orderNo.value = res.data?.orderNo ?? draftRes.data?.orderNo ?? ''
        ElMessage.success('提交成功')
        orderStatus.value = (res.data as any)?.status ?? orderStatus.value
        hasUnsavedChanges.value = false
      }
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitting.value = false
  }
}

async function loadDetail() {
  if (!orderId.value) {
    const today = new Date()
    const iso = today.toISOString().slice(0, 10)
    form.orderDate = iso
    // B 区默认必须有一行，避免每次都要点「新增颜色」
    ensureAtLeastOneColorRow()
    return
  }
  try {
    skipDirtyCheck = true
    const res = await getOrderDetail(orderId.value)
    const d = res.data
    if (!d) return
    await hydrateOrderDetail(d)
    sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(orderId.value))
    nextTick(() => {
      hasUnsavedChanges.value = false
      skipDirtyCheck = false
    })
  } catch (e: unknown) {
    skipDirtyCheck = false
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function goBack() {
  router.push({ name: 'OrdersList' })
}

onMounted(async () => {
  // 明确「新建订单」入口：清除上次编辑 id，显示空白表单
  if (route.query.new === '1') {
    sessionStorage.removeItem(ORDERS_LAST_EDIT_ID)
  }
  // 从侧边栏/菜单点「订单编辑」且无 id 时：若有上次编辑的订单，则进入该订单编辑页，保持内容一致
  if (!route.params.id && route.query.new !== '1') {
    const lastId = sessionStorage.getItem(ORDERS_LAST_EDIT_ID)
    if (lastId) {
      const n = Number(lastId)
      if (!Number.isNaN(n) && n > 0) {
        const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
        const title = typeof route.query?.tabTitle === 'string' ? route.query.tabTitle : undefined
        router.replace({ name: 'OrdersEdit', params: { id: lastId }, query: { tabKey, tabTitle: title } })
        orderId.value = n
      }
    }
  }

  if (orderId.value) {
    pageLoading.value = true
  }
  try {
    // 基础选项 + 订单详情并行加载，避免先渲染一整页空表单再等待详情返回
    await Promise.all([
      (async () => {
        await Promise.all([
          loadCollaborationOptions(),
          loadOrderTypeTree(),
          loadSalespersonOptions(),
          loadMerchandiserOptions(),
        ])
        await loadMaterialTypes()
        await loadMaterialSources()
        await searchProcessSuppliers('')
        await loadProcessOptions()
      })(),
      loadDetail(),
    ])
    syncMaterialTypeIdsFromLabel()

    // 物料来源：兼容历史/迁移数据中仅存名称的情况
    syncMaterialSourceIdsFromLabel()
    // 新建订单时业务员默认为当前登录账号，并保证下拉中可选项包含当前用户
    if (!orderId.value) {
      const authStore = useAuthStore()
      if (authStore.user) {
        const label = authStore.user.displayName || authStore.user.username
        if (!form.salesperson) form.salesperson = label
        const exists = salespersonOptions.value.some(
          (u) => (u.displayName || u.username) === label
        )
        if (!exists) {
          salespersonOptions.value.unshift({
            id: authStore.user.id,
            username: authStore.user.username,
            displayName: authStore.user.displayName ?? '',
          })
        }
      }
    }
  } finally {
    pageLoading.value = false
    initSizeInfoSortable()
    // 初始化完成后不视为“未保存”，避免新建订单的默认值触发离开提示
    nextTick(() => {
      hasUnsavedChanges.value = false
      skipDirtyCheck = false
    })
  }
})

watch(
  () => sizeInfoRows.value.length,
  () => {
    initSizeInfoSortable()
  },
)

onBeforeUnmount(() => {
  destroySizeInfoSortable()
})
</script>

<style scoped>
.order-edit-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.page-header .left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.page-header .title {
  font-size: var(--font-size-title, 20px);
  font-weight: 600;
}

.page-header .sub-title {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
}

.page-header .right {
  display: flex;
  gap: var(--space-sm);
}

.block-card {
  margin-bottom: var(--space-md);
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.block-title {
  font-weight: 600;
}

.block-actions {
  display: flex;
  gap: var(--space-xs);
}

.a-area-row {
  align-items: stretch;
}

.a-area-image-col {
  flex-shrink: 0;
  display: flex;
}

.order-image-block {
  width: 100%;
  max-width: 220px;
  flex: 1 0 auto;
  cursor: pointer;
  border-radius: var(--radius);
}

.image-upload-hint {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-primary, #409eff);
}

.basic-form {
  margin-top: 0;
}

/* A 区表单：统一字段宽度，保持每列控件等宽 */
.basic-form :deep(.el-form-item__content) {
  width: 100%;
}

.basic-form :deep(.el-input),
.basic-form :deep(.el-select),
.basic-form :deep(.el-date-editor),
.basic-form :deep(.el-input-number),
.basic-form :deep(.el-tree-select) {
  width: 100%;
}

.image-preview-wrap {
  width: 100%;
  height: 100%;
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
}

.image-preview-wrap :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.image-preview-wrap :deep(.el-image__inner) {
  object-fit: contain;
}

.image-remove {
  position: absolute;
  right: 4px;
  bottom: 4px;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--radius);
  border: 1px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: var(--font-size-body, 14px);
  color: var(--color-text-muted, #909399);
  text-align: center;
  padding: 6px;
}

.image-actions {
  flex: 1;
  min-width: 0;
}

.option-main {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.option-primary {
  font-weight: 500;
}

.option-secondary {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
}

.qty-input {
  width: 100%;
}

/* B 区：点击才编辑、表头删列 */
.b-cell-text {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: text;
  outline: none;
  padding: 0 8px;
}
.b-cell-text:focus {
  outline: none;
}
.b-cell-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.b-cell-edit .el-input,
.b-cell-edit .el-input-number {
  width: 100%;
}
.b-header-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding-left: 10px;
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
  /* 放在“输入框右侧预留空白(10px)”内，不遮挡输入框 */
  right: 2px;
  transform: translateY(-50%);
  width: 6px;
  height: 10px;
  padding: 0;
  min-height: 10px;
  min-width: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.b-header-insert {
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  width: 6px;
  height: 10px;
  padding: 0;
  min-height: 10px;
  min-width: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.b-header-insert :deep(.el-icon) {
  font-size: 8px;
  line-height: 8px;
}
.b-header-remove :deep(.el-icon) {
  font-size: 8px;
  line-height: 8px;
}
.b-header-cell:hover .b-header-insert,
.b-header-cell:hover .b-header-remove {
  opacity: 1;
}

.materials-table :deep(.el-table__cell) {
  padding: 4px 6px;
}

.materials-table :deep(.el-input),
.materials-table :deep(.el-select),
.materials-table :deep(.el-input-number) {
  width: 100%;
}

.materials-table :deep(.el-input__inner),
.materials-table :deep(.el-input-number__inner),
.materials-table :deep(.el-select .el-select__selected-item) {
  text-align: center;
}

.materials-table :deep(.el-select .el-select__wrapper) {
  justify-content: center;
}

/* D 区尺寸信息：表头与内容居中，输入框随列宽收缩、不遮挡 */
.size-info-table :deep(.el-table__cell) {
  padding: 4px 6px;
  min-width: 0;
}
.size-info-table :deep(.el-input),
.size-info-table :deep(.el-input-number) {
  width: 100%;
  min-width: 0;
}
.size-info-table :deep(.el-input__wrapper),
.size-info-table :deep(.el-input-number .el-input__wrapper) {
  padding-left: 4px;
  padding-right: 4px;
}
.size-info-table :deep(.el-input__inner),
.size-info-table :deep(.el-input-number .el-input__inner) {
  text-align: center;
}
.size-row-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  margin-right: 4px;
  color: var(--el-text-color-secondary);
  cursor: move;
  user-select: none;
}

.packaging-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-sm);
}

.packaging-cell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-xs);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.packaging-header {
  font-weight: 500;
}

.packaging-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.packaging-image {
  height: 96px;
  border-radius: var(--radius);
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.packaging-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.packaging-footer {
  display: flex;
  justify-content: flex-end;
}

.packaging-method {
  margin-top: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.packaging-method > span {
  flex: 0 0 auto;
  white-space: nowrap;
}

.packaging-method :deep(.el-input) {
  flex: 0 1 92%;
  max-width: 92%;
}

.accessory-dialog-filter {
  margin-bottom: var(--space-sm);
}

.sku-dialog-filter {
  margin-bottom: var(--space-sm);
}

.customer-dialog-filter {
  margin-bottom: var(--space-sm);
}

.dialog-pagination {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}

.dialog-select-table :deep(.el-table__row) {
  height: 44px;
}

.dialog-select-table :deep(.el-table__cell) {
  height: 44px;
  padding-top: 0;
  padding-bottom: 0;
}

.process-items-table :deep(.el-table__cell) {
  vertical-align: top;
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.attachment-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--color-border);
  cursor: grab;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.attachment-item.is-dragging {
  opacity: 0.65;
  cursor: grabbing;
}

.attachment-item.is-drag-over {
  border-color: var(--color-primary, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.22);
}

.attachment-remove {
  position: absolute;
  right: 4px;
  bottom: 4px;
}

.attachments-empty {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
}

.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>

