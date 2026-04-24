<template>
  <el-dialog
    v-model="visibleModel"
    title="从小满导入客户"
    width="720"
    class="xiaoman-import-dialog"
    :close-on-click-modal="false"
    @open="$emit('open')"
    @close="$emit('close')"
  >
    <div v-loading="loading" class="xiaoman-content">
      <div v-if="result" class="xiaoman-result">
        <p>导入完成：成功 {{ result.imported }} 个，跳过 {{ result.skipped }} 个</p>
        <p v-if="result.errors?.length" class="xiaoman-errors">
          失败：{{ result.errors.join('；') }}
        </p>
        <el-button type="primary" @click="$emit('close-refresh')">关闭并刷新</el-button>
      </div>
      <template v-else>
        <div class="xiaoman-search-bar">
          <el-input
            v-model="keywordModel"
            placeholder="公司名称或客户编号搜索"
            clearable
            class="xiaoman-search-input"
            @keyup.enter="$emit('search')"
            @clear="$emit('clear')"
          />
          <el-button type="primary" @click="$emit('search')">搜索</el-button>
        </div>

        <div v-if="selectedCount" class="table-selection-count">已选 {{ selectedCount }} 项</div>

        <el-table
          :data="list"
          border
          stripe
          max-height="320"
          @selection-change="$emit('selection-change', $event)"
        >
          <el-table-column
            type="selection"
            width="50"
            align="center"
            header-align="center"
            class-name="selection-column"
            header-class-name="selection-column"
          />
          <el-table-column prop="serial_id" label="客户编号" min-width="120" show-overflow-tooltip />
          <el-table-column prop="name" label="公司名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="contactPerson" label="联系人" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.contactPerson || '-' }}
            </template>
          </el-table-column>
        </el-table>

        <div class="xiaoman-pagination">
          <el-pagination
            v-model:current-page="pageModel"
            v-model:page-size="pageSizeModel"
            :total="paginationTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            small
            @current-change="$emit('page-change')"
            @size-change="$emit('size-change')"
          />
        </div>
      </template>
    </div>

    <template v-if="!result" #footer>
      <el-button @click="visibleModel = false">取消</el-button>
      <el-button
        type="primary"
        :loading="importing"
        :disabled="!selectedCount"
        @click="$emit('import')"
      >
        导入选中 ({{ selectedCount }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { XiaomanCompanyItem, XiaomanImportRes } from '@/api/customers'

const props = defineProps<{
  visible: boolean
  loading: boolean
  importing: boolean
  keyword: string
  list: XiaomanCompanyItem[]
  result: XiaomanImportRes | null
  selectedCount: number
  paginationPage: number
  paginationPageSize: number
  paginationTotal: number
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'update:keyword', value: string): void
  (event: 'update:paginationPage', value: number): void
  (event: 'update:paginationPageSize', value: number): void
  (event: 'open'): void
  (event: 'close'): void
  (event: 'search'): void
  (event: 'clear'): void
  (event: 'selection-change', rows: XiaomanCompanyItem[]): void
  (event: 'page-change'): void
  (event: 'size-change'): void
  (event: 'import'): void
  (event: 'close-refresh'): void
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const keywordModel = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value),
})

const pageModel = computed({
  get: () => props.paginationPage,
  set: (value: number) => emit('update:paginationPage', value),
})

const pageSizeModel = computed({
  get: () => props.paginationPageSize,
  set: (value: number) => emit('update:paginationPageSize', value),
})
</script>

<style scoped>
.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.xiaoman-content {
  min-height: 200px;
}

.xiaoman-search-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.xiaoman-search-input {
  flex: 1;
  max-width: 280px;
}

.xiaoman-result {
  padding: var(--space-md);
  text-align: center;
}

.xiaoman-result p {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
}

.xiaoman-errors {
  color: var(--color-error, #f56c6c);
  font-size: var(--font-size-caption);
}

.xiaoman-pagination {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}

:deep(.selection-column .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}
</style>
