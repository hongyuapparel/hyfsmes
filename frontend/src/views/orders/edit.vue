<template>
  <div class="page-card order-edit-page">
    <div class="page-header">
      <div class="left">
        <el-button link type="primary" @click="goBack">返回列表</el-button>
        <span class="title">订单编辑</span>
        <span v-if="orderNo" class="sub-title">订单号：{{ orderNo }}</span>
      </div>
      <div class="right">
        <el-button @click="onPrint" :disabled="!orderId">打印订单</el-button>
        <el-button @click="onSaveDraft" :loading="saving">保存草稿</el-button>
        <el-button type="primary" @click="onSaveAndSubmit" :loading="submitting">保存并提交</el-button>
      </div>
    </div>

    <!-- A 区：订单基本信息 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">A 订单基本信息</span>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="basic-form" label-position="left">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="SKU" prop="skuCode">
              <el-select
                v-model="form.skuCode"
                placeholder="选择 SKU"
                filterable
                remote
                clearable
                :remote-method="searchSkus"
                :loading="skuLoading"
                @visible-change="(visible: boolean) => visible && !skuOptions.length && searchSkus('')"
                @change="onSkuChange"
              >
                <el-option
                  v-for="item in skuOptions"
                  :key="item.id"
                  :label="item.skuCode"
                  :value="item.skuCode"
                >
                  <div class="option-main">
                    <span class="option-primary">{{ item.skuCode }}</span>
                    <span class="option-secondary" v-if="item.customerName">{{ item.customerName }}</span>
                  </div>
                </el-option>
              </el-select>
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
            <el-form-item label="合作方式">
              <el-select v-model="form.collaborationType" placeholder="选择合作方式" clearable filterable>
                <el-option v-for="opt in collaborationOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="订单类型">
              <el-tree-select
                v-model="form.orderType"
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
            <el-form-item label="客户交期">
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
            <el-form-item label="销售价">
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
                  :value="u.username"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="跟单电话">
              <el-input v-model="form.merchandiserPhone" placeholder="自动带出后可修改" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
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
                  :value="u.username"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="加工厂">
              <el-select
                v-model="form.factoryName"
                placeholder="选择加工厂"
                filterable
                clearable
                :remote-method="searchSuppliers"
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
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16" class="image-row">
          <el-col :xs="24" :sm="12" :md="8">
            <div class="image-field">
              <div class="image-preview-wrap" v-if="form.imageUrl">
                <el-image :src="form.imageUrl" fit="cover" :preview-src-list="[form.imageUrl]" />
                <el-button text type="danger" size="small" class="image-remove" @click="form.imageUrl = ''">
                  移除
                </el-button>
              </div>
              <div v-else class="image-placeholder">
                <span>暂无图片</span>
              </div>
              <div class="image-actions">
                <el-input v-model="form.imageUrl" placeholder="可粘贴图片 URL" size="small" />
              </div>
            </div>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- B 区：颜色 / 数量 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">B 颜色 / 数量</span>
          <div class="block-actions">
            <el-button link type="primary" @click="addSizeColumn">新增尺码列</el-button>
            <el-button link type="primary" @click="addColorRow">新增颜色</el-button>
          </div>
        </div>
      </template>
      <el-table :data="colorRows" border>
        <el-table-column label="颜色名称" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.colorName" placeholder="颜色名称" />
          </template>
        </el-table-column>
        <el-table-column
          v-for="(size, sIndex) in sizeHeaders"
          :key="size"
          :label="size"
          min-width="90"
        >
          <template #header>
            <el-input v-model="sizeHeaders[sIndex]" size="small" />
          </template>
          <template #default="{ row }">
            <el-input-number
              v-model="row.quantities[sIndex]"
              :min="0"
              :controls="false"
              class="qty-input"
            />
          </template>
        </el-table-column>
        <el-table-column label="合计" width="80">
          <template #default="{ row }">
            {{ calcRowTotal(row) }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.remark" placeholder="备注" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeColorRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="b-summary">
        <span v-for="(sum, idx) in sizeTotals" :key="idx" class="b-summary-item">
          {{ sizeHeaders[idx] }}：{{ sum }}
        </span>
        <span class="b-summary-item b-summary-total">总数：{{ grandTotal }}</span>
      </div>
    </el-card>

    <!-- C 区：物料信息 -->
    <el-card class="block-card">
      <template #header>
        <div class="block-header">
          <span class="block-title">C 物料信息</span>
          <el-button link type="primary" @click="addMaterialRow">新增物料</el-button>
        </div>
      </template>
      <el-table :data="materials" border>
        <el-table-column label="物料类型" min-width="120">
          <template #default="{ row }">
            <el-select
              v-model="row.materialType"
              placeholder="选择物料类型"
              filterable
              clearable
            >
              <el-option
                v-for="opt in materialTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="140">
          <template #default="{ row }">
            <el-select
              v-model="row.supplierName"
              placeholder="选择或输入供应商"
              filterable
              allow-create
              default-first-option
              @change="onSupplierChange(row)"
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
        <el-table-column label="物料名称/颜色" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.materialName" placeholder="物料名称/颜色" />
          </template>
        </el-table-column>
        <el-table-column label="单件用量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.usagePerPiece" :min="0" :controls="false" />
          </template>
        </el-table-column>
        <el-table-column label="损耗%" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.lossPercent" :min="0" :controls="false" />
          </template>
        </el-table-column>
        <el-table-column label="订单件数" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.orderPieces" :min="0" :controls="false" />
          </template>
        </el-table-column>
        <el-table-column label="采购总量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.purchaseQuantity" :min="0" :controls="false" />
          </template>
        </el-table-column>
        <el-table-column label="裁片数量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.cuttingQuantity" :min="0" :controls="false" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.remark" placeholder="备注" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeMaterialRow($index)">删除</el-button>
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
          </div>
        </div>
      </template>
      <el-table :data="sizeInfoRows" border>
        <el-table-column
          v-for="(header, idx) in sizeMetaHeaders"
          :key="'meta-' + idx"
          :label="header"
          min-width="120"
        >
          <template #header>
            <el-input v-model="sizeMetaHeaders[idx]" size="small" />
          </template>
          <template #default="{ row }">
            <el-input v-model="row.metaValues[idx]" />
          </template>
        </el-table-column>
        <el-table-column
          v-for="(size, sIndex) in sizeHeaders"
          :key="'size-' + size"
          :label="size"
          min-width="90"
        >
          <template #header>
            <span>{{ sizeHeaders[sIndex] }}</span>
          </template>
          <template #default="{ row }">
            <el-input-number
              v-model="row.sizeValues[sIndex]"
              :min="0"
              :controls="false"
              class="qty-input"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeSizeInfoRow($index)">删除</el-button>
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
              :remote-method="searchProcessItems"
              remote
              :loading="processLoading"
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
              :remote-method="searchSuppliers"
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
        <el-table-column label="工艺说明 / 备注" min-width="200">
          <template #default="{ row }">
            <el-input v-model="row.remark" placeholder="说明 / 备注" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeProcessRow($index)">删除</el-button>
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
            />
            <el-input
              v-model="packagingCells[idx].description"
              placeholder="信息备注"
              size="small"
            />
          </div>
          <div class="packaging-footer">
            <el-button link type="danger" size="small" @click="removePackagingHeader(idx)">删除列</el-button>
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
          <el-button
            text
            type="danger"
            size="small"
            class="attachment-remove"
            @click="removeAttachment(idx)"
          >
            删除
          </el-button>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import {
  createOrderDraft,
  getOrderDetail,
  submitOrder,
  updateOrderDraft,
  type OrderFormPayload,
} from '@/api/orders'
import request, { getErrorMessage, isErrorHandled } from '@/api/request'
import { uploadImage } from '@/api/uploads'
import { getSystemOptions, getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'

const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()

const orderId = computed(() => {
  const v = route.params.id
  if (!v) return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
})

const orderNo = ref('')

const form = reactive<OrderFormPayload>({
  skuCode: '',
  xiaomanOrderNo: '',
  customerId: null,
  customerName: '',
  salesperson: '',
  merchandiser: '',
  merchandiserPhone: '',
  collaborationType: '',
  orderType: '',
  label: '',
  secondaryProcess: '',
  quantity: 0,
  exFactoryPrice: '',
  salePrice: '',
  orderDate: '',
  customerDueDate: '',
  factoryName: '',
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
}

// SKU 下拉
const skuOptions = ref<{ id: number; skuCode: string; customerName?: string; imageUrl?: string }[]>([])
const skuLoading = ref(false)

async function searchSkus(keyword: string) {
  skuLoading.value = true
  try {
    const res = await request.get('/products/skus', {
      params: { keyword: keyword || undefined, pageSize: 20 },
      skipGlobalErrorHandler: true,
    })
    const data = res.data as { list?: { id: number; skuCode: string; customerName?: string; imageUrl?: string }[] }
    skuOptions.value = data.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('SKU 下拉加载失败', getErrorMessage(e))
  } finally {
    skuLoading.value = false
  }
}

function onSkuChange(sku: string) {
  const item = skuOptions.value.find((x) => x.skuCode === sku)
  if (item?.imageUrl && !form.imageUrl) {
    form.imageUrl = item.imageUrl
  }
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

function onMerchandiserChange(username: string) {
  const u = merchandiserOptions.value.find((x) => x.username === username)
  if (u?.mobile && !form.merchandiserPhone) {
    form.merchandiserPhone = u.mobile
  }
}

// 合作方式 / 订单类型
const collaborationOptions = ref<{ label: string; value: string }[]>([])
// 订单类型采用树形结构，与「订单设置 > 订单类型」一致
const orderTypeTree = ref<SystemOptionTreeNode[]>([])

function toOrderTypeTreeSelect(nodes: SystemOptionTreeNode[], parentPath = ''): { label: string; value: string; children?: any[] }[] {
  return nodes.map((n) => {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children, path) : []
    return {
      label: n.value,
      value: path,
      children: children.length ? children : undefined,
    }
  })
}

const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

const orderTypeTreeSelectProps = {
  label: 'label',
  value: 'value',
  children: 'children',
  disabled: (node: { children?: unknown[] }) =>
    Array.isArray(node.children) && node.children.length > 0,
}

async function loadDicts() {
  try {
    const [collabRes, orderTypeTreeRes] = await Promise.all([
      request.get<{ id: number; value: string }[]>('/dicts', {
        params: { type: 'collaboration' },
        skipGlobalErrorHandler: true,
      }),
      // 订单类型：使用 system-options 树形数据，与设置页保持一致
      getSystemOptionsTree('order_types'),
    ])
    const cv = collabRes.data ?? []
    const tree = orderTypeTreeRes.data ?? []
    collaborationOptions.value = cv.map((i) => ({ label: i.value, value: i.value }))
    orderTypeTree.value = Array.isArray(tree) ? tree : []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('字典加载失败', getErrorMessage(e))
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
}

function addSizeColumn() {
  sizeHeaders.value.push(`尺码${sizeHeaders.value.length + 1}`)
  normalizeColorRows()
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

// C 区：物料信息
interface MaterialRow {
  materialType?: string
  supplierName?: string
  materialName?: string
  color?: string
  usagePerPiece?: number | null
  lossPercent?: number | null
  orderPieces?: number | null
  purchaseQuantity?: number | null
  cuttingQuantity?: number | null
  remark?: string
}

const materials = ref<MaterialRow[]>([])
const materialTypeOptions = ref<{ label: string; value: string }[]>([])

function addMaterialRow() {
  materials.value.push({})
}

function removeMaterialRow(index: number) {
  materials.value.splice(index, 1)
}

async function loadMaterialTypes() {
  try {
    const res = await request.get<{ id: number; value: string }[]>('/dicts', {
      params: { type: 'materialType' },
      skipGlobalErrorHandler: true,
    })
    const list = res.data ?? []
    materialTypeOptions.value = list.map((i) => ({ label: i.value, value: i.value }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('物料类型加载失败', getErrorMessage(e))
  }
}

function onSupplierChange(_row: MaterialRow) {
  // 预留：后续可在此实现“一键新建供应商”逻辑
}

// D 区：尺寸信息
const defaultSizeMetaHeaders = ['部位', '英文部位', '量法', '纸样尺寸', '样衣尺寸', '公差']
const sizeMetaHeaders = ref<string[]>([...defaultSizeMetaHeaders])

interface SizeInfoRow {
  metaValues: string[]
  sizeValues: number[]
}

const sizeInfoRows = ref<SizeInfoRow[]>([])

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

// E 区：工艺项目
interface ProcessRow {
  processName?: string
  supplierName?: string
  remark?: string
}

const processItems = ref<ProcessRow[]>([])
const processOptions = ref<string[]>([])
const processLoading = ref(false)

function addProcessRow() {
  processItems.value.push({})
}

function removeProcessRow(index: number) {
  processItems.value.splice(index, 1)
}

async function searchProcessItems(keyword: string) {
  processLoading.value = true
  try {
    const res = await request.get('/process-items', {
      params: { keyword: keyword || undefined },
      skipGlobalErrorHandler: true,
    })
    const list = (res.data as { list?: { value: string }[] } | string[] | undefined) ?? []
    if (Array.isArray(list) && list.length && typeof list[0] === 'string') {
      processOptions.value = list as string[]
    } else if (Array.isArray((list as any).list)) {
      processOptions.value = ((list as any).list as { value: string }[]).map((i) => i.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('工艺项目加载失败', getErrorMessage(e))
  } finally {
    processLoading.value = false
  }
}

// F 区：生产要求
const productionRequirement = ref('')

// G 区：包装要求
const defaultPackagingHeaders = ['主唛', '洗水唛', '吊牌', '包装袋', '包装贴纸', '外箱唛头']
const packagingHeaders = ref<string[]>([...defaultPackagingHeaders])

interface PackagingCell {
  imageUrl?: string
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

function addPackagingHeader() {
  packagingHeaders.value.push(`项${packagingHeaders.value.length + 1}`)
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
// 加工厂（供应商）
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

// 保存逻辑
const saving = ref(false)
const submitting = ref(false)

function checkRequiredFields(): boolean {
  const missing: string[] = []
  if (!form.skuCode || !String(form.skuCode).trim()) missing.push('SKU')
  if (form.customerId == null || form.customerId === undefined) missing.push('客户')
  if (!form.customerDueDate) missing.push('客户交期')

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
  return {
    ...form,
    colorSizeRows: colorRows.value.map((row) => ({
      colorName: row.colorName,
      quantities: [...row.quantities],
      remark: row.remark,
    })),
    colorSizeHeaders: [...sizeHeaders.value],
    materials: materials.value.map((m) => ({ ...m })),
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
      orderNo.value = res.data?.orderNo ?? orderNo.value
    } else {
      const res = await createOrderDraft(payload)
      ElMessage.success('草稿已创建')
      const id = res.data?.id
      orderNo.value = res.data?.orderNo ?? ''
      if (id) {
        router.replace({ name: 'OrdersEdit', params: { id } })
      }
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
      ElMessage.success('已保存并提交')
      orderNo.value = res.data?.orderNo ?? orderNo.value
    } else {
      const draftRes = await createOrderDraft(payload)
      const id = draftRes.data?.id
      if (id) {
        const res = await submitOrder(id)
        orderNo.value = res.data?.orderNo ?? draftRes.data?.orderNo ?? ''
        ElMessage.success('已保存并提交')
        router.replace({ name: 'OrdersEdit', params: { id } })
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
    return
  }
  try {
    const res = await getOrderDetail(orderId.value)
    const d = res.data
    if (!d) return
    orderNo.value = d.orderNo
    form.skuCode = d.skuCode
    form.xiaomanOrderNo = (d as any).xiaomanOrderNo ?? ''
    form.customerId = d.customerId ?? null
    form.customerName = d.customerName ?? ''
    form.salesperson = d.salesperson ?? ''
    form.merchandiser = d.merchandiser ?? ''
    form.merchandiserPhone = (d as any).merchandiserPhone ?? ''
    form.collaborationType = (d as any).collaborationType ?? ''
    form.orderType = (d as any).orderType ?? ''
    form.label = d.label ?? ''
    form.secondaryProcess = d.secondaryProcess ?? ''
    form.quantity = d.quantity ?? 0
    form.exFactoryPrice = d.exFactoryPrice ?? ''
    form.salePrice = d.salePrice ?? ''
    form.orderDate = d.orderDate ?? ''
    form.customerDueDate = d.customerDueDate ?? ''
    form.factoryName = d.factoryName ?? ''
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
    // C 区
    materials.value = ((d as any).materials ?? []).map((m: any) => ({
      materialType: m.materialType ?? '',
      supplierName: m.supplierName ?? '',
      materialName: m.materialName ?? '',
      color: m.color ?? '',
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
      accessoryName: c.accessoryName ?? '',
      description: c.description ?? '',
    }))
    normalizePackagingCells()
    packagingMethod.value = (d as any).packagingMethod ?? ''
    // H 区
    attachments.value = ((d as any).attachments ?? []) as string[]
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function goBack() {
  router.push({ name: 'OrdersList' })
}

function onPrint() {
  ElMessage.info('打印功能将在后续步骤中实现')
}

onMounted(async () => {
  await Promise.all([loadDicts(), loadUserOptions(), loadMaterialTypes()])
  // 初始化 SKU 下拉，让用户下拉时能直接看到产品列表
  await searchSkus('')
  await loadDetail()
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
  font-size: 18px;
  font-weight: 600;
}

.page-header .sub-title {
  font-size: 13px;
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

.basic-form {
  margin-top: var(--space-sm);
}

.image-row {
  margin-top: var(--space-md);
}

.image-field {
  display: flex;
  gap: var(--space-sm);
}

.image-preview-wrap {
  width: 120px;
  height: 120px;
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
}

.image-preview-wrap :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.image-remove {
  position: absolute;
  right: 4px;
  bottom: 4px;
}

.image-placeholder {
  width: 120px;
  height: 120px;
  border-radius: var(--radius);
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-muted, #909399);
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
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}

.qty-input {
  width: 100%;
}

.b-summary {
  margin-top: var(--space-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  font-size: 13px;
  color: var(--color-text-muted, #909399);
}

.b-summary-item {
  min-width: 80px;
}

.b-summary-total {
  font-weight: 600;
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
  font-size: 13px;
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

