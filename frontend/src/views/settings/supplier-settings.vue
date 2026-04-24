<template>
  <div class="page-card">
    <p class="settings-hint">
      配置供应商类型与业务范围：树形展示，一级为供应商类型，二级为业务范围父分组，三级为业务范围子分组。新建/编辑供应商时，类型与业务范围下拉将按此配置联动显示。
    </p>
    <SupplierSettingsManager />
  </div>
</template>

<script setup lang="ts">
import SupplierSettingsManager from '@/components/settings/SupplierSettingsManager.vue'
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}
</style>
