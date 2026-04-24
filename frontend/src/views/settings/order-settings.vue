<template>
  <div class="page-card">
    <p class="settings-hint">
      配置订单相关下拉选项，如订单类型、合作方式、产品分组、物料类型等，这些选项会在订单相关页面中统一复用，保证含义和取值一致。生产工序用于订单成本页勾选并汇总工序单价。
    </p>

    <div class="settings-body">
      <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
        <el-tab-pane label="订单类型" name="orderTypes" />
        <el-tab-pane label="合作方式" name="collaboration" />
        <el-tab-pane label="产品分组" name="productGroups" />
        <el-tab-pane label="适用人群" name="applicablePeople" />
        <el-tab-pane label="物料类型" name="materialTypes" />
        <el-tab-pane label="物料来源" name="materialSources" />
        <el-tab-pane label="生产工序" name="productionProcesses" />
        <el-tab-pane label="订单时效配置" name="orderSla" />
        <el-tab-pane label="订单流转规则" name="orderStatusConfig" />
      </el-tabs>

      <div class="settings-content">
        <div v-show="activeTab === 'orderTypes'">
          <h3 class="section-title">订单类型</h3>
          <OptionList type="order_types" label="订单类型" />
        </div>
        <div v-show="activeTab === 'collaboration'">
          <h3 class="section-title">合作方式</h3>
          <OptionList type="collaboration" label="合作方式" />
        </div>
        <div v-show="activeTab === 'productGroups'">
          <h3 class="section-title">产品分组</h3>
          <OptionList type="product_groups" label="产品分组" />
        </div>
        <div v-show="activeTab === 'applicablePeople'">
          <h3 class="section-title">适用人群</h3>
          <OptionList type="applicable_people" label="适用人群" />
        </div>
        <div v-show="activeTab === 'materialTypes'">
          <h3 class="section-title">物料类型</h3>
          <OptionList type="material_types" label="物料类型" />
        </div>
        <div v-show="activeTab === 'materialSources'">
          <h3 class="section-title">物料来源</h3>
          <OptionList type="material_sources" label="物料来源" />
        </div>

        <OrderProductionProcessesCard :active="activeTab === 'productionProcesses'" />
        <OrderSlaSettingsCard
          :active="activeTab === 'orderSla'"
          :status-list="statusState.statusList.value"
          :ensure-statuses="ensureStatusesLoaded"
        />
        <OrderStatusConfigCard :active="activeTab === 'orderStatusConfig'" :state="statusState" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import OptionList from './product-option-list.vue'
import OrderProductionProcessesCard from '@/components/settings/OrderProductionProcessesCard.vue'
import OrderSlaSettingsCard from '@/components/settings/OrderSlaSettingsCard.vue'
import OrderStatusConfigCard from '@/components/settings/OrderStatusConfigCard.vue'
import { useOrderSettingsStatus } from '@/composables/useOrderSettingsStatus'

const activeTab = ref<
  | 'orderTypes'
  | 'collaboration'
  | 'productGroups'
  | 'applicablePeople'
  | 'materialTypes'
  | 'materialSources'
  | 'productionProcesses'
  | 'orderSla'
  | 'orderStatusConfig'
>('orderStatusConfig')

const statusState = useOrderSettingsStatus()

async function ensureStatusesLoaded() {
  if (!statusState.statusList.value.length) {
    await statusState.loadStatuses()
  }
}
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
}

.settings-tabs {
  width: 160px;
  margin-right: var(--space-lg);
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.section-title {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: 600;
}
</style>
