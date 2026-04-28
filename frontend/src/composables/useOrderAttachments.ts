import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { uploadImage } from '@/api/uploads'

export function useOrderAttachments() {
  const attachments = ref<string[]>([])
  const draggingAttachmentIndex = ref<number | null>(null)
  const dragOverAttachmentIndex = ref<number | null>(null)

  async function onAttachmentFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!files.length) return
    for (const file of files) {
      try {
        const url = await uploadImage(file)
        attachments.value.push(url)
      } catch (err: unknown) {
        if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
      }
    }
  }

  function removeAttachment(index: number) {
    attachments.value.splice(index, 1)
  }

  function moveAttachment(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= attachments.value.length || toIndex >= attachments.value.length) return
    const [moved] = attachments.value.splice(fromIndex, 1)
    if (!moved) return
    attachments.value.splice(toIndex, 0, moved)
  }

  function onAttachmentDragStart(index: number, e: DragEvent) {
    draggingAttachmentIndex.value = index
    dragOverAttachmentIndex.value = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    }
  }

  function onAttachmentDragOver(index: number, e: DragEvent) {
    if (draggingAttachmentIndex.value == null) return
    e.preventDefault()
    dragOverAttachmentIndex.value = index
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  function onAttachmentDrop(index: number, e: DragEvent) {
    e.preventDefault()
    const from = draggingAttachmentIndex.value
    const fromByTransfer = Number(e.dataTransfer?.getData('text/plain') ?? '')
    const fromIndex = from ?? (Number.isNaN(fromByTransfer) ? null : fromByTransfer)
    if (fromIndex == null) {
      onAttachmentDragEnd()
      return
    }
    moveAttachment(fromIndex, index)
    onAttachmentDragEnd()
  }

  function onAttachmentDragEnd() {
    draggingAttachmentIndex.value = null
    dragOverAttachmentIndex.value = null
  }

  return {
    attachments,
    draggingAttachmentIndex,
    dragOverAttachmentIndex,
    onAttachmentFileChange,
    removeAttachment,
    moveAttachment,
    onAttachmentDragStart,
    onAttachmentDragOver,
    onAttachmentDrop,
    onAttachmentDragEnd,
  }
}
