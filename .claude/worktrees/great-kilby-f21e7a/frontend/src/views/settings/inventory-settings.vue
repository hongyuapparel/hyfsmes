<template>
  <div class="page-card">
    <p class="settings-hint">
      配置库存相关下拉选项：包括仓库列表（如成品仓1楼、辅料仓2楼、退货仓3楼等）和库存类型（如自产-亚马逊、自产-SHEIN、自产-TEMU、自产-B2B多余、次品等）。
      这些选项会在成品库存及相关页面中统一复用，保证含义和取值一致，便于后续做库存成本统计。
    </p>

    <div class="settings-body">
      <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
        <el-tab-pane label="仓库设置" name="warehouses" />
        <el-tab-pane label="库存类型" name="inventoryTypes" />
      </el-tabs>

      <div class="settings-content">
        <template v-if="activeTab === 'warehouses'">
          <h3 class="section-title">仓库设置</h3>
          <p class="section-desc">
            建议将仓库名称直接写成「仓库 + 楼层 / 区域」，例如「成品仓-1楼」「辅料仓-2楼」「退货仓-3楼」等；
            库位将在库存页面中以文本形式补充填写，不在此处配置。
          </p>
          <OptionList type="warehouses" label="仓库名称" />
        </template>

        <template v-else>
          <h3 class="section-title">库存类型</h3>
          <p class="section-desc">
            用于区分库存的业务归属或用途，例如「自产-亚马逊」「自产-SHEIN」「自产-TEMU」「自产-B2B多余」「次品」等。
            成品库存新增和列表筛选都会使用此字段，便于按类型统计库存数量与成本。
          </p>
          <OptionList type="inventory_types" label="库存类型" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import OptionList from './product-option-list.vue'

type InventoryTab = 'warehouses' | 'inventoryTypes'
const activeTab = ref<InventoryTab>('warehouses')
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}

.settings-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
}

.settings-tabs {
  min-width: 140px;
}

.settings-content {
  flex: 1;
}

.section-title {
  font-size: var(--font-size-subtitle);
  margin-bottom: var(--space-xs);
}

.section-desc {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}
</style>

