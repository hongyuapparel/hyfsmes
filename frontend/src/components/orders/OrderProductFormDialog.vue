<template>
  <div>
    <input
      ref="imageFileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="image-file-input-hidden"
      @change="onImageFileChange"
    />
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑产品' : '新建SKU'"
      width="520"
      class="product-form-dialog"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100">
        <el-form-item
          v-for="f in formFields"
          :key="f.code"
          :label="f.label"
          :prop="f.code === 'companyName' ? 'customerId' : f.code"
        >
          <el-select
            v-if="f.code === 'companyName'"
            v-model="form.customerId"
            placeholder="选择客户"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option v-for="c in customers" :key="c.id" :label="c.companyName" :value="c.id" />
          </el-select>
          <el-input
            v-else-if="f.type === 'text'"
            v-model="form[f.code]"
            :placeholder="f.code === 'productName' ? '建议补充场景/版型/面料（如：紧身运动速干T恤）' : f.placeholder"
            :disabled="f.code === 'skuCode' && isEdit"
          />
          <div v-else-if="f.type === 'image'" class="image-upload-wrap" v-loading="imageUploading" element-loading-text="上传中...">
            <div
              class="image-upload-area"
              :class="{ 'has-image': form[f.code], 'drag-over': imageDragOver }"
              @click="imageUploadAreaClick"
              @paste.prevent="onImagePaste"
              @dragover.prevent="imageDragOver = true"
              @dragleave="imageDragOver = false"
              @drop.prevent="onImageDrop"
            >
              <template v-if="form[f.code]">
                <el-image
                  :src="String(form[f.code] || '')"
                  fit="contain"
                  class="image-preview"
                  :preview-teleported="true"
                  :preview-src-list="[String(form[f.code] || '')]"
                />
                <el-button type="primary" link size="small" class="image-reupload" @click.stop="imageUploadAreaClick">重新上传</el-button>
                <el-button type="danger" link size="small" class="image-clear" @click.stop="form[f.code] = ''">移除</el-button>
              </template>
              <template v-else>
                <span class="image-upload-hint">{{ imageDragOver ? '松开上传' : '点击上传、拖拽或粘贴图片' }}</span>
              </template>
            </div>
          </div>
          <el-tree-select
            v-else-if="f.type === 'select' && f.code === 'productGroup'"
            v-model="form[f.code]"
            :data="productGroupTreeSelectData"
            :placeholder="f.placeholder"
            filterable
            default-expand-all
            :render-after-expand="false"
            node-key="value"
            :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
            style="width: 100%"
          />
          <el-select
            v-else-if="f.type === 'select'"
            v-model="form[f.code]"
            :placeholder="f.placeholder"
            filterable
            :allow-create="f.optionsKey !== 'customers'"
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="opt in getOptions(f)" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { checkSkuExists, createProduct, getNextSkuCode, updateProduct, type ProductItem } from '@/api/products'
import { uploadImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface ProductField {
  code: string
  label: string
  type: string
  optionsKey?: string
  placeholder?: string
}

const props = defineProps<{
  formFields: ProductField[]
  productGroupOptions: { id: number; path: string }[]
  productGroupTreeSelectData: { label: string; value: number; children?: unknown[]; disabled?: boolean }[]
  salespeople: string[]
  customers: { id: number; companyName: string }[]
  applicablePeopleOptions: { id: number; value: string }[]
}>()

const emit = defineEmits<{
  success: []
}>()

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const submitLoading = ref(false)
const imageDragOver = ref(false)
const imageUploading = ref(false)
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<Record<string, string | number | null>>({})

const formRules = computed<FormRules>(() => {
  const rules: FormRules = {}
  for (const f of props.formFields) {
    if (f.code === 'skuCode') {
      rules[f.code] = [
        { required: true, message: `请输入${f.label}`, trigger: 'blur' },
        {
          validator: async (_rule, value) => {
            if (!value || isEdit.value) return
            const res = await checkSkuExists(String(value))
            if (res.data?.exists) throw new Error('SKU 编号已存在，不可重复')
          },
          trigger: 'blur',
        },
      ]
    } else if (f.code === 'productGroup') {
      rules[f.code] = [{ required: true, message: `请选择${f.label}`, trigger: 'change' }]
    } else if (f.code === 'imageUrl') {
      rules[f.code] = [{ required: true, message: '请上传产品图片', trigger: 'change' }]
    }
  }
  return rules
})

function getOptions(f: { optionsKey?: string }) {
  if (f.optionsKey === 'productGroups') return props.productGroupOptions.map((g) => ({ label: g.path, value: g.id }))
  if (f.optionsKey === 'applicablePeople') return props.applicablePeopleOptions.map((o) => ({ label: o.value, value: o.id }))
  if (f.optionsKey === 'salespeople') return props.salespeople.map((s) => ({ label: s, value: s }))
  if (f.optionsKey === 'customers') return props.customers.map((c) => ({ label: c.companyName, value: c.id }))
  return []
}

function resetForm() {
  formRef.value?.resetFields()
}

async function openCreate() {
  isEdit.value = false
  editId.value = 0
  form.customerId = null
  for (const f of props.formFields) form[f.code] = ''
  try {
    const res = await getNextSkuCode()
    form.skuCode = (res.data ?? '').toString() || ''
  } catch {
    form.skuCode = ''
  }
  dialogVisible.value = true
}

function openEdit(row: ProductItem) {
  isEdit.value = true
  editId.value = row.id
  form.customerId = row.customerId ?? null
  for (const f of props.formFields) {
    if (f.code === 'companyName') continue
    if (f.code === 'productGroup') {
      form.productGroup = row.productGroupId != null ? row.productGroupId : ''
      continue
    }
    if (f.code === 'applicablePeople') {
      form.applicablePeople = row.applicablePeopleId != null ? row.applicablePeopleId : ''
      continue
    }
    const value = row[f.code as keyof ProductItem]
    form[f.code] = value != null ? (typeof value === 'number' ? value : String(value)) : ''
  }
  dialogVisible.value = true
}

function imageUploadAreaClick() {
  imageFileInputRef.value?.click()
}

async function doUploadImage(file: File) {
  if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
    ElMessage.warning('请上传 jpg、png、gif 或 webp 格式的图片')
    return
  }
  imageUploading.value = true
  try {
    const url = await uploadImage(file)
    form.imageUrl = url
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    imageUploading.value = false
  }
}

function onImageFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void doUploadImage(file)
  input.value = ''
}

function onImagePaste(e: ClipboardEvent) {
  const file = Array.from(e.clipboardData?.files ?? []).find((f) => /^image\//.test(f.type))
  if (file) void doUploadImage(file)
}

function onImageDrop(e: DragEvent) {
  imageDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && /^image\//.test(file.type)) void doUploadImage(file)
}

async function submit() {
  await formRef.value?.validate()
  submitLoading.value = true
  try {
    const payload: Record<string, string | number | null> = {}
    for (const f of props.formFields) {
      if (f.code === 'companyName') {
        payload.customerId = form.customerId === '' || form.customerId == null ? null : (form.customerId as number)
        continue
      }
      const value = form[f.code]
      payload[f.code] = value === '' ? null : value
    }
    const body: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'productGroup') {
        body.product_group_id = value === '' || value === null ? null : value
        continue
      }
      if (key === 'applicablePeople') {
        body.applicable_people_id = value === '' || value === null ? null : value
        continue
      }
      const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
      body[snake] = value
    }
    if (isEdit.value) {
      delete body.sku_code
      await updateProduct(editId.value, body)
      ElMessage.success('保存成功')
    } else {
      await createProduct(body)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    emit('success')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitLoading.value = false
  }
}

defineExpose({
  openCreate,
  openEdit,
})
</script>

<style scoped>
.image-file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  left: -9999px;
}
.image-upload-wrap {
  width: 100%;
  position: relative;
}
.image-upload-area {
  min-height: 120px;
  border: 1px dashed var(--color-border, #dcdfe6);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.image-upload-area:hover,
.image-upload-area.drag-over {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.image-upload-area.has-image {
  position: relative;
  padding: var(--space-xs);
  min-height: 100px;
}
.image-upload-hint {
  font-size: var(--font-size-caption);
  color: var(--color-muted-foreground, #7f8b99);
}
.image-preview {
  width: 100px;
  height: 100px;
  border-radius: var(--radius);
}
.image-clear {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
}

.image-reupload {
  position: absolute;
  right: var(--space-xs);
  bottom: var(--space-xs);
}
</style>
