<template>
  <div class="page-card home-page">
    <HomeWelcomeCard
      :greeting-text="greetingText"
      :display-name="displayName || authStore.user?.username || ''"
      :encourage-item="encourageItem"
    />
    <HomeTodoBoard
      :todo-loading="todoLoading"
      :todo-counts="todoCounts"
      :todo-lists="todoLists"
      :is-admin="isAdmin"
      :can-review-orders="canReviewOrders"
      :show-my-merchandiser="showMyMerchandiser"
      :can-access-orders="canAccessOrders"
      :can-access-pending-inbound="canAccessPendingInbound"
      :has-any-todo-card="hasAnyTodoCard"
      :pending-review-link="pendingReviewLink"
      :my-merchandiser-link="myMerchandiserLink"
      :due-soon-link="dueSoonLink"
      @orders-list="goOrdersList"
      @order-detail="goOrderDetail"
      @pending-inbound="goPendingInbound"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import HomeTodoBoard from '@/components/home/HomeTodoBoard.vue'
import HomeWelcomeCard from '@/components/home/HomeWelcomeCard.vue'
import { useHomeTodo } from '@/composables/useHomeTodo'
import { useHomeWelcome } from '@/composables/useHomeWelcome'

const {
  authStore,
  todoLoading,
  todoCounts,
  todoLists,
  isAdmin,
  canAccessOrders,
  canReviewOrders,
  canAccessPendingInbound,
  displayName,
  showMyMerchandiser,
  hasAnyTodoCard,
  pendingReviewLink,
  myMerchandiserLink,
  dueSoonLink,
  goOrdersList,
  goOrderDetail,
  goPendingInbound,
  loadTodo,
} = useHomeTodo()

const { greetingText, encourageItem } = useHomeWelcome(authStore)

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
</style>
