# 服装生产管理系统 - 核心页面示例代码

## 1. 登录页面 (Login.vue)

```vue
<template>
  <div class="login-container">
    <!-- 品牌区域 -->
    <div class="brand-section">
      <div class="brand-logo">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="24" fill="#0052CC"/>
          <path d="M16 24L20 28L32 16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 class="brand-title">服装生产管理系统</h1>
      <p class="brand-subtitle">Professional Clothing Production Management</p>
    </div>

    <!-- 登录表单 -->
    <div class="login-form-wrapper">
      <div class="form-header">
        <h2>欢迎登录</h2>
        <p>使用您的账户凭证进行登录</p>
      </div>

      <el-form 
        ref="formRef"
        :model="loginForm"
        :rules="rules"
        @submit.prevent="handleLogin"
        class="login-form"
      >
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username"
            placeholder="用户名"
            prefix-icon="User"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <div class="form-options">
          <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
          <el-link href="#">忘记密码？</el-link>
        </div>

        <el-button 
          type="primary" 
          size="large"
          style="width: 100%"
          :loading="isLoading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>

      <div class="form-footer">
        <span>还没有账户？</span>
        <el-link href="#">立即注册</el-link>
      </div>
    </div>

    <!-- 右侧装饰区域 -->
    <div class="decoration-section">
      <div class="decoration-card">
        <div class="card-icon">📊</div>
        <h3>实时数据</h3>
        <p>掌握生产进度和库存信息</p>
      </div>
      <div class="decoration-card">
        <div class="card-icon">👥</div>
        <h3>团队管理</h3>
        <p>高效的员工和权限管理系统</p>
      </div>
      <div class="decoration-card">
        <div class="card-icon">⚡</div>
        <h3>智能分析</h3>
        <p>基于数据的生产管理决策</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, FormInstance } from 'element-plus'
import { useAuthStore } from '@stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()

const isLoading = ref(false)
const rememberMe = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 50, message: '密码长度 6-50 个字符', trigger: 'blur' },
  ],
}

const handleLogin = async () => {
  try {
    await formRef.value?.validate()
    isLoading.value = true

    // 调用登录接口
    await authStore.login(loginForm.username, loginForm.password)

    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (error) {
    ElMessage.error('登录失败，请检查用户名和密码')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #0052CC 0%, #00D9FF 100%);
}

/* 左侧品牌区域 */
.brand-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  padding: 40px;
}

.brand-logo {
  margin-bottom: 24px;
}

.brand-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
  text-align: center;
}

.brand-subtitle {
  font-size: 14px;
  opacity: 0.9;
  text-align: center;
}

/* 中间登录表单 */
.login-form-wrapper {
  width: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
}

.form-header {
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 8px;
}

.form-header p {
  font-size: 14px;
  color: #6B7280;
}

.login-form {
  margin-bottom: 24px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-size: 14px;
}

.form-footer {
  text-align: center;
  font-size: 14px;
  color: #6B7280;
}

.form-footer span {
  margin-right: 8px;
}

/* 右侧装饰区域 */
.decoration-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 40px;
}

.decoration-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 24px;
  width: 280px;
  text-align: center;
  color: white;
  transition: all 0.3s ease;
}

.decoration-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-4px);
}

.card-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.decoration-card h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.decoration-card p {
  font-size: 12px;
  opacity: 0.9;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .login-container {
    flex-direction: column;
  }

  .brand-section {
    padding: 30px;
  }

  .login-form-wrapper {
    width: 100%;
    max-width: 400px;
  }

  .decoration-section {
    flex-direction: row;
    gap: 16px;
  }

  .decoration-card {
    width: 150px;
    padding: 16px;
  }
}

@media (max-width: 768px) {
  .login-container {
    padding: 20px;
  }

  .login-form-wrapper {
    width: 100%;
    padding: 30px 20px;
  }

  .brand-title {
    font-size: 24px;
  }

  .decoration-section {
    gap: 12px;
  }

  .decoration-card {
    width: calc(100% / 3 - 8px);
  }
}
</style>
```

---

## 2. 仪表板页面 (Dashboard.vue)

```vue
<template>
  <div class="dashboard-container">
    <!-- 顶部统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(0, 82, 204, 0.1);">
          <ShoppingCart size="24" color="#0052CC" />
        </div>
        <div>
          <p class="stat-label">今日订单</p>
          <h3 class="stat-value">{{ todayOrders }}</h3>
          <p class="stat-trend">相比昨天 +12%</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1);">
          <Check size="24" color="#10B981" />
        </div>
        <div>
          <p class="stat-label">完成率</p>
          <h3 class="stat-value">{{ completionRate }}%</h3>
          <p class="stat-trend">本月目标</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1);">
          <AlertCircle size="24" color="#F59E0B" />
        </div>
        <div>
          <p class="stat-label">待审核</p>
          <h3 class="stat-value">{{ pendingReview }}</h3>
          <p class="stat-trend">需要处理</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1);">
          <AlertTriangle size="24" color="#EF4444" />
        </div>
        <div>
          <p class="stat-label">库存预警</p>
          <h3 class="stat-value">{{ lowStockCount }}</h3>
          <p class="stat-trend">需补货</p>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="dashboard-content">
      <!-- 生产进度 -->
      <div class="content-card">
        <div class="card-header">
          <h2>生产进度概览</h2>
          <el-select v-model="selectedMonth" placeholder="选择月份" style="width: 120px;">
            <el-option label="本月" value="current" />
            <el-option label="上月" value="last" />
            <el-option label="三月" value="three" />
          </el-select>
        </div>
        <div class="chart-container">
          <!-- 这里可以集成 ECharts -->
          <div style="text-align: center; padding: 40px; color: #9CA3AF;">
            生产进度趋势图表
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <h2 style="margin-bottom: 16px;">快速操作</h2>
        <div class="action-buttons">
          <el-button type="primary" size="large">
            <Plus size="20" />
            新建订单
          </el-button>
          <el-button size="large">
            <FileText size="20" />
            生成报告
          </el-button>
          <el-button size="large">
            <Users size="20" />
            员工管理
          </el-button>
          <el-button size="large">
            <Settings size="20" />
            系统设置
          </el-button>
        </div>
      </div>

      <!-- 最近订单 -->
      <div class="content-card">
        <div class="card-header">
          <h2>最近订单</h2>
          <el-link href="/orders">查看全部 →</el-link>
        </div>
        <el-table :data="recentOrders" stripe style="width: 100%;">
          <el-table-column prop="orderNo" label="订单号" width="120" />
          <el-table-column prop="customerName" label="客户名称" />
          <el-table-column prop="totalAmount" label="金额" align="right">
            <template #default="{ row }">
              ¥{{ row.totalAmount.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  ShoppingCart,
  Check,
  AlertCircle,
  AlertTriangle,
  Plus,
  FileText,
  Users,
  Settings,
} from '@element-plus/icons-vue'

// 数据
const todayOrders = ref(24)
const completionRate = ref(87)
const pendingReview = ref(5)
const lowStockCount = ref(8)
const selectedMonth = ref('current')

const recentOrders = ref([
  {
    orderNo: 'ORD-2026-001',
    customerName: '服装厂 A',
    totalAmount: 15000,
    status: 'completed',
  },
  {
    orderNo: 'ORD-2026-002',
    customerName: '服装厂 B',
    totalAmount: 22000,
    status: 'processing',
  },
  {
    orderNo: 'ORD-2026-003',
    customerName: '服装厂 C',
    totalAmount: 18500,
    status: 'pending',
  },
])

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    completed: 'success',
    processing: 'warning',
    pending: 'info',
  }
  return types[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    completed: '已完成',
    processing: '进行中',
    pending: '待审核',
  }
  return labels[status] || '未知'
}

onMounted(() => {
  // 加载仪表板数据
})
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  gap: 16px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #E5E7EB;
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-label {
  font-size: 12px;
  color: #6B7280;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1F2937;
  margin: 0;
}

.stat-trend {
  font-size: 12px;
  color: #10B981;
  margin-top: 4px;
}

/* 主内容区 */
.dashboard-content {
  display: grid;
  gap: 24px;
}

.content-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #E5E7EB;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
}

.card-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1F2937;
  margin: 0;
}

.chart-container {
  min-height: 300px;
  background: #F9FAFB;
  border-radius: 6px;
}

/* 快捷操作 */
.quick-actions {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #E5E7EB;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.action-buttons :deep(.el-button) {
  height: 40px;
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .action-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 16px;
  }

  .action-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
```

---

## 3. 简明组件复用指南

### ✅ 按照本设计系统使用：
- 颜色始终使用 CSS 变量（如 `var(--el-color-primary)`）
- 间距使用统一的间距工具类或值（16px、20px、24px等）
- 圆角统一使用 6px（md）或 8px（lg）
- 字体和字号使用规范中定义的值

### ✅ 快速创建新页面：
1. 复制上方的登录页或仪表板代码结构
2. 替换业务逻辑和数据
3. 保持样式结构和命名规范一致
4. 使用 Element Plus 组件替代原生 HTML

### ✅ 常用 Element Plus 组件：
- `el-button`：按钮（支持 type、size、loading）
- `el-card`：卡片
- `el-table`：表格
- `el-form`：表单
- `el-dialog`：弹窗
- `el-message`：提示
- `el-notification`：通知

---

**本文档对应的文件完整代码已提供，可直接复制使用。**
