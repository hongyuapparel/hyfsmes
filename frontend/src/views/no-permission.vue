<template>
  <div class="no-permission">
    <el-result icon="warning" title="403" sub-title="无权限访问该页面">
      <template #extra>
        <el-button type="primary" @click="$router.replace('/')">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.no-permission {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
