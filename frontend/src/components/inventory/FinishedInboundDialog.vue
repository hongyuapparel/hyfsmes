<template>
  <el-dialog
    :model-value="modelValue"
    title="入库（填写货物存放地址）"
    width="440"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
    @close="resetInboundForm"
  >
    <div class="inbound-tip">当前记录：{{ stockLabel || '-' }}</div>
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
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="inboundSubmitting" @click="submitInbound">
        确定入库
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { doPendingInbound } from '@/api/inventory'
import { getDictItems } from '@/api/dicts'
import type { SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const props = defineProps<{
  modelValue: boolean
  stockId: number | null
  stockLabel: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submitted'): void
}>()

const inboundFormRef = ref<FormInstance>()
const inboundSubmitting = ref(false)
const warehouseOptions = ref<{ id: number; label: string }[]>([])
const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
const departmentOptions = ref<{ value: string; label: string }[]>([])
const optionsLoaded = ref(false)

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

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function resetInboundForm() {
  inboundForm.warehouseId = null
  inboundForm.inventoryTypeId = null
  inboundForm.department = ''
  inboundForm.location = ''
  inboundForm.imageUrl = ''
  inboundFormRef.value?.clearValidate()
}

async function loadWarehouseOptions() {
  try {
    const res = await getDictItems('warehouses')
    const list = (res.data ?? []) as SystemOptionItem[]
    warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    warehouseOptions.value = []
  }
}

async function loadInventoryTypeOptions() {
  try {
    const res = await getDictItems('inventory_types')
    const list = (res.data ?? []) as SystemOptionItem[]
    inventoryTypeOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    inventoryTypeOptions.value = []
  }
}

async function loadDepartmentOptions() {
  try {
    const res = await getDictItems('org_departments')
    const list = (res.data ?? []) as SystemOptionItem[]
    departmentOptions.value = list.map((o) => ({ value: o.value, label: o.value }))
  } catch {
    departmentOptions.value = []
  }
}

async function ensureOptionsLoaded() {
  if (optionsLoaded.value) return
  await Promise.all([loadWarehouseOptions(), loadInventoryTypeOptions(), loadDepartmentOptions()])
  optionsLoaded.value = true
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    void ensureOptionsLoaded()
  },
)

async function submitInbound() {
  const valid = await inboundFormRef.value?.validate().then(() => true).catch(() => false)
  if (!valid) return
  if (!props.stockId) {
    ElMessage.warning('未选择待入库记录')
    return
  }
  inboundSubmitting.value = true
  try {
    await doPendingInbound({
      ids: [props.stockId],
      warehouseId: inboundForm.warehouseId,
      inventoryTypeId: inboundForm.inventoryTypeId ?? undefined,
      department: inboundForm.department,
      location: inboundForm.location,
      imageUrl: inboundForm.imageUrl || undefined,
    })
    ElMessage.success('入库成功')
    emit('update:modelValue', false)
    emit('submitted')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    inboundSubmitting.value = false
  }
}
</script>

<style scoped>
.inbound-tip {
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
  font-size: var(--font-size-caption);
}
</style>
