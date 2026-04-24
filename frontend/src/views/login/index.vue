<template>
  <div class="login-page">
    <div v-if="backendStatus === 'fail'" class="backend-error">
      无法连接后端，请确认后端已启动（在 backend 目录执行 npm run start:dev）。若已启动，仍可直接输入下方信息登录。
    </div>
    <div v-else-if="backendStatus === 'ok'" class="backend-ok">后端已连接</div>
    <el-card class="login-card" :style="{ position: 'relative', zIndex: 10 }">
      <template #header>
        <span class="card-title">ERP 后台登录</span>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="onSubmit">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="onSubmit">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { getHealth } from '@/api/health'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance | null>(null)

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const backendStatus = ref<'ok' | 'fail' | ''>('')
const HEALTH_RETRY_INTERVAL_MS = 2000
const HEALTH_RETRY_MAX_ATTEMPTS = 15
let backendHealthRetryTimer: number | null = null
let backendHealthRetryAttempts = 0

function stopBackendHealthRetry() {
  if (backendHealthRetryTimer != null) {
    window.clearTimeout(backendHealthRetryTimer)
    backendHealthRetryTimer = null
  }
}

function scheduleBackendHealthRetry() {
  stopBackendHealthRetry()
  backendHealthRetryTimer = window.setTimeout(() => {
    void checkBackendHealth()
  }, HEALTH_RETRY_INTERVAL_MS)
}

async function checkBackendHealth() {
  try {
    const res = await getHealth()
    backendStatus.value = res.data?.status === 'ok' ? 'ok' : 'fail'
    stopBackendHealthRetry()
  } catch {
    backendHealthRetryAttempts += 1
    if (backendHealthRetryAttempts < HEALTH_RETRY_MAX_ATTEMPTS) {
      backendStatus.value = ''
      scheduleBackendHealthRetry()
      return
    }
    backendStatus.value = 'fail'
    stopBackendHealthRetry()
  }
}

onMounted(async () => {
  void checkBackendHealth()
})
onBeforeUnmount(() => {
  stopBackendHealthRetry()
})
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.replace('/')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      const fallback = (e as { code?: string })?.code === 'ERR_NETWORK' || !(e as { response?: unknown })?.response
        ? '无法连接后端，请确认后端已启动（npm run start:dev）'
        : '登录失败'
      ElMessage.error(getErrorMessage(e, fallback))
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
}
.login-card {
  width: 360px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}
.card-title {
  font-size: var(--font-size-subtitle);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.backend-error {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: var(--space-sm);
  background: var(--color-danger);
  color: var(--color-white);
  text-align: center;
  z-index: 2000;
  pointer-events: none; /* 不阻挡下方输入框和按钮的点击 */
}
.backend-ok {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-success);
  color: var(--color-white);
  text-align: center;
  z-index: 2000;
  pointer-events: none;
}
</style>
