<template>
  <div class="page-card inventory-accessories-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="名称"
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
      <el-input
        v-model="filter.category"
        placeholder="类别（如商标、吊牌、洗水唛）"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('类别：', filter.category, categoryLabelVisible)"
        :input-style="getFilterInputStyle(filter.category)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.category && categoryLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            类别：
          </span>
        </template>
      </el-input>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button type="primary" size="large" @click="openForm(null)">新增辅料</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="accessories-table">
      <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip />
      <el-table-column prop="quantity" label="数量" width="90" align="right" />
      <el-table-column prop="unit" label="单位" width="70" align="center" />
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="创建时间" width="160" align="center">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
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

    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.isEdit ? '编辑辅料' : '新增辅料'"
      width="480"
      destroy-on-close
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="80px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item label="类别" prop="category">
          <el-input
            v-model="form.category"
            placeholder="如商标、吊牌、洗水唛"
            clearable
          />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number
            v-model="form.quantity"
            :min="0"
            :precision="0"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="form.unit" placeholder="如个、卷" clearable />
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  getAccessoriesList,
  createAccessory,
  updateAccessory,
  deleteAccessory,
  type AccessoryItem,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14

function getFilterInputStyle(v: unknown) {
  return v ? { color: ACTIVE_FILTER_COLOR } : undefined
}
function getTextFilterStyle(prefix: string, val: unknown, showLabel: boolean) {
  if (!val || !showLabel) return undefined
  const text = prefix + String(val)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

const filter = reactive({ name: '', category: '' })
const nameLabelVisible = ref(false)
const categoryLabelVisible = ref(false)
const list = ref<AccessoryItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
  visible: false,
  submitting: false,
  isEdit: false,
})
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  name: '',
  category: '',
  quantity: 0,
  unit: '个',
  imageUrl: '',
  remark: '',
})
const formRules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    const res = await getAccessoriesList({
      name: filter.name || undefined,
      category: filter.category || undefined,
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

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.name && String(filter.name).trim()) nameLabelVisible.value = true
    if (filter.category && String(filter.category).trim()) categoryLabelVisible.value = true
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
  nameLabelVisible.value = false
  categoryLabelVisible.value = false
  filter.name = ''
  filter.category = ''
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function openForm(row: AccessoryItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.name = row.name
    form.category = row.category ?? ''
    form.quantity = row.quantity ?? 0
    form.unit = row.unit ?? '个'
    form.imageUrl = row.imageUrl ?? ''
    form.remark = row.remark ?? ''
  } else {
    form.name = ''
    form.category = ''
    form.quantity = 0
    form.unit = '个'
    form.imageUrl = ''
    form.remark = ''
  }
  formDialog.visible = true
}

function resetForm() {
  formRef.value?.clearValidate()
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    if (formDialog.isEdit && editId.value != null) {
      await updateAccessory(editId.value, {
        name: form.name,
        category: form.category,
        quantity: form.quantity,
        unit: form.unit,
        imageUrl: form.imageUrl || undefined,
        remark: form.remark,
      })
      ElMessage.success('保存成功')
    } else {
      await createAccessory({
        name: form.name,
        category: form.category,
        quantity: form.quantity,
        unit: form.unit,
        imageUrl: form.imageUrl || undefined,
        remark: form.remark,
      })
      ElMessage.success('新增成功')
    }
    formDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    formDialog.submitting = false
  }
}

async function onDelete(row: AccessoryItem) {
  try {
    await ElMessageBox.confirm('确定删除该辅料记录？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteAccessory(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(() => load())
</script>
