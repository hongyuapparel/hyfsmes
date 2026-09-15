<template>
  <el-alert title="订单已有资料会自动带入，只需核对和补充实际用量。完成前必须有物料名称和大于 0 的单件用量。" type="info" :closable="false" />
  <el-table :data="form.materials" border size="small" :class="{ 'editable-grid': editing }" empty-text="暂无物料，点击修改用料后新增">
    <el-table-column type="index" width="45" />
    <el-table-column label="物料类型" min-width="110">
      <template #default="{ row }">
        <el-select v-if="editing" v-model="row.materialTypeId" clearable filterable :disabled="busy">
          <el-option v-for="option in options" :key="option.id" :label="option.label" :value="option.id" />
        </el-select>
        <span v-else>{{ options.find(item => item.id === row.materialTypeId)?.label || '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="物料名称" min-width="200">
      <template #default="{ row }">
        <el-input v-if="editing" v-model="row.materialName" :disabled="busy" placeholder="填写物料名称" />
        <span v-else>{{ row.materialName || '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="幅宽(cm)" width="105">
      <template #default="{ row }">
        <el-input v-if="editing" v-model="row.fabricWidth" :disabled="busy" />
        <span v-else>{{ row.fabricWidth || '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="单件用量(米)" width="130">
      <template #default="{ row }">
        <el-input-number v-if="editing" v-model="row.usagePerPiece" :min="0" :precision="3" :controls="false" :disabled="busy" style="width: 100%" />
        <span v-else>{{ formatMaterialUsageQtyOrDash(row.usagePerPiece) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="裁片数量" width="105">
      <template #default="{ row }">
        <el-input-number v-if="editing" v-model="row.cuttingQuantity" :min="0" :precision="0" :controls="false" :disabled="busy" style="width: 100%" />
        <span v-else>{{ row.cuttingQuantity ?? '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="备注" min-width="140">
      <template #default="{ row }">
        <el-input v-if="editing" v-model="row.remark" :disabled="busy" />
        <span v-else>{{ row.remark || '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column v-if="editing" label="操作" width="65" fixed="right">
      <template #default="{ $index }"><el-button link type="danger" :disabled="busy" @click="emit('remove', $index)">删除</el-button></template>
    </el-table-column>
  </el-table>
  <div v-if="editing"><el-button type="primary" plain size="small" :disabled="busy" @click="emit('add')">＋ 新增物料</el-button></div>
  <el-form label-position="top">
    <el-form-item label="用料说明" style="margin-bottom: 0">
      <el-input v-if="editing" v-model="form.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :disabled="busy" placeholder="可选" />
      <span v-else>{{ form.remark || '暂无说明' }}</span>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import type { PatternMaterialRow } from '@/api/production-pattern'
import { formatMaterialUsageQtyOrDash } from '@/utils/material-usage-qty'
defineProps<{
  form: { materials: PatternMaterialRow[]; remark: string }
  options: { id: number; label: string }[]
  editing: boolean
  busy: boolean
}>()
const emit = defineEmits<{ add: []; remove: [index: number] }>()
</script>
