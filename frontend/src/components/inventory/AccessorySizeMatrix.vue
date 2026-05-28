<template>
  <div class="accessory-size-matrix">
    <div v-if="!readonly && !headersReadonly" class="size-matrix-head">
      <span class="size-matrix-tip">按尺码分别录入数量，总量自动汇总</span>
      <el-button type="primary" link size="small" @click="addSize">+ 尺码</el-button>
    </div>
    <div class="size-matrix-table-wrap">
      <el-table :data="singleRow" border size="small" class="size-matrix-table">
        <el-table-column
          v-for="(size, idx) in sizeHeaders"
          :key="`acc-size-${idx}`"
          min-width="78"
          align="center"
          header-align="center"
        >
          <template #header>
            <div v-if="!readonly && !headersReadonly" class="b-header-cell">
              <el-input
                :model-value="sizeHeaders[idx]"
                size="small"
                class="b-header-input"
                placeholder="尺码"
                :input-style="{ textAlign: 'center' }"
                @update:model-value="(v) => setHeader(idx, String(v ?? ''))"
              />
              <div class="b-header-actions">
                <el-button
                  v-if="sizeHeaders.length > 1"
                  link
                  type="danger"
                  size="small"
                  class="b-header-remove"
                  @click.stop="removeSize(idx)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </div>
            <span v-else>{{ size }}</span>
          </template>
          <template #default>
            <el-input-number
              v-if="!readonly"
              :model-value="numQty(idx)"
              :min="0"
              :precision="0"
              :controls="false"
              size="small"
              style="width: 100%"
              @update:model-value="(v) => setQty(idx, v)"
            />
            <span v-else :class="{ 'qty-negative': numQty(idx) < 0 }">{{ numQty(idx) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合计" width="72" align="center" header-align="center">
          <template #default>
            <span :class="{ 'qty-negative': total < 0 }">{{ total }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { sumDetailRowQty } from '@/utils/finishedStockTableUtils'
import { nextAccessorySizeLabel } from '@/utils/accessorySizeMatrix'

withDefaults(defineProps<{ readonly?: boolean; headersReadonly?: boolean }>(), {
  readonly: false,
  headersReadonly: false,
})

const sizeHeaders = defineModel<string[]>('sizeHeaders', { required: true })
const sizeQuantities = defineModel<number[]>('sizeQuantities', { required: true })

const singleRow = [{ _placeholder: true }]

const total = computed(() => sumDetailRowQty(sizeQuantities.value))

function numQty(idx: number): number {
  return Number(sizeQuantities.value?.[idx]) || 0
}

function setHeader(idx: number, value: string): void {
  const next = [...sizeHeaders.value]
  next[idx] = value
  sizeHeaders.value = next
}

function setQty(idx: number, value: number | undefined | null): void {
  const next = [...sizeQuantities.value]
  next[idx] = Number(value) || 0
  sizeQuantities.value = next
}

function addSize(): void {
  sizeHeaders.value = [...sizeHeaders.value, nextAccessorySizeLabel(sizeHeaders.value)]
  sizeQuantities.value = [...sizeQuantities.value, 0]
}

function removeSize(idx: number): void {
  sizeHeaders.value = sizeHeaders.value.filter((_, i) => i !== idx)
  sizeQuantities.value = sizeQuantities.value.filter((_, i) => i !== idx)
}
</script>

<style scoped>
.accessory-size-matrix { width: 100%; }
.size-matrix-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.size-matrix-tip { font-size: 12px; color: var(--el-text-color-secondary); }
.size-matrix-table-wrap { width: 100%; border: 1px solid var(--el-border-color); border-radius: var(--el-border-radius-base); overflow: hidden; }
.size-matrix-table { width: 100%; margin: 0; }
.size-matrix-table :deep(.el-table__inner-wrapper)::before { display: none; }
.b-header-cell { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; }
.b-header-input { width: 100%; flex: 1; min-width: 0; }
.b-header-input :deep(.el-input__wrapper) { padding-left: 6px; padding-right: 6px; }
.b-header-input :deep(.el-input__inner) { text-align: center; }
.b-header-actions { position: absolute; top: 50%; right: -2px; transform: translateY(-50%); display: flex; align-items: center; opacity: 0; transition: opacity 0.15s; }
.b-header-remove { width: 14px; height: 14px; padding: 0; min-height: 14px; min-width: 14px; display: flex; align-items: center; justify-content: center; }
.b-header-remove :deep(.el-icon) { font-size: 8px; line-height: 8px; }
.b-header-cell:hover .b-header-actions { opacity: 1; }
.qty-negative { color: var(--el-color-danger); font-weight: 600; }
:deep(.size-matrix-table .cell) { display: flex; align-items: center; justify-content: center; text-align: center; padding: 2px 4px; }
:deep(.size-matrix-table .el-input-number) { width: 100%; }
:deep(.size-matrix-table .el-input__inner) { text-align: center; }
</style>
