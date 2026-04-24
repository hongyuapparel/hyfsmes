<template>
  <div class="page-card">
    <p class="settings-hint">
      维护公司组织架构：左侧为部门树，右侧为选中部门下的岗位列表。人事管理等页面将复用这里的配置，通过 ID 关联，改名后历史数据自动同步。
    </p>
    <HrSettingsOrgManager />
  </div>
</template>

<script setup lang="ts">
import HrSettingsOrgManager from '@/components/settings/HrSettingsOrgManager.vue'
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}
</style>

