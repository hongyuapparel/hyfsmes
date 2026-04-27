<template>
  <div class="foreign-tool-page">
    <iframe
      v-if="iframeSrc"
      :src="iframeSrc"
      class="foreign-tool-iframe"
      title="外贸小工具"
    />
    <el-empty v-else description="请配置外贸小工具地址" />
  </div>
</template>

<script setup lang="ts">
/**
 * 外贸小工具嵌入页（iframe）- 鸿宇外贸助手
 * 可见性由「系统设置 → 角色与权限」中「外贸小工具」菜单权限控制。
 */
const iframeSrc = 'https://hongyu-tools.vercel.app/'
</script>

<style scoped>
.foreign-tool-page {
  height: 100%;
  min-height: 400px;
  background: var(--el-bg-color-page, #f5f7fa);
}

.foreign-tool-iframe {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 120px);
  border: none;
  display: block;
}
</style>
