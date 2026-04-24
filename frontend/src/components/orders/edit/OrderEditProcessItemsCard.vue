<template>
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
            <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.name" />
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
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'

defineProps<{
  processItems: any[]
  processOptions: any[]
  supplierOptions: Array<{ id: number; name: string }>
  supplierLoading: boolean
  addProcessRow: () => void
  removeProcessRow: (index: number) => void
  searchProcessSuppliers: (keyword: string) => void
}>()
</script>
