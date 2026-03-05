<template>
  <div class="page-card">
    <p class="settings-hint">配置产品相关选项，用于客户管理、产品列表等页面的下拉选择。业务员选项来自「角色管理」中编码为「业务员」的角色对应的用户。</p>

    <OptionList type="product_groups" label="产品分组" />
  </div>
</template>

<script setup lang="ts">
import OptionList from './product-option-list.vue'
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}
</style>
