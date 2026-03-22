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
              <el-image :src="form.imageUrl" fit="cover" :preview-src-list="[form.imageUrl]" />
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
              <el-select
                v-model="form.customerId"
                placeholder="选择客户"
                filterable
                remote
                clearable
                :remote-method="searchCustomers"
                :loading="customerLoading"
              >
                <el-option
                  v-for="item in customerOptions"
                  :key="item.id"
                  :label="item.companyName"
                  :value="item.id"
                />
              </el-select>
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
            <el-form-item label="跟单员">
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
            <el-form-item label="跟单电话">
              <el-input v-model="form.merchandiserPhone" placeholder="自动带出后可修改" />
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
              {{ row.quantities[sIndex] ?? 0 }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合计" width="80" align="center" header-align="center">
          <template #default="{ row }">
            {{ calcRowTotal(row) }}
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
        <el-table-column label="物料类型" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-select
              v-model="row.materialTypeId"
              placeholder="选择物料类型"
              filterable
              clearable
              @change="onMaterialTypeChange(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 0)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 0)"
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
              :ref="(el) => setMaterialCellRef(el, $index, 1)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 1)"
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
              :ref="(el) => setMaterialCellRef(el, $index, 2)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 2)"
            />
          </template>
        </el-table-column>
        <el-table-column label="颜色" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input
              v-model="row.color"
              placeholder="颜色"
              :input-style="{ textAlign: 'center' }"
              :ref="(el) => setMaterialCellRef(el, $index, 3)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 3)"
            />
          </template>
        </el-table-column>
        <el-table-column label="单件用量" width="100" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.usagePerPiece"
              :min="0"
              :controls="false"
              :input-style="{ textAlign: 'center' }"
              @update:modelValue="recalcPurchaseQuantity(row)"
              :ref="(el) => setMaterialCellRef(el, $index, 4)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 4)"
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
              :ref="(el) => setMaterialCellRef(el, $index, 5)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 5)"
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
              :ref="(el) => setMaterialCellRef(el, $index, 6)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 6)"
            />
          </template>
        </el-table-column>
        <el-table-column label="采购总量" width="100" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.purchaseQuantity"
              :min="0"
              :controls="false"
              :input-style="{ textAlign: 'center' }"
              :readonly="true"
              :ref="(el) => setMaterialCellRef(el, $index, 7)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 7)"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120" header-align="center" align="center">
          <template #default="{ row, $index }">
            <el-input
              v-model="row.remark"
              placeholder="面料成分 / 克重等"
              :input-style="{ textAlign: 'center' }"
              :ref="(el) => setMaterialCellRef(el, $index, 8)"
              @keydown.capture.stop="onMaterialCellKeydown($event, $index, 8)"
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
      <el-table :data="sizeInfoRows" border size="small" class="size-info-table" header-align="center">
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
            <el-input-number
              v-model="row.sizeValues[sIndex]"
              :min="0"
              :controls="false"
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
      <el-table :data="processItems" border>
        <el-table-column label="工艺项目" min-width="160">
          <template #default="{ row }">
            <el-select
              v-model="row.processName"
              placeholder="选择工艺项目"
              filterable
              clearable
            >
              <el-option
                v-for="p in processOptions"
                :key="p"
                :label="p"
                :value="p"
              />
            </el-select>
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
            <el-input v-model="row.part" placeholder="如：前幅 / 后幅 / 袖子" />
          </template>
        </el-table-column>
        <el-table-column label="工艺说明 / 备注" min-width="200">
          <template #default="{ row }">
            <el-input v-model="row.remark" placeholder="说明 / 备注" />
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

    <el-dialog
      v-model="accessoryDialogVisible"
      title="选择辅料"
      width="720px"
    >
      <div class="accessory-dialog-filter">
        <el-input
          v-model="accessoryKeyword"
          placeholder="输入名称 / 类别 / 客户名进行模糊搜索"
          clearable
          size="small"
        />
      </div>
      <el-table
        v-loading="accessoryDialogLoading"
        :data="filteredAccessoryItems"
        height="360px"
        border
      >
        <el-table-column label="图片" width="90">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              fit="cover"
              style="width: 64px; height: 64px"
            />
            <span v-else>无</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="customerName" label="客户" min-width="140" />
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="onSelectAccessory(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="accessoryDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="skuDialogVisible"
      title="选择 SKU"
      width="720px"
    >
      <div class="sku-dialog-filter">
        <el-input
          v-model="skuKeyword"
          placeholder="输入 SKU 编号或客户名称进行模糊搜索"
          clearable
          size="small"
        />
      </div>
      <el-table
        v-loading="skuDialogLoading"
        :data="filteredSkuProducts"
        height="360px"
        border
      >
        <el-table-column label="图片" width="90">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              fit="cover"
              style="width: 64px; height: 64px"
            />
            <span v-else>无</span>
          </template>
        </el-table-column>
        <el-table-column prop="skuCode" label="SKU 编号" min-width="140" />
        <el-table-column prop="productName" label="产品名称" min-width="160" />
        <el-table-column
          prop="customer.companyName"
          label="客户"
          min-width="160"
        >
          <template #default="{ row }">
            {{ row.customer?.companyName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="onSelectSku(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="skuDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

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
        >
          <el-image :src="url" fit="cover" :preview-src-list="attachments" />
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
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
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
import request, { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSupplierBusinessScopeOptions } from '@/api/suppliers'
import { uploadImage } from '@/api/uploads'
import { getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'
import { getDictItems } from '@/api/dicts'
import { Delete, CircleClose } from '@element-plus/icons-vue'
import { getAccessoriesList, type AccessoryItem } from '@/api/inventory'
import { getProducts, type ProductItem } from '@/api/products'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()

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
}

// SKU 选择弹窗（从产品列表中选择）
const skuDialogVisible = ref(false)
const skuDialogLoading = ref(false)
const skuKeyword = ref('')
const skuProducts = ref<ProductItem[]>([])
const skuProductGroupName = ref('')
const skuApplicablePeopleName = ref('')

function toLeafOptionLabel(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const parts = raw
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : raw
}

const selectedSkuMeta = computed(() => {
  const sku = String(form.skuCode ?? '').trim()
  if (!sku) {
    return {
      productGroupName: toLeafOptionLabel(skuProductGroupName.value),
      applicablePeopleName: skuApplicablePeopleName.value,
    }
  }
  const matched = skuProducts.value.find((item) => String(item.skuCode ?? '').trim() === sku)
  if (matched) {
    return {
      productGroupName: toLeafOptionLabel(matched.productGroup ?? ''),
      applicablePeopleName: matched.applicablePeople ?? '',
    }
  }
  return {
    productGroupName: toLeafOptionLabel(skuProductGroupName.value),
    applicablePeopleName: skuApplicablePeopleName.value,
  }
})

const filteredSkuProducts = computed(() => {
  const kw = skuKeyword.value.trim().toLowerCase()
  if (!kw) return skuProducts.value
  return skuProducts.value.filter((item) => {
    const sku = item.skuCode?.toLowerCase?.() ?? ''
    const customer = item.customer?.companyName?.toLowerCase?.() ?? ''
    return sku.includes(kw) || customer.includes(kw)
  })
})

async function loadSkuProducts() {
  skuDialogLoading.value = true
  try {
    const res = await getProducts({ page: 1, pageSize: 200 })
    const data = res.data
    skuProducts.value = data?.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('SKU 产品列表加载失败', getErrorMessage(e))
  } finally {
    skuDialogLoading.value = false
  }
}

/**
 * 统一的 SKU 初始化入口。
 * 当前仅在页面挂载时用于预加载产品列表，后续若需要按关键字远程搜索，可在此扩展查询参数。
 */
async function searchSkus(_keyword: string) {
  if (!skuProducts.value.length) {
    await loadSkuProducts()
  }
}

async function openSkuDialog() {
  skuDialogVisible.value = true
  if (!skuProducts.value.length) {
    await loadSkuProducts()
  }
}

function onSelectSku(row: ProductItem) {
  form.skuCode = row.skuCode
  skuProductGroupName.value = row.productGroup ?? ''
  skuApplicablePeopleName.value = row.applicablePeople ?? ''
  if (row.imageUrl && !form.imageUrl) {
    form.imageUrl = row.imageUrl
  }
  if (row.customerId && row.customer?.companyName) {
    form.customerId = row.customerId
    form.customerName = row.customer.companyName
    if (!customerOptions.value.some((c) => c.id === row.customerId)) {
      customerOptions.value.unshift({ id: row.customerId, companyName: row.customer.companyName })
    }
  }
  skuDialogVisible.value = false
}

// 客户下拉
const customerOptions = ref<{ id: number; companyName: string }[]>([])
const customerLoading = ref(false)

async function searchCustomers(keyword: string) {
  customerLoading.value = true
  try {
    const res = await request.get('/customers', {
      params: { keyword: keyword || undefined, pageSize: 20 },
      skipGlobalErrorHandler: true,
    })
    const data = res.data as { list?: { id: number; companyName: string }[] }
    customerOptions.value = data.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('客户下拉加载失败', getErrorMessage(e))
  } finally {
    customerLoading.value = false
  }
}

// 业务员 / 跟单员
interface SimpleUser {
  id: number
  username: string
  displayName?: string
  mobile?: string
}

const salespersonOptions = ref<SimpleUser[]>([])
const merchandiserOptions = ref<SimpleUser[]>([])
const userLoading = ref(false)

async function loadUserOptions() {
  userLoading.value = true
  try {
    const [salesRes, merchRes] = await Promise.all([
      request.get<SimpleUser[]>('/users', { params: { role: 'salesperson' }, skipGlobalErrorHandler: true }),
      request.get<SimpleUser[]>('/users', { params: { role: 'merchandiser' }, skipGlobalErrorHandler: true }),
    ])
    salespersonOptions.value = salesRes.data ?? []
    merchandiserOptions.value = merchRes.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('用户下拉加载失败', getErrorMessage(e))
  } finally {
    userLoading.value = false
  }
}

function onMerchandiserChange(val: string) {
  const u = merchandiserOptions.value.find((x) => (x.displayName || x.username) === val)
  if (u?.mobile && !form.merchandiserPhone) {
    form.merchandiserPhone = u.mobile
  }
}

// 合作方式 / 订单类型
const collaborationOptions = ref<{ id: number; label: string }[]>([])
// 订单类型采用树形结构，与「订单设置 > 订单类型」一致
const orderTypeTree = ref<SystemOptionTreeNode[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: any[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}

const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

function findOrderTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id === id) return node.value
    if (node.children?.length) stack.push(...node.children)
  }
  return ''
}

const orderTypeTreeSelectProps = {
  label: 'label',
  value: 'value',
  children: 'children',
  disabled: 'disabled',
}

async function loadDicts() {
  // 合作方式、订单类型分别加载，与订单列表筛选项同源（订单类型用同一接口），互不影响
  const [collabSettled, orderTypeSettled] = await Promise.allSettled([
    getDictItems('collaboration'),
    getSystemOptionsTree('order_types'),
  ])
  if (collabSettled.status === 'fulfilled') {
    const items = collabSettled.value.data ?? []
    collaborationOptions.value = items.map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } else if (!isErrorHandled(collabSettled.reason)) {
    console.warn('合作方式加载失败', getErrorMessage(collabSettled.reason))
  }
  if (orderTypeSettled.status === 'fulfilled') {
    const tree = orderTypeSettled.value.data ?? []
    orderTypeTree.value = Array.isArray(tree) ? tree : []
  } else if (!isErrorHandled(orderTypeSettled.reason)) {
    console.warn('订单类型加载失败', getErrorMessage(orderTypeSettled.reason))
  }
}

// B 区：颜色 / 数量
const defaultSizeHeaders = ['S', 'M', 'L', 'XL', '2XL']
const sizeHeaders = ref<string[]>([...defaultSizeHeaders])

interface ColorRow {
  colorName: string
  quantities: number[]
  remark: string
}

const colorRows = ref<ColorRow[]>([])

// B 区表格编辑能力：点击才编辑、单元格引用与键盘导航、批量粘贴
type InputComponentInstance = HTMLElement | { focus?: () => void } | null

type BEditCol = number | 'color' | 'remark'
const editingCell = ref<{ rowIndex: number; col: BEditCol } | null>(null)
const bTableRef = ref<{ $el?: HTMLElement } | null>(null)

const colorCellRefs = ref<InputComponentInstance[][]>([])
const activeColorCell = ref<{ row: number; col: number } | null>(null)

function setColorCellRef(el: unknown, rowIndex: number, colIndex: number) {
  if (!colorCellRefs.value[rowIndex]) colorCellRefs.value[rowIndex] = []
  let target: InputComponentInstance = null
  if (el && typeof el === 'object') {
    const anyEl = el as any
    if (anyEl.$el) {
      target = (anyEl.$el.querySelector('input') as HTMLElement | null) ?? (anyEl.$el as HTMLElement)
    } else {
      target = anyEl as InputComponentInstance
    }
  }
  colorCellRefs.value[rowIndex][colIndex] = target
}

function setActiveColorCell(rowIndex: number, colIndex: number) {
  activeColorCell.value = { row: rowIndex, col: colIndex }
}

const colorNameInputRef = ref<{ focus: () => void; $el?: HTMLElement } | null>(null)
const remarkInputRef = ref<{ focus: () => void; $el?: HTMLElement } | null>(null)

function startEditBCell(rowIndex: number, col: BEditCol) {
  editingCell.value = { rowIndex, col }
  if (typeof col === 'number') {
    nextTick(() => focusColorCell(rowIndex, col))
  } else {
    nextTick(() => {
      const ref = col === 'color' ? colorNameInputRef.value : remarkInputRef.value
      const input = ref?.$el?.querySelector?.('input') ?? (ref as any)?.$el
      if (input?.focus) input.focus()
      else if (typeof ref?.focus === 'function') ref.focus()
    })
  }
}

function onBCellBlur() {
  // 延迟到当前事件循环结束后再判断焦点，避免与表格内部的 focus/blur 冲突
  setTimeout(() => {
    const root = (bTableRef.value as any)?.$el ?? (bTableRef.value as any)
    const container =
      root instanceof HTMLElement
        ? root
        : (root?.$el instanceof HTMLElement ? root.$el : null)
    const active = document.activeElement as HTMLElement | null
    if (!container || !active || !container.contains(active)) {
      editingCell.value = null
    }
  }, 0)
}

function focusColorCell(rowIndex: number, colIndex: number) {
  if (rowIndex < 0 || colIndex < 0) return
  editingCell.value = { rowIndex, col: colIndex }
  nextTick(() => {
    const row = colorCellRefs.value[rowIndex]
    const cell = row?.[colIndex]
    if (cell && typeof cell.focus === 'function') {
      cell.focus && cell.focus()
      activeColorCell.value = { row: rowIndex, col: colIndex }
    }
  })
}

function onColorCellKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
  const rowsCount = colorRows.value.length
  const colsCount = sizeHeaders.value.length
  let targetRow = rowIndex
  let targetCol = colIndex

  if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    targetCol = colIndex + 1
    if (targetCol >= colsCount) {
      targetCol = 0
      targetRow = rowIndex + 1
    }
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
    targetCol = colIndex - 1
    if (targetCol < 0) {
      targetCol = colsCount - 1
      targetRow = rowIndex - 1
    }
  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
    targetRow = rowIndex + 1
  } else if (e.key === 'ArrowUp') {
    targetRow = rowIndex - 1
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
    // 已在上面分别处理
  } else {
    // 其他按键交给输入框本身处理
    return
  }

  e.preventDefault()

  if (targetRow < 0 || targetRow >= rowsCount || targetCol < 0 || targetCol >= colsCount) {
    return
  }

  focusColorCell(targetRow, targetCol)
}

function parseClipboardText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((row) => row.some((cell) => cell.trim() !== ''))
}

function onColorCellPaste(e: ClipboardEvent, startRow: number, startCol: number) {
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text) return

  const matrix = parseClipboardText(text)
  if (!matrix.length) return

  const maxRows = colorRows.value.length
  const maxCols = sizeHeaders.value.length

  matrix.forEach((rowValues, rOffset) => {
    const rowIndex = startRow + rOffset
    if (rowIndex >= maxRows) return
    rowValues.forEach((value, cOffset) => {
      const colIndex = startCol + cOffset
      if (colIndex >= maxCols) return
      const clean = value.replace(/[^\d.-]/g, '')
      const num = Number(clean)
      colorRows.value[rowIndex].quantities[colIndex] = Number.isNaN(num) ? 0 : num
    })
  })
}

function normalizeColorRows() {
  const len = sizeHeaders.value.length
  colorRows.value.forEach((row) => {
    if (!Array.isArray(row.quantities)) row.quantities = []
    if (row.quantities.length < len) {
      row.quantities.push(...Array(len - row.quantities.length).fill(0))
    } else if (row.quantities.length > len) {
      row.quantities.splice(len)
    }
  })
}

function ensureAtLeastOneColorRow() {
  if (colorRows.value.length > 0) return
  const len = sizeHeaders.value.length
  colorRows.value.push({
    colorName: '',
    quantities: Array(len).fill(0),
    remark: '',
  })
}

function addColorRow() {
  const len = sizeHeaders.value.length
  colorRows.value.push({
    colorName: '',
    quantities: Array(len).fill(0),
    remark: '',
  })
}

function removeColorRow(index: number) {
  colorRows.value.splice(index, 1)
  ensureAtLeastOneColorRow()
}

function addSizeColumn() {
  sizeHeaders.value.push(`尺码${sizeHeaders.value.length + 1}`)
  normalizeColorRows()
  normalizeSizeInfoRows()
}

function removeSizeColumn(sIndex: number) {
  if (sizeHeaders.value.length <= 1) return
  sizeHeaders.value.splice(sIndex, 1)
  colorRows.value.forEach((row) => {
    if (Array.isArray(row.quantities)) row.quantities.splice(sIndex, 1)
  })
  const cur = editingCell.value
  if (cur && typeof cur.col === 'number') {
    if (cur.col === sIndex) editingCell.value = null
    else if (cur.col > sIndex) editingCell.value = { ...cur, col: cur.col - 1 }
  }
  normalizeSizeInfoRows()
}

const sizeTotals = computed(() => {
  const len = sizeHeaders.value.length
  const sums = Array(len).fill(0) as number[]
  colorRows.value.forEach((row) => {
    row.quantities.forEach((num, idx) => {
      const n = Number(num) || 0
      sums[idx] += n
    })
  })
  return sums
})

const grandTotal = computed(() => sizeTotals.value.reduce((s, n) => s + n, 0))

function calcRowTotal(row: ColorRow) {
  return (row.quantities ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

/** B 区表尾合计行：列顺序为 颜色名称 | 尺码1..N | 合计 | 备注 | 操作 */
function bSummaryMethod() {
  const totals = sizeTotals.value
  const total = grandTotal.value
  const row: (string | number)[] = ['合计', ...totals, total, '', '']
  return row
}

// C 区：物料信息
interface MaterialRow {
  materialTypeId?: number | null
  materialType?: string
  supplierName?: string
  materialName?: string
  color?: string
  fabricWidth?: string
  usagePerPiece?: number | null
  lossPercent?: number | null
  orderPieces?: number | null
  purchaseQuantity?: number | null
  cuttingQuantity?: number | null
  remark?: string
}

const materials = ref<MaterialRow[]>([])
const materialTypeOptions = ref<{ id: number; label: string }[]>([])

const materialCellRefs = ref<InputComponentInstance[][]>([])

function setMaterialCellRef(el: unknown, rowIndex: number, colIndex: number) {
  if (!materialCellRefs.value[rowIndex]) materialCellRefs.value[rowIndex] = []
  let target: InputComponentInstance = null
  if (el && typeof el === 'object') {
    const anyEl = el as any
    if (anyEl.$el) {
      target = (anyEl.$el.querySelector('input') as HTMLElement | null) ?? (anyEl.$el as HTMLElement)
    } else {
      target = anyEl as InputComponentInstance
    }
  }
  materialCellRefs.value[rowIndex][colIndex] = target
}

function focusMaterialCell(rowIndex: number, colIndex: number) {
  if (rowIndex < 0 || colIndex < 0) return
  const row = materialCellRefs.value[rowIndex]
  const cell = row?.[colIndex]
  if (cell && typeof cell.focus === 'function') {
    nextTick(() => {
      cell.focus && cell.focus()
    })
  }
}

function onMaterialCellKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
  const rowsCount = materials.value.length
  const colsCount = 9
  let targetRow = rowIndex
  let targetCol = colIndex

  if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    targetCol = colIndex + 1
    if (targetCol >= colsCount) {
      targetCol = 0
      targetRow = rowIndex + 1
    }
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
    targetCol = colIndex - 1
    if (targetCol < 0) {
      targetCol = colsCount - 1
      targetRow = rowIndex - 1
    }
  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
    targetRow = rowIndex + 1
  } else if (e.key === 'ArrowUp') {
    targetRow = rowIndex - 1
  } else {
    return
  }

  e.preventDefault()

  if (targetRow < 0 || targetRow >= rowsCount || targetCol < 0 || targetCol >= colsCount) {
    return
  }

  focusMaterialCell(targetRow, targetCol)
}

function addMaterialRow() {
  materials.value.push({})
}

function removeMaterialRow(index: number) {
  materials.value.splice(index, 1)
}

async function loadMaterialTypes() {
  try {
    const res = await getDictItems('material_types')
    const list = res.data ?? []
    materialTypeOptions.value = list.map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('物料类型加载失败', getErrorMessage(e))
  }
}

function syncMaterialTypeIdsFromLabel() {
  if (!materialTypeOptions.value.length || !materials.value.length) return
  const map = new Map<string, number>()
  materialTypeOptions.value.forEach((opt) => {
    if (opt.label) map.set(String(opt.label), opt.id)
  })
  materials.value.forEach((row) => {
    if ((row.materialTypeId == null || Number.isNaN(row.materialTypeId as any)) && row.materialType) {
      const id = map.get(String(row.materialType))
      if (id) {
        row.materialTypeId = id
      }
    }
  })
}

/** 自动计算采购总量：单件用量 * 订单件数 * (1 + 损耗%) */
function recalcPurchaseQuantity(row: MaterialRow) {
  const usage = Number(row.usagePerPiece) || 0
  const lossPercent = Number(row.lossPercent) || 0
  const pieces = Number(row.orderPieces) || 0
  const lossRate = lossPercent / 100
  const result = usage * pieces * (1 + lossRate)
  row.purchaseQuantity = Number.isFinite(result) ? result : 0
}

function onSupplierChange(_row: MaterialRow) {
  // 预留：后续可在此实现“一键新建供应商”逻辑
}

// D 区：尺寸信息（默认部位单位为 cm）
const defaultSizeMetaHeaders = ['部位cm', '英文部位', '量法', '纸样尺寸', '样衣尺寸', '公差']
const sizeMetaHeaders = ref<string[]>([...defaultSizeMetaHeaders])

interface SizeInfoRow {
  metaValues: string[]
  sizeValues: number[]
}

const sizeInfoRows = ref<SizeInfoRow[]>([])

// D 区表格编辑能力：单元格引用与键盘导航、批量粘贴
const sizeGridRefs = ref<InputComponentInstance[][]>([])

function setSizeGridCellRef(el: unknown, rowIndex: number, colIndex: number) {
  if (!sizeGridRefs.value[rowIndex]) sizeGridRefs.value[rowIndex] = []
  let target: InputComponentInstance = null
  if (el && typeof el === 'object') {
    const anyEl = el as any
    if (anyEl.$el) {
      target = (anyEl.$el.querySelector('input') as HTMLElement | null) ?? (anyEl.$el as HTMLElement)
    } else {
      target = anyEl as InputComponentInstance
    }
  }
  sizeGridRefs.value[rowIndex][colIndex] = target
}

function focusSizeGridCell(rowIndex: number, colIndex: number) {
  if (rowIndex < 0 || colIndex < 0) return
  const row = sizeGridRefs.value[rowIndex]
  const cell = row?.[colIndex]
  if (cell && typeof cell.focus === 'function') {
    nextTick(() => {
      cell.focus && cell.focus()
    })
  }
}

function onSizeGridKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
  const rowsCount = sizeInfoRows.value.length
  const colsCount = sizeMetaHeaders.value.length + sizeHeaders.value.length
  let targetRow = rowIndex
  let targetCol = colIndex

  // 在任意单元格内按 Ctrl+C / Cmd+C，复制整个 D 区到剪贴板（含表头）
  if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void copySizeInfoToClipboard()
    return
  }

  if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    targetCol = colIndex + 1
    if (targetCol >= colsCount) {
      targetCol = 0
      targetRow = rowIndex + 1
    }
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
    targetCol = colIndex - 1
    if (targetCol < 0) {
      targetCol = colsCount - 1
      targetRow = rowIndex - 1
    }
  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
    targetRow = rowIndex + 1
  } else if (e.key === 'ArrowUp') {
    targetRow = rowIndex - 1
  } else {
    return
  }

  e.preventDefault()

  if (targetRow < 0 || targetRow >= rowsCount || targetCol < 0 || targetCol >= colsCount) {
    return
  }

  focusSizeGridCell(targetRow, targetCol)
}

function onSizeGridPaste(e: ClipboardEvent, startRow: number, startCol: number) {
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text) return

  const matrix = parseClipboardText(text)
  if (!matrix.length) return

  const maxRows = sizeInfoRows.value.length
  const totalCols = sizeMetaHeaders.value.length + sizeHeaders.value.length

  matrix.forEach((rowValues, rOffset) => {
    const rowIndex = startRow + rOffset
    if (rowIndex >= maxRows) return
    rowValues.forEach((value, cOffset) => {
      const gridCol = startCol + cOffset
      if (gridCol >= totalCols) return
      if (gridCol < sizeMetaHeaders.value.length) {
        sizeInfoRows.value[rowIndex].metaValues[gridCol] = value ?? ''
      } else {
        const sizeCol = gridCol - sizeMetaHeaders.value.length
        const clean = (value ?? '').replace(/[^\d.-]/g, '')
        const num = Number(clean)
        sizeInfoRows.value[rowIndex].sizeValues[sizeCol] = Number.isNaN(num) ? 0 : num
      }
    })
  })
}

function normalizeSizeInfoRows() {
  const metaLen = sizeMetaHeaders.value.length
  const sizeLen = sizeHeaders.value.length
  sizeInfoRows.value.forEach((row) => {
    if (!Array.isArray(row.metaValues)) row.metaValues = []
    if (!Array.isArray(row.sizeValues)) row.sizeValues = []
    if (row.metaValues.length < metaLen) {
      row.metaValues.push(...Array(metaLen - row.metaValues.length).fill(''))
    } else if (row.metaValues.length > metaLen) {
      row.metaValues.splice(metaLen)
    }
    if (row.sizeValues.length < sizeLen) {
      row.sizeValues.push(...Array(sizeLen - row.sizeValues.length).fill(0))
    } else if (row.sizeValues.length > sizeLen) {
      row.sizeValues.splice(sizeLen)
    }
  })
}

function addSizeInfoRow() {
  sizeInfoRows.value.push({
    metaValues: Array(sizeMetaHeaders.value.length).fill(''),
    sizeValues: Array(sizeHeaders.value.length).fill(0),
  })
}

function removeSizeInfoRow(index: number) {
  sizeInfoRows.value.splice(index, 1)
}

function addSizeMetaColumn() {
  sizeMetaHeaders.value.push(`字段${sizeMetaHeaders.value.length + 1}`)
  normalizeSizeInfoRows()
}

function removeSizeMetaColumn(mIndex: number) {
  if (sizeMetaHeaders.value.length <= 1) return
  sizeMetaHeaders.value.splice(mIndex, 1)
  sizeInfoRows.value.forEach((row) => {
    if (Array.isArray(row.metaValues)) row.metaValues.splice(mIndex, 1)
  })
  normalizeSizeInfoRows()
}

async function copySizeInfoToClipboard() {
  const headers = [...sizeMetaHeaders.value, ...sizeHeaders.value]
  const rows = sizeInfoRows.value.map((row) => {
    const meta = sizeMetaHeaders.value.map((_, idx) => row.metaValues?.[idx] ?? '')
    const sizes = sizeHeaders.value.map((_, idx) => String(row.sizeValues?.[idx] ?? 0))
    return [...meta, ...sizes]
  })
  const lines = [headers, ...rows].map((r) => r.join('\t')).join('\n')
  try {
    const nav: any = navigator
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(lines)
      ElMessage.success('已复制到剪贴板，可直接粘贴到 Excel')
    } else {
      throw new Error('clipboard not available')
    }
  } catch {
    // 回退方案：创建临时 textarea 复制
    const textarea = document.createElement('textarea')
    textarea.value = lines
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('已复制到剪贴板，可直接粘贴到 Excel')
    } catch {
      ElMessage.error('复制失败，请手动选择后复制')
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

// E 区：工艺项目
interface ProcessRow {
  processName?: string
  supplierName?: string
  part?: string
  remark?: string
}

const processItems = ref<ProcessRow[]>([])
/** 工艺项目下拉选项：与「供应商设置」中「工艺供应商」的业务范围一致 */
const processOptions = ref<string[]>([])

function addProcessRow() {
  processItems.value.push({})
}

function removeProcessRow(index: number) {
  processItems.value.splice(index, 1)
}

/** 从供应商设置加载「工艺供应商」下的业务范围作为工艺项目选项 */
async function loadProcessOptions() {
  try {
    const res = await getSupplierBusinessScopeOptions('工艺供应商')
    processOptions.value = res.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('工艺项目选项加载失败', getErrorMessage(e))
  }
}

// F 区：生产要求
const productionRequirement = ref('')

// G 区：包装要求
const defaultPackagingHeaders = ['主唛', '洗水唛', '吊牌', '包装袋', '包装贴纸', '外箱唛头']
const packagingHeaders = ref<string[]>([...defaultPackagingHeaders])

interface PackagingCell {
  imageUrl?: string
  accessoryId?: number | null
  accessoryName?: string
  description?: string
}

const packagingCells = ref<PackagingCell[]>([])
const packagingMethod = ref('')
const packagingFileInputRef = ref<HTMLInputElement | null>(null)
const activePackagingIndex = ref<number | null>(null)

function normalizePackagingCells() {
  const len = packagingHeaders.value.length
  if (packagingCells.value.length < len) {
    const toAdd = len - packagingCells.value.length
    for (let i = 0; i < toAdd; i++) packagingCells.value.push({})
  } else if (packagingCells.value.length > len) {
    packagingCells.value.splice(len)
  }
}

// 初始化时保证与默认表头长度一致，避免模板访问 undefined
normalizePackagingCells()

function getNextPackagingHeader(): string {
  const existing = new Set(packagingHeaders.value.map((h) => String(h ?? '').trim()).filter(Boolean))
  const missingDefault = defaultPackagingHeaders.find((h) => !existing.has(h))
  if (missingDefault) return missingDefault
  return `项${packagingHeaders.value.length + 1}`
}

function addPackagingHeader() {
  packagingHeaders.value.push(getNextPackagingHeader())
  normalizePackagingCells()
}

function removePackagingHeader(index: number) {
  packagingHeaders.value.splice(index, 1)
  packagingCells.value.splice(index, 1)
}

function triggerPackagingUpload(index: number) {
  activePackagingIndex.value = index
  packagingFileInputRef.value?.click()
}

async function onPackagingFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || activePackagingIndex.value == null) return
  try {
    const url = await uploadImage(file)
    packagingCells.value[activePackagingIndex.value].imageUrl = url
  } catch (err: unknown) {
    if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
  } finally {
    activePackagingIndex.value = null
  }
}

// 包装辅料选择弹窗（从辅料库存中选择）
const accessoryDialogVisible = ref(false)
const accessoryDialogLoading = ref(false)
const accessoryKeyword = ref('')
const accessoryItems = ref<AccessoryItem[]>([])
const accessoryTargetIndex = ref<number | null>(null)

const filteredAccessoryItems = computed(() => {
  const kw = accessoryKeyword.value.trim().toLowerCase()
  if (!kw) return accessoryItems.value
  return accessoryItems.value.filter((item) => {
    const name = item.name?.toLowerCase?.() ?? ''
    const category = item.category?.toLowerCase?.() ?? ''
    const customer = item.customerName?.toLowerCase?.() ?? ''
    return name.includes(kw) || category.includes(kw) || customer.includes(kw)
  })
})

async function loadAccessoryItems() {
  accessoryDialogLoading.value = true
  try {
    const res = await getAccessoriesList({ page: 1, pageSize: 200 })
    const data = res.data
    accessoryItems.value = data?.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('辅料库存加载失败', getErrorMessage(e))
  } finally {
    accessoryDialogLoading.value = false
  }
}

async function openAccessoryDialog(index: number) {
  accessoryTargetIndex.value = index
  accessoryDialogVisible.value = true
  if (!accessoryItems.value.length) {
    await loadAccessoryItems()
  }
}

function onSelectAccessory(row: AccessoryItem) {
  if (accessoryTargetIndex.value == null) return
  const cell = packagingCells.value[accessoryTargetIndex.value]
  if (cell) {
    cell.accessoryId = row.id ?? null
    cell.accessoryName = row.name
    // 选择辅料后，直接覆盖带出对应图片，避免再次上传
    cell.imageUrl = row.imageUrl || ''
  }
  accessoryDialogVisible.value = false
}

// H 区：图片附件
const attachments = ref<string[]>([])
const attachmentFileInputRef = ref<HTMLInputElement | null>(null)

function triggerAttachmentUpload() {
  attachmentFileInputRef.value?.click()
}

async function onAttachmentFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  for (const file of files) {
    try {
      const url = await uploadImage(file)
      attachments.value.push(url)
    } catch (err: unknown) {
      if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
    }
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

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
const orderImageFileInputRef = ref<HTMLInputElement | null>(null)

function triggerOrderImageUpload() {
  orderImageFileInputRef.value?.click()
}

async function onOrderImageFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const url = await uploadImage(file)
    form.imageUrl = url
  } catch (err: unknown) {
    if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
  }
}

// 供应商（C 区物料、E 区工艺用）
const supplierOptions = ref<{ id: number; name: string }[]>([])
const supplierLoading = ref(false)

async function searchSuppliers(keyword: string) {
  supplierLoading.value = true
  try {
    const res = await request.get('/suppliers', {
      params: { keyword: keyword || undefined, pageSize: 20 },
      skipGlobalErrorHandler: true,
    })
    const data = res.data as { list?: { id: number; name: string }[] }
    supplierOptions.value = data.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
  } finally {
    supplierLoading.value = false
  }
}

async function searchProcessSuppliers(keyword: string) {
  return searchSuppliersByType('工艺供应商', keyword)
}

function getMaterialTypeLabel(row: MaterialRow): string {
  if (row.materialTypeId != null) {
    const opt = materialTypeOptions.value.find((x) => x.id === row.materialTypeId)
    if (opt?.label) return String(opt.label)
  }
  return String(row.materialType ?? '')
}

function getSupplierTypeForMaterialType(materialTypeLabel: string): string {
  const label = materialTypeLabel.trim()
  if (label === '主布' || label === '里布' || label === '衬布') return '面料供应商'
  if (label === '辅料') return '辅料供应商'
  if (label === '成品') return '成品供应商'
  return ''
}

async function searchSuppliersByType(typeValue: string, keyword: string) {
  supplierLoading.value = true
  try {
    const res = await request.get('/suppliers/items', {
      params: {
        type: typeValue || undefined,
        name: keyword || undefined,
        page: 1,
        pageSize: 20,
      },
      skipGlobalErrorHandler: true,
    })
    const data = res.data as { list?: { id: number; name: string }[] }
    supplierOptions.value = data.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
  } finally {
    supplierLoading.value = false
  }
}

function onMaterialTypeChange(row: MaterialRow) {
  row.supplierName = ''
}

function onMaterialSupplierVisibleChange(visible: boolean, row: MaterialRow) {
  if (!visible) return
  const typeValue = getSupplierTypeForMaterialType(getMaterialTypeLabel(row))
  void searchSuppliersByType(typeValue, '')
}

function searchMaterialSuppliers(keyword: string, row: MaterialRow) {
  const typeValue = getSupplierTypeForMaterialType(getMaterialTypeLabel(row))
  return searchSuppliersByType(typeValue, keyword)
}

// 保存逻辑
const saving = ref(false)
const submitting = ref(false)

function checkRequiredFields(): boolean {
  const missing: string[] = []
  if (!form.skuCode || !String(form.skuCode).trim()) missing.push('SKU')
  if (form.customerId == null || form.customerId === undefined) missing.push('客户')
  if (form.collaborationTypeId == null || form.collaborationTypeId === undefined) missing.push('合作方式')
  if ((form as any).orderTypeId == null || (form as any).orderTypeId === undefined) missing.push('订单类型')
  if (!form.customerDueDate) missing.push('客户交期')
  {
    const str = String(form.salePrice ?? '').trim()
    const num = Number(str)
    if (!str || !Number.isFinite(num) || num <= 0) missing.push('销售价')
  }

  if (missing.length) {
    ElMessage.warning(`请先填写必填项：${missing.join('、')}`)
    // 触发表单校验以高亮具体字段
    void formRef.value?.validate().catch(() => {})
    return false
  }
  return true
}

async function collectPayload(): Promise<OrderFormPayload> {
  if (!checkRequiredFields()) {
    throw new Error('invalid form')
  }
  await formRef.value?.validate()
  const processItemSummary = processItems.value
    .map((p) => (p.processName ?? '').trim())
    .filter((name, idx, arr) => name && arr.indexOf(name) === idx)
    .join('、')
  return {
    ...form,
    orderTypeId: (form as any).orderTypeId ?? null,
    collaborationTypeId: (form as any).collaborationTypeId ?? null,
    // 数量：以 B 区颜色/尺码合计为准，确保订单列表卡片数量一致
    quantity: grandTotal.value,
    // 工艺项目摘要（原二次工艺），用于列表卡片展示与筛选
    processItem: processItemSummary,
    colorSizeRows: colorRows.value.map((row) => ({
      colorName: row.colorName,
      quantities: [...row.quantities],
      remark: row.remark,
    })),
    colorSizeHeaders: [...sizeHeaders.value],
    materials: materials.value.map(({ materialType: _t, ...m }) => ({ ...m })),
    sizeInfoMetaHeaders: [...sizeMetaHeaders.value],
    sizeInfoRows: sizeInfoRows.value.map((r) => ({
      metaValues: [...r.metaValues],
      sizeValues: [...r.sizeValues],
    })),
    processItems: processItems.value.map((p) => ({ ...p })),
    productionRequirement: productionRequirement.value,
    packagingHeaders: [...packagingHeaders.value],
    packagingCells: packagingCells.value.map((c, idx) => ({
      header: packagingHeaders.value[idx],
      ...c,
    })),
    packagingMethod: packagingMethod.value,
    attachments: [...attachments.value],
  }
}

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
        router.replace({ name: 'OrdersEdit', params: { id: String(id) } })
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
        router.replace({ name: 'OrdersEdit', params: { id: String(id) } })
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
    orderNo.value = d.orderNo
    orderStatus.value = (d as any).status ?? 'draft'
    form.skuCode = d.skuCode
    skuProductGroupName.value = (d as any).productGroupName ?? ''
    skuApplicablePeopleName.value = (d as any).applicablePeopleName ?? ''
    form.xiaomanOrderNo = (d as any).xiaomanOrderNo ?? ''
    form.customerId = d.customerId ?? null
    form.customerName = d.customerName ?? ''
    form.salesperson = d.salesperson ?? ''
    form.merchandiser = d.merchandiser ?? ''
    form.merchandiserPhone = (d as any).merchandiserPhone ?? ''
    ;(form as any).collaborationTypeId = (d as any).collaborationTypeId ?? null
    // 订单类型仅通过 ID 回显
    ;(form as any).orderTypeId = (d as any).orderTypeId ?? null
    // 客户下拉若无当前客户，会显示 raw id；补一条 option 让 el-select 正常展示
    if (form.customerId && form.customerName && !customerOptions.value.some((c) => c.id === form.customerId)) {
      customerOptions.value.unshift({ id: form.customerId, companyName: form.customerName })
    }
    form.secondaryProcess = d.processItem ?? ''
    form.quantity = d.quantity ?? 0
    form.exFactoryPrice = d.exFactoryPrice ?? ''
    form.salePrice = d.salePrice ?? ''
    form.orderDate = d.orderDate ?? ''
    form.customerDueDate = d.customerDueDate ?? ''
    form.imageUrl = d.imageUrl ?? ''
    // B 区
    sizeHeaders.value = (d as any).colorSizeHeaders && Array.isArray((d as any).colorSizeHeaders)
      ? [...(d as any).colorSizeHeaders]
      : [...defaultSizeHeaders]
    colorRows.value = ((d as any).colorSizeRows ?? []).map((row: any) => ({
      colorName: row.colorName ?? '',
      quantities: Array.isArray(row.quantities) ? [...row.quantities] : Array(sizeHeaders.value.length).fill(0),
      remark: row.remark ?? '',
    }))
    normalizeColorRows()
    ensureAtLeastOneColorRow()
    // C 区
    materials.value = ((d as any).materials ?? []).map((m: any) => ({
      materialTypeId: m.materialTypeId ?? null,
      materialType: m.materialType ?? '',
      supplierName: m.supplierName ?? '',
      materialName: m.materialName ?? '',
      color: m.color ?? '',
      fabricWidth: m.fabricWidth ?? '',
      usagePerPiece: m.usagePerPiece ?? null,
      lossPercent: m.lossPercent ?? null,
      orderPieces: m.orderPieces ?? null,
      purchaseQuantity: m.purchaseQuantity ?? null,
      cuttingQuantity: m.cuttingQuantity ?? null,
      remark: m.remark ?? '',
    }))
    // D 区
    sizeMetaHeaders.value = (d as any).sizeInfoMetaHeaders && Array.isArray((d as any).sizeInfoMetaHeaders)
      ? [...(d as any).sizeInfoMetaHeaders]
      : [...defaultSizeMetaHeaders]
    sizeInfoRows.value = ((d as any).sizeInfoRows ?? []).map((r: any) => ({
      metaValues: Array.isArray(r.metaValues) ? [...r.metaValues] : Array(sizeMetaHeaders.value.length).fill(''),
      sizeValues: Array.isArray(r.sizeValues) ? [...r.sizeValues] : Array(sizeHeaders.value.length).fill(0),
    }))
    normalizeSizeInfoRows()
    // E 区
    processItems.value = ((d as any).processItems ?? []).map((p: any) => ({
      processName: p.processName ?? '',
      supplierName: p.supplierName ?? '',
      part: p.part ?? '',
      remark: p.remark ?? '',
    }))
    // F 区
    productionRequirement.value = (d as any).productionRequirement ?? ''
    // G 区
    packagingHeaders.value = (d as any).packagingHeaders && Array.isArray((d as any).packagingHeaders)
      ? [...(d as any).packagingHeaders]
      : [...defaultPackagingHeaders]
    packagingCells.value = ((d as any).packagingCells ?? []).map((c: any) => ({
      imageUrl: c.imageUrl ?? '',
      accessoryId: c.accessoryId ?? null,
      accessoryName: c.accessoryName ?? '',
      description: c.description ?? '',
    }))
    normalizePackagingCells()
    packagingMethod.value = (d as any).packagingMethod ?? ''
    // H 区
    attachments.value = ((d as any).attachments ?? []) as string[]
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
        router.replace({ name: 'OrdersEdit', params: { id: lastId } })
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
        await loadDicts()
        await loadUserOptions()
        await loadMaterialTypes()
        // 初始化 SKU 下拉，让用户下拉时能直接看到产品列表
        await searchSkus('')
        // C 区 / E 区供应商下拉初始列表
        await searchProcessSuppliers('')
        // E 区工艺项目下拉：与「供应商设置」中「工艺供应商」的业务范围一致
        await loadProcessOptions()
      })(),
      loadDetail(),
    ])
    // 物料类型：旧订单可能只存了 materialType 字符串，这里在字典和明细都加载完后做一次自动映射
    syncMaterialTypeIdsFromLabel()
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
    // 初始化完成后不视为“未保存”，避免新建订单的默认值触发离开提示
    nextTick(() => {
      hasUnsavedChanges.value = false
      skipDirtyCheck = false
    })
  }
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
  object-fit: cover;
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
.b-header-remove :deep(.el-icon) {
  font-size: 8px;
  line-height: 8px;
}
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
  object-fit: cover;
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
}

.attachment-item :deep(.el-image) {
  width: 100%;
  height: 100%;
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

