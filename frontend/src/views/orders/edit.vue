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

    <OrderEditColorSizeCard
      :b-table-ref="bTableRef"
      :color-rows="colorRows"
      :size-headers="sizeHeaders"
      :editing-cell="editingCell"
      :color-name-input-ref="colorNameInputRef"
      :remark-input-ref="remarkInputRef"
      :b-summary-method="bSummaryMethod"
      :add-size-column="addSizeColumn"
      :add-color-row="addColorRow"
      :start-edit-b-cell="startEditBCell"
      :on-b-cell-blur="onBCellBlur"
      :insert-size-column-before="insertSizeColumnBefore"
      :remove-size-column="removeSizeColumn"
      :set-color-cell-ref="setColorCellRef"
      :set-active-color-cell="setActiveColorCell"
      :on-color-cell-keydown="onColorCellKeydown"
      :on-color-cell-paste="onColorCellPaste"
      :calc-row-total="calcRowTotal"
      :remove-color-row="removeColorRow"
      :set-editing-cell-null="setEditingCellNull"
    />

    <OrderEditMaterialsCard
      :materials="materials"
      :material-source-options="materialSourceOptions"
      :material-type-options="materialTypeOptions"
      :supplier-options="supplierOptions"
      :supplier-loading="supplierLoading"
      :set-material-cell-ref="setMaterialCellRef"
      :on-material-cell-keydown="onMaterialCellKeydown"
      :add-material-row="addMaterialRow"
      :remove-material-row="removeMaterialRow"
      :recalc-purchase-quantity="recalcPurchaseQuantity"
      :on-supplier-change="onSupplierChange"
      :on-material-type-change="onMaterialTypeChange"
      :on-material-supplier-visible-change="onMaterialSupplierVisibleChange"
      :search-material-suppliers="searchMaterialSuppliers"
    />

    <OrderEditSizeInfoCard
      :size-info-table-ref="sizeInfoTableRef"
      :size-info-rows="sizeInfoRows"
      :size-meta-headers="sizeMetaHeaders"
      :size-headers="sizeHeaders"
      :set-size-grid-cell-ref="setSizeGridCellRef"
      :on-size-grid-keydown="onSizeGridKeydown"
      :on-size-grid-paste="onSizeGridPaste"
      :add-size-meta-column="addSizeMetaColumn"
      :remove-size-meta-column="removeSizeMetaColumn"
      :add-size-info-row="addSizeInfoRow"
      :remove-size-info-row="removeSizeInfoRow"
      :copy-size-info-to-clipboard="copySizeInfoToClipboard"
    />

    <OrderEditProcessItemsCard
      :process-items="processItems"
      :process-options="processOptions"
      :supplier-options="supplierOptions"
      :supplier-loading="supplierLoading"
      :add-process-row="addProcessRow"
      :remove-process-row="removeProcessRow"
      :search-process-suppliers="searchProcessSuppliers"
    />

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

    <OrderEditPackagingCard
      :packaging-headers="packagingHeaders"
      :packaging-cells="packagingCells"
      v-model:packaging-method="packagingMethod"
      :packaging-file-input-ref="packagingFileInputRef"
      :add-packaging-header="addPackagingHeader"
      :remove-packaging-header="removePackagingHeader"
      :trigger-packaging-upload="triggerPackagingUpload"
      :on-packaging-file-change="onPackagingFileChange"
      :open-accessory-dialog="openAccessoryDialog"
    />

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

    <OrderEditAttachmentsCard
      :attachments="attachments"
      :attachment-file-input-ref="attachmentFileInputRef"
      :dragging-attachment-index="draggingAttachmentIndex"
      :drag-over-attachment-index="dragOverAttachmentIndex"
      :trigger-attachment-upload="triggerAttachmentUpload"
      :on-attachment-file-change="onAttachmentFileChange"
      :remove-attachment="removeAttachment"
      :on-attachment-drag-start="onAttachmentDragStart"
      :on-attachment-drag-over="onAttachmentDragOver"
      :on-attachment-drop="onAttachmentDrop"
      :on-attachment-drag-end="onAttachmentDragEnd"
    />
  </div>
</template>

<script setup lang="ts">
import AccessorySelectDialog from '@/components/orders/AccessorySelectDialog.vue'
import SkuSelectDialog from '@/components/orders/SkuSelectDialog.vue'
import CustomerSelectDialog from '@/components/orders/CustomerSelectDialog.vue'
import OrderEditColorSizeCard from '@/components/orders/edit/OrderEditColorSizeCard.vue'
import OrderEditMaterialsCard from '@/components/orders/edit/OrderEditMaterialsCard.vue'
import OrderEditSizeInfoCard from '@/components/orders/edit/OrderEditSizeInfoCard.vue'
import OrderEditProcessItemsCard from '@/components/orders/edit/OrderEditProcessItemsCard.vue'
import OrderEditPackagingCard from '@/components/orders/edit/OrderEditPackagingCard.vue'
import OrderEditAttachmentsCard from '@/components/orders/edit/OrderEditAttachmentsCard.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { useOrderEditPage } from '@/composables/useOrderEditPage'

const { pageLoading, goBack, orderNo, orderStatus, saving, submitting, onSaveDraft, onSaveAndSubmit, form, rules, openSkuDialog, orderImageFileInputRef, triggerOrderImageUpload, onOrderImageFileChange, selectedSkuMeta, collaborationOptions, orderTypeTreeSelectData, orderTypeTreeSelectProps, customerDisplayText, customerLoading, clearSelectedCustomer, openCustomerDialog, userLoading, merchandiserOptions, salespersonOptions, onMerchandiserChange, bTableRef, colorRows, sizeHeaders, editingCell, colorNameInputRef, remarkInputRef, bSummaryMethod, addSizeColumn, addColorRow, startEditBCell, onBCellBlur, insertSizeColumnBefore, removeSizeColumn, setColorCellRef, setActiveColorCell, onColorCellKeydown, onColorCellPaste, calcRowTotal, removeColorRow, setEditingCellNull, materials, materialSourceOptions, materialTypeOptions, supplierOptions, supplierLoading, setMaterialCellRef, onMaterialCellKeydown, addMaterialRow, removeMaterialRow, recalcPurchaseQuantity, onSupplierChange, onMaterialTypeChange, onMaterialSupplierVisibleChange, searchMaterialSuppliers, sizeInfoTableRef, sizeInfoRows, sizeMetaHeaders, setSizeGridCellRef, onSizeGridKeydown, onSizeGridPaste, addSizeMetaColumn, removeSizeMetaColumn, addSizeInfoRow, removeSizeInfoRow, copySizeInfoToClipboard, processItems, processOptions, addProcessRow, removeProcessRow, searchProcessSuppliers, productionRequirement, packagingHeaders, packagingCells, packagingMethod, packagingFileInputRef, addPackagingHeader, removePackagingHeader, triggerPackagingUpload, onPackagingFileChange, openAccessoryDialog, accessoryDialogVisible, accessoryDialogLoading, accessoryItems, onSelectAccessory, skuDialogVisible, skuDialogLoading, skuProducts, skuTotal, skuPage, skuPageSize, onSelectSku, onSkuPageChange, onSkuPageSizeChange, onSkuKeywordChange, customerDialogVisible, customerDialogLoading, customerDialogList, customerTotal, customerPage, customerPageSize, onSelectCustomer, onCustomerPageChange, onCustomerPageSizeChange, onCustomerKeywordChange, attachments, attachmentFileInputRef, draggingAttachmentIndex, dragOverAttachmentIndex, triggerAttachmentUpload, onAttachmentFileChange, removeAttachment, onAttachmentDragStart, onAttachmentDragOver, onAttachmentDrop, onAttachmentDragEnd } = useOrderEditPage()
</script>

<style scoped src="./edit.css"></style>

