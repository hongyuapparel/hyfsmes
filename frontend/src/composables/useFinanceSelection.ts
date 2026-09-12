import { computed, ref } from 'vue'

export function useFinanceSelection() {
  const selected = ref<Array<{ id: number; amount: string }>>([])
  const deleting = ref(false)
  const selectedAmount = computed(() => selected.value.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100)

  async function removeRecords(ids: number[], remove: (id: number) => Promise<unknown>) {
    if (deleting.value || ids.length === 0) return null
    deleting.value = true
    try {
      const results = await Promise.allSettled(ids.map(id => remove(id)))
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected')
      return { deletedCount: ids.length - failedIds.length, failedIds }
    } finally {
      deleting.value = false
    }
  }

  return { selected, selectedAmount, deleting, removeRecords }
}
