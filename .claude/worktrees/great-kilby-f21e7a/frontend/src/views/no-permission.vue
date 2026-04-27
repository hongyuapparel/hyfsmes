<template>
  <div class="no-permission">
    <el-result icon="warning" title="403" sub-title="无权限访问该页面">
      <template #extra>
        <el-button type="primary" @click="goBackToAccessiblePage">返回首页</el-button>
        <el-button @click="logoutAndGoLogin">退出登录</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function goBackToAccessiblePage() {
  // 优先主页；若无主页权限，则回到当前账号第一个可访问页面
  const routes = auth.permissionRoutes
  const target = routes.includes('/') ? '/' : (routes[0] || '/login')
  await router.replace(target)
}

async function logoutAndGoLogin() {
  auth.logout()
  await router.replace('/login')
}
</script>

<style scoped>
.no-permission {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
