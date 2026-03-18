<template>
  <div class="page-card home-page">
    <!-- 问候 + 每日一句鼓励 -->
    <div class="home-welcome">
      <p class="home-greeting">{{ greetingText }}，{{ authStore.user?.displayName || authStore.user?.username || '同事' }}</p>
      <div v-if="encourageItem" class="home-encourage">
        <el-icon class="home-encourage-icon"><component :is="encourageItem.icon" /></el-icon>
        <span class="home-encourage-text">{{ encourageItem.text }}</span>
      </div>
    </div>

    <div class="home-section-head">
      <h2 class="home-section-title">待办事项</h2>
      <el-popover placement="bottom-start" :width="320" trigger="click">
        <template #reference>
          <el-button link type="info" size="small">规则说明</el-button>
        </template>
        <div class="todo-rules-popover">
          <p><strong>待审核：</strong>订单状态为「待审单」(pending_review)，即已提交未审核的订单。</p>
          <p><strong>待我跟单：</strong>订单的跟单员等于当前登录用户的显示名（完全一致），仅非管理员显示。</p>
          <p><strong>即将到期：</strong>客户交期在今日起 7 天内（含今天）。</p>
          <p><strong>待入库：</strong>待入库表中状态为「待处理」的记录（尾部入库后、仓管未完成入库）。</p>
          <p class="todo-rules-hint">全部为 0 时请检查：是否有待审单、交期是否在 7 天内、跟单员是否与当前用户显示名一致、是否有待入库记录。</p>
        </div>
      </el-popover>
    </div>
    <div v-if="hasAnyTodoCard" class="todo-sections">
      <!-- 待审核 -->
      <section
        v-if="canReviewOrders"
        class="todo-section todo-section--default"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <span class="todo-section-title">{{ isAdmin ? '待审核(全部)' : '待我审核' }}</span>
          <span class="todo-section-count">{{ todoCounts.pendingReview }}</span>
          <el-link
            v-if="todoCounts.pendingReview > 0"
            type="primary"
            class="todo-section-link"
            :href="pendingReviewLink"
            @click.prevent="goOrdersList(pendingReviewLink)"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.pendingReview.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>跟单员</th>
                <th>状态时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in todoLists.pendingReview"
                :key="item.id"
                class="todo-row"
                @click="goOrderDetail(item.id)"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</td>
                <td class="ellipsis" :title="item.merchandiser || '-'">{{ item.merchandiser || '-' }}</td>
                <td>{{ formatDate(item.statusTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 待我跟单（仅非管理员） -->
      <section
        v-if="showMyMerchandiser"
        class="todo-section todo-section--default"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <span class="todo-section-title">待我跟单</span>
          <span class="todo-section-count">{{ todoCounts.myMerchandiser }}</span>
          <el-link
            v-if="todoCounts.myMerchandiser > 0"
            type="primary"
            class="todo-section-link"
            :href="myMerchandiserLink"
            @click.prevent="goOrdersList(myMerchandiserLink)"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.myMerchandiser.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>交期</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in todoLists.myMerchandiser"
                :key="item.id"
                class="todo-row"
                @click="goOrderDetail(item.id)"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</td>
                <td>{{ formatDate(item.customerDueDate) }}</td>
                <td class="ellipsis" :title="item.status">{{ item.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 即将到期（预警样式） -->
      <section
        v-if="canAccessOrders"
        class="todo-section todo-section--warning"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <el-icon class="todo-section-icon"><WarningFilled /></el-icon>
          <span class="todo-section-title">{{ isAdmin ? '即将到期(7天内)(全部)' : '即将到期(7天内)' }}</span>
          <span class="todo-section-count">{{ todoCounts.dueSoon }}</span>
          <el-link
            v-if="todoCounts.dueSoon > 0"
            type="warning"
            class="todo-section-link"
            :href="dueSoonLink"
            @click.prevent="goOrdersList(dueSoonLink)"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.dueSoon.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>跟单员</th>
                <th>交期</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in todoLists.dueSoon"
                :key="item.id"
                class="todo-row"
                @click="goOrderDetail(item.id)"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</td>
                <td class="ellipsis" :title="item.merchandiser || '-'">{{ item.merchandiser || '-' }}</td>
                <td>{{ formatDate(item.customerDueDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 待入库 -->
      <section
        v-if="canAccessPendingInbound"
        class="todo-section todo-section--default"
        :class="{ 'todo-section-loading': todoLoading }"
      >
        <div class="todo-section-head">
          <span class="todo-section-title">{{ isAdmin ? '待入库(全部)' : '待入库' }}</span>
          <span class="todo-section-count">{{ todoCounts.pendingInbound }}</span>
          <el-link
            v-if="todoCounts.pendingInbound > 0"
            type="primary"
            class="todo-section-link"
            :to="{ path: '/inventory/pending' }"
          >
            查看全部
          </el-link>
        </div>
        <div v-if="todoLists.pendingInbound.length > 0" class="todo-table-wrap">
          <table class="todo-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>SKU</th>
                <th>待入数量</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in todoLists.pendingInbound"
                :key="`${item.orderId}-${item.skuCode}-${idx}`"
                class="todo-row"
                @click="goPendingInbound"
              >
                <td class="ellipsis" :title="item.orderNo">{{ item.orderNo }}</td>
                <td class="ellipsis" :title="item.skuCode">{{ item.skuCode }}</td>
                <td>{{ item.quantity }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <div v-else class="todo-empty">
      <span>暂无待办事项</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 待办事项统计规则（与后端订单列表、待入库接口一致）：
 *
 * 1. 待审核(全部) / 待我审核
 *    - 条件：订单 status = 'pending_review'（订单提交后、审核前的状态）
 *    - 显示：有 orders_review 权限的用户才请求并展示；管理员标题为「待审核(全部)」
 *
 * 2. 待我跟单（仅非管理员）
 *    - 条件：订单 merchandiser 字段 = 当前用户 displayName（完全一致）
 *    - 显示：非管理员 + 有订单列表权限 + 用户有 displayName 时才展示
 *
 * 3. 即将到期(7天内)
 *    - 条件：订单 customer_due_date 在「今天 00:00」到「今天+7 天 23:59」之间（本地日期）
 *    - 显示：有订单列表权限即展示
 *
 * 4. 待入库(全部) / 待入库
 *    - 条件：表 inbound_pending 中 status = 'pending' 的记录（尾部入库后、仓管未完成入库）
 *    - 显示：有 /inventory/pending 路由权限才请求并展示
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  WarningFilled,
  Sunny,
  StarFilled,
  CircleCheckFilled,
  TrendCharts,
  MagicStick,
  Present,
  Moon,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getOrders } from '@/api/orders'
import type { OrderListItem } from '@/api/orders'
import { getPendingInboundList } from '@/api/inventory-pending'
import type { PendingInboundItem } from '@/api/inventory-pending'

const router = useRouter()
const authStore = useAuthStore()

const TODO_LIST_PAGE_SIZE = 6

/** 按时段问候 */
const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

/**
 * 每日一句鼓励（按类分组，偏小惊喜不说教）
 * 可选 forRoutePath / forPermissionCode 表示仅该权限用户可见
 */
type EncourageItem = { text: string; icon: typeof Sunny; forRoutePath?: string; forPermissionCode?: string }
const ENCOURAGE_ITEMS: EncourageItem[] = [
  // ---------- 岗位相关（仅对应权限用户可见） ----------
  { text: '审单仔细一点，后续会轻松很多。✨', icon: CircleCheckFilled, forPermissionCode: 'orders_review' },
  { text: '待入库及时处理，数据更准。', icon: Present, forRoutePath: '/inventory/pending' },
  { text: '跟单有疑问先记一笔，集中沟通更高效。', icon: TrendCharts },

  // ---------- 天气 ----------
  { text: '今天阳光不错，有空望望窗外。', icon: Sunny },
  { text: '外面有风，开窗透透气。', icon: Moon },
  { text: '下雨天，记得带伞。', icon: Present },
  { text: '天晴，心情也会亮一点。', icon: StarFilled },
  { text: '阴天也适合专心干活。', icon: TrendCharts },

  // ---------- 季节 ----------
  { text: '入秋了，注意加件衣服。', icon: Sunny },
  { text: '春天了，可以多出去走走。', icon: StarFilled },
  { text: '夏天天热，多喝水。', icon: Moon },
  { text: '冬天注意保暖。', icon: Present },

  // ---------- 节日 / 特殊时段 ----------
  { text: '今天过节，尽量早点收工。', icon: Present },
  { text: '假期快到了，撑住。', icon: TrendCharts },
  { text: '节后第一天，慢慢来。', icon: Sunny },
  { text: '周末愉快。', icon: StarFilled },
  { text: '小长假前，事多也别忘了喘口气。', icon: Moon },

  // ---------- 通用·小确幸 ----------
  { text: '今天事多，辛苦了。', icon: StarFilled },
  { text: '忙完这阵，记得喘口气。', icon: Sunny },
  { text: '午休记得动一动，换换脑子。', icon: Moon },
  { text: '下班路上注意安全。', icon: Present },
  { text: '歇一下喝口水，效率更高。', icon: Moon },
  { text: '累了就歇 5 分钟，不丢人。', icon: Sunny },
  { text: '先喝口水，再继续。✨', icon: MagicStick },
  { text: '累了就喘口气，没人会怪你。', icon: Present },
  { text: '午饭好好吃。', icon: CircleCheckFilled },
  { text: '困了就眯几分钟，不丢人。', icon: Moon },
  { text: '对自己好一点，也是今天的 KPI。', icon: Present },
  { text: '再忙也留一点时间给自己。', icon: Moon },
  { text: '忙完这一段，奖励自己一下。✨', icon: Sunny },

  // ---------- 通用·陪伴鼓励 ----------
  { text: '你今天的状态，比昨天又好了那么一点。', icon: Sunny },
  { text: '能把这些待办理清楚的人，可不简单。✨', icon: StarFilled },
  { text: '认真工作的你，真的在发光。', icon: MagicStick },
  { text: '别小看今天的每一步，都在把你带到更好的地方。', icon: TrendCharts },
  { text: '你经手的每一个订单，都在让事情变好。', icon: CircleCheckFilled },
  { text: '节奏稳、执行到位，本身就是一种厉害。', icon: Present },
  { text: '忙归忙，你比 KPI 重要。', icon: Moon },
  { text: '在意细节的人，说的就是你。✨', icon: StarFilled },
  { text: '认真上线了，本身就值得一个赞。', icon: CircleCheckFilled },
  { text: '待办一条条划掉，是不是有点爽？', icon: TrendCharts },
  { text: '你在这儿，事情就在好好推进。', icon: Sunny },
  { text: '重要的事先做，剩下的按节奏来。', icon: MagicStick },
  { text: '和客户、工厂沟通留个痕，省心。', icon: Present },
  { text: '今日事今日毕，交期在心不慌张。', icon: Sunny },
  { text: '别急，一步一步来，你已经在路上了。', icon: Moon },
  { text: '能搞定这些的人，本身就很靠谱。✨', icon: StarFilled },
  { text: '你的时间很贵，先顾好手头的事，系统可以等。', icon: MagicStick },
  { text: '小事做稳了，大事才不慌。', icon: CircleCheckFilled },
  { text: '小目标：比昨天从容一点就好。', icon: TrendCharts },
  { text: '把乱序理成条理，你有一手。', icon: StarFilled },
  { text: '你的认真，客户和同事都看得到。', icon: CircleCheckFilled },
  { text: '问题一个一个解决，你就比昨天更强。', icon: MagicStick },
  { text: '别扛太多，该协作就协作。', icon: Moon },
  { text: '该跟进的事都跟上了，心里有数。', icon: Present },
  { text: '把事情捋顺的人，值得一句夸。✨', icon: TrendCharts },
  { text: '偶尔放空一下，脑子会更清楚。', icon: Sunny },
  { text: '进度在往前，就是好事。', icon: StarFilled },
  { text: '难搞的先记下来，别压在心里。', icon: Moon },
  { text: '你的节奏，就是最好的节奏。', icon: MagicStick },
  { text: '今天又推进了几件小事，已经很有成效了。', icon: Present },
  { text: '让流程跑起来的人，有你。✨', icon: TrendCharts },
  { text: '能把琐事理清的人，做事都有章法。', icon: StarFilled },
  { text: '交期在心、执行在手，你就稳了。', icon: CircleCheckFilled },
  { text: '问题会解决，你也会越做越顺。', icon: MagicStick },
  { text: '小成就也值得记一笔。✨', icon: Present },
  { text: '一步一步来，比焦虑有用。', icon: Moon },
  { text: '你的靠谱，就是团队的底气。', icon: TrendCharts },
  { text: '把事情做完的人，本身就了不起。', icon: Sunny },
  { text: '偶尔慢下来，是为了走更远。', icon: StarFilled },
  { text: '好好干活了，值得一句夸。', icon: CircleCheckFilled },
  { text: '你的存在，让很多事有了着落。✨', icon: Present },
  { text: '别和别人比节奏，和自己比进步就好。', icon: Moon },
  { text: '待办清空的感觉，留给你今天体验。', icon: TrendCharts },
  { text: '又是认真投入的一天。', icon: Sunny },
  { text: '节奏放稳一点，反而更容易做完。', icon: StarFilled },
  { text: '能动手在做，就已经比空想前进了一大步。✨', icon: CircleCheckFilled },
  { text: '把手头这一件收个尾，再开始下一件，思路会更清楚。', icon: MagicStick },
  { text: '重要沟通留个记录，日后少扯皮。', icon: Present },
  { text: '稳扎稳打，你就是那个靠谱的人。', icon: TrendCharts },
  { text: '休息好了，再冲也不迟。', icon: Sunny },
  { text: '你的付出，会有人看见的。', icon: CircleCheckFilled },
  { text: '能推进一点是一点，已经很好了。', icon: Present },
  { text: '别憋着，该问就问。', icon: Moon },
  { text: '好好对待自己了。', icon: TrendCharts },
  { text: '按自己的节奏来，就对了。', icon: Sunny },
  { text: '把事情一件件做完，超酷的。✨', icon: StarFilled },
  { text: '棘手的事先记下来，找时间集中处理。', icon: CircleCheckFilled },
  { text: '专业和靠谱，就是最好的名片。', icon: MagicStick },
  { text: '今天的每一点推进，都算数。✨', icon: Moon },
  { text: '路会越走越顺，前提是你一直在走。', icon: TrendCharts },
  { text: '把事捋顺，你行的。', icon: Sunny },
  { text: '分担出去一些，团队一起扛更轻松。', icon: StarFilled },
  { text: '该处理的都处理了，值得肯定。', icon: MagicStick },
  { text: '把事情做完，本身就是一种能力。', icon: Present },
  { text: '偶尔慢一点，是为了走更稳。', icon: Moon },
  { text: '你的认真，大家都看得到。✨', icon: TrendCharts },
  { text: '先搞定手头这一件。', icon: Sunny },
  { text: '能理清待办的人，做事有条理。', icon: StarFilled },
  { text: '问题会一个一个解决的。', icon: MagicStick },
  { text: '有些事可以交给别人，不必全揽在自己身上。', icon: Moon },
  { text: '把事情捋顺，你就赢了。✨', icon: TrendCharts },
  { text: '有你在跟进，事情就不会悬着。', icon: Sunny },
  { text: '把一件件事做到位的人，会越来越被看见。', icon: StarFilled },
  { text: '小事做稳，大事才不慌。', icon: CircleCheckFilled },
  { text: '小目标，完成一点是一点。', icon: MagicStick },
  { text: '不必和别人比，比昨天的自己好一点就很好。', icon: Moon },
  { text: '待办划掉的感觉，今天也体验一下。', icon: TrendCharts },
  { text: '事多的时候谁都容易急，能先喘口气再说话，已经很好了。', icon: Sunny },
  { text: '忙的时候记得喝口水，缓一缓再继续。', icon: Moon },
  { text: '难题解不开很正常，先放一放，换个时间说不定就通了。', icon: TrendCharts },
  { text: '心情不好的时候，先把能做的小事做掉，状态会慢慢回来。', icon: Present },
  { text: '出问题时，能先想「我能做点什么」的人，会越走越顺。', icon: CircleCheckFilled },
  { text: '卡壳时先想自己这边能怎么动一动，往往就通了。', icon: MagicStick },
  { text: '对自己有点要求、对别人多一分理解，身边的人都能感觉到。', icon: StarFilled },
  { text: '团队里有人多担一点、少推一点，大家都会轻松些。', icon: Sunny },
  { text: '听不清对方说什么的时候，先问清楚再回，会少很多误会。', icon: Moon },
  { text: '忙起来话容易急，能说清楚一句是一句。', icon: Present },
  { text: '卡住了就记下来，明天再想，说不定就有思路了。', icon: TrendCharts },
  { text: '情绪上来的时候，停几秒再开口，会省掉很多麻烦。', icon: CircleCheckFilled },
]

/** 获取本地日期的「一年中的第几天」（1～365 或 366） */
function getDayOfYear(): number {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

/** 按权限过滤：仅保留无限制或当前用户具备对应权限的条目 */
const filteredEncourageItems = computed(() => {
  return ENCOURAGE_ITEMS.filter((item) => {
    if (!item.forRoutePath && !item.forPermissionCode) return true
    if (item.forRoutePath && authStore.hasRoutePermission(item.forRoutePath)) return true
    if (item.forPermissionCode && authStore.hasPermission(item.forPermissionCode)) return true
    return false
  })
})

/** 每日一句（按一年中的第几天在过滤后列表中取模） */
const encourageItem = computed(() => {
  const list = filteredEncourageItems.value
  if (!list.length) return null
  const dayOfYear = getDayOfYear()
  const index = (dayOfYear - 1) % list.length
  return list[index] ?? list[0]
})

const todoLoading = ref(false)
const todoCounts = ref({
  pendingReview: 0,
  myMerchandiser: 0,
  dueSoon: 0,
  pendingInbound: 0,
})

const todoLists = ref<{
  pendingReview: OrderListItem[]
  myMerchandiser: OrderListItem[]
  dueSoon: OrderListItem[]
  pendingInbound: PendingInboundItem[]
}>({
  pendingReview: [],
  myMerchandiser: [],
  dueSoon: [],
  pendingInbound: [],
})

/** 超级管理员视为管理员，展示所有人的待办 */
const isAdmin = computed(() => authStore.user?.roleName === '超级管理员')

const canAccessOrders = computed(() => authStore.hasRoutePermission('/orders/list'))
const canReviewOrders = computed(() => authStore.hasPermission('orders_review'))
const canAccessPendingInbound = computed(() => authStore.hasRoutePermission('/inventory/pending'))
const displayName = computed(() => authStore.user?.displayName ?? '')

/** 非管理员且有待跟单权限与 displayName 时显示「待我跟单」 */
const showMyMerchandiser = computed(
  () => !isAdmin.value && canAccessOrders.value && !!displayName.value,
)

const hasAnyTodoCard = computed(
  () =>
    canReviewOrders.value ||
    showMyMerchandiser.value ||
    canAccessOrders.value ||
    canAccessPendingInbound.value,
)

/** 本地日期 YYYY-MM-DD，避免 UTC 导致「即将到期」少一天 */
function todayYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysYYYYMMDD(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dueSoonStart = computed(() => todayYYYYMMDD())
const dueSoonEnd = computed(() => addDaysYYYYMMDD(7))

function formatDate(val: string | null | undefined): string {
  if (!val) return '-'
  const s = String(val).slice(0, 10)
  return s || '-'
}

const pendingReviewLink = '/orders/list?status=pending_review'
const myMerchandiserLink = computed(() => {
  const name = encodeURIComponent(displayName.value)
  return `/orders/list?merchandiser=${name}`
})
const dueSoonLink = computed(
  () =>
    `/orders/list?customerDueStart=${dueSoonStart.value}&customerDueEnd=${dueSoonEnd.value}`,
)

function goOrdersList(href: string) {
  const path = href.split('?')[0]
  const query: Record<string, string> = {}
  const qs = href.includes('?') ? href.slice(href.indexOf('?') + 1) : ''
  qs.split('&').forEach((pair) => {
    const [k, v] = pair.split('=')
    if (k && v) query[k] = decodeURIComponent(v)
  })
  router.push({ path, query })
}

function goOrderDetail(orderId: number) {
  router.push({ name: 'OrdersDetail', params: { id: String(orderId) } })
}

function goPendingInbound() {
  router.push({ path: '/inventory/pending' })
}

async function loadTodo() {
  if (!canAccessOrders.value && !canAccessPendingInbound.value) return
  todoLoading.value = true
  try {
    const promises: Promise<unknown>[] = []

    if (canReviewOrders.value) {
      promises.push(
        getOrders({
          status: 'pending_review',
          page: 1,
          pageSize: TODO_LIST_PAGE_SIZE,
        }).then((res) => {
          const data = res.data
          todoCounts.value.pendingReview = data?.total ?? 0
          todoLists.value.pendingReview = data?.list ?? []
        }),
      )
    }

    if (showMyMerchandiser.value) {
      promises.push(
        getOrders({
          merchandiser: displayName.value,
          page: 1,
          pageSize: TODO_LIST_PAGE_SIZE,
        }).then((res) => {
          const data = res.data
          todoCounts.value.myMerchandiser = data?.total ?? 0
          todoLists.value.myMerchandiser = data?.list ?? []
        }),
      )
    }

    if (canAccessOrders.value) {
      promises.push(
        getOrders({
          customerDueStart: dueSoonStart.value,
          customerDueEnd: dueSoonEnd.value,
          page: 1,
          pageSize: TODO_LIST_PAGE_SIZE,
        }).then((res) => {
          const data = res.data
          todoCounts.value.dueSoon = data?.total ?? 0
          todoLists.value.dueSoon = data?.list ?? []
        }),
      )
    }

    if (canAccessPendingInbound.value) {
      promises.push(
        getPendingInboundList({ page: 1, pageSize: TODO_LIST_PAGE_SIZE }).then((res) => {
          const data = res.data
          todoCounts.value.pendingInbound = data?.total ?? 0
          todoLists.value.pendingInbound = data?.list ?? []
        }),
      )
    }

    await Promise.all(promises)
  } finally {
    todoLoading.value = false
  }
}

onMounted(() => {
  loadTodo()
})
</script>

<style scoped>
.home-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  width: 100%;
  box-sizing: border-box;
}

.home-welcome {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--el-fill-color-light) 0%, var(--el-fill-color) 100%);
  border: 1px solid var(--color-border);
  width: 100%;
  box-sizing: border-box;
}

.home-greeting {
  margin: 0 0 var(--space-sm);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.home-encourage {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0 0 var(--space-sm);
  border-left: 3px solid var(--el-color-primary);
  min-width: 0;
}

.home-encourage-icon {
  font-size: 1.25rem;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.home-encourage-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--el-color-primary);
  line-height: 1.5;
  min-width: 0;
}

.home-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.home-section-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.todo-rules-popover p {
  margin: 0 0 var(--space-sm);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.todo-rules-popover .todo-rules-hint {
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary, #606266);
}

.todo-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

@media (max-width: 900px) {
  .todo-sections {
    grid-template-columns: 1fr;
  }
}

.todo-section {
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.todo-section--default {
  border: 1px solid var(--color-border);
  background: var(--color-bg-subtle, #f5f6f8);
}

.todo-section--warning {
  border: 1px solid var(--el-color-warning);
  background: var(--el-color-warning-light-9, #fdf6ec);
}

.todo-section-loading .todo-section-count {
  opacity: 0.7;
}

.todo-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.todo-section--warning .todo-section-head {
  border-bottom-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9, #fdf6ec);
}

.todo-section-icon {
  font-size: 1rem;
  color: var(--el-color-warning);
}

.todo-section-title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.todo-section-count {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-color-primary);
}

.todo-section--warning .todo-section-count {
  color: var(--el-color-warning-dark-2, #b88230);
}

.todo-section-link {
  margin-left: auto;
}

.todo-table-wrap {
  overflow-x: auto;
  flex: 1;
  min-height: 0;
}

.todo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.todo-table th,
.todo-table td {
  padding: var(--space-xs, 6px) var(--space-sm);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.todo-table th {
  color: var(--color-text-secondary, #606266);
  font-weight: 500;
}

.todo-table tbody tr.todo-row {
  cursor: pointer;
}

.todo-table tbody tr.todo-row:hover {
  background: var(--el-fill-color-light);
}

.ellipsis {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-empty {
  padding: var(--space-lg);
  text-align: center;
  color: var(--color-text-secondary, #606266);
  font-size: 0.875rem;
}
</style>
