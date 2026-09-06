import { computed, ref } from 'vue'

/** Snapshots are recorded at user-action boundaries, never during server hydration. */
export function useSizeGridHistory(read: () => string, restore: (snapshot: string) => void) {
  const past = ref<string[]>([])
  const future = ref<string[]>([])
  const pending = ref<string>()
  function begin() { if (pending.value === undefined) pending.value = read() }
  function commit() {
    if (pending.value !== undefined && pending.value !== read()) {
      past.value = [...past.value.slice(-49), pending.value]
      future.value = []
    }
    pending.value = undefined
  }
  function undo() {
    commit()
    const snapshot = past.value.pop()
    if (snapshot === undefined) return
    future.value.push(read())
    restore(snapshot)
  }
  function redo() {
    commit()
    const snapshot = future.value.pop()
    if (snapshot === undefined) return
    past.value.push(read())
    restore(snapshot)
  }
  function reset() { past.value = []; future.value = []; pending.value = undefined }
  return { begin, commit, undo, redo, reset,
    canUndo: computed(() => past.value.length > 0 || pending.value !== undefined && pending.value !== read()),
    canRedo: computed(() => future.value.length > 0 && (pending.value === undefined || pending.value === read())) }
}
