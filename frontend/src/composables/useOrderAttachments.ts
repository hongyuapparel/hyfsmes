import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { uploadImage } from '@/api/uploads'
import { IMAGE_URL_DRAG_TYPE, isUploadImageFile } from '@/utils/image'

export function useOrderAttachments() {
  const attachments = ref<string[]>([])
  const draggingAttachmentIndex = ref<number | null>(null)
  const dragOverAttachmentIndex = ref<number | null>(null)
  const attachmentsFileDragover = ref(false)

  async function uploadAttachmentFiles(files: File[]) {
    for (const file of files) {
      try {
        const url = await uploadImage(file)
        attachments.value.push(url)
      } catch (err: unknown) {
        if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
      }
    }
  }

  async function onAttachmentFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!files.length) return
    await uploadAttachmentFiles(files)
  }

  function isExternalFileDrag(e: DragEvent): boolean {
    return draggingAttachmentIndex.value == null && !!e.dataTransfer?.types?.includes('Files')
  }

  function onAttachmentsAreaDragOver(e: DragEvent) {
    if (!isExternalFileDrag(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    attachmentsFileDragover.value = true
  }

  function onAttachmentsAreaDragLeave() {
    attachmentsFileDragover.value = false
  }

  async function onAttachmentsAreaDrop(e: DragEvent) {
    attachmentsFileDragover.value = false
    if (!isExternalFileDrag(e)) return
    e.preventDefault()
    const files = Array.from(e.dataTransfer?.files ?? []).filter(isUploadImageFile)
    if (!files.length) return
    await uploadAttachmentFiles(files)
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
      // 区内拖动 = 排序（move）；拖到物料图/包装图/主图 = 复制 URL（copy），附件保留
      e.dataTransfer.effectAllowed = 'copyMove'
      e.dataTransfer.setData('text/plain', String(index))
      const url = attachments.value[index]
      if (url) e.dataTransfer.setData(IMAGE_URL_DRAG_TYPE, url)
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
    if (isExternalFileDrag(e)) return
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
    attachmentsFileDragover,
    onAttachmentFileChange,
    onAttachmentsAreaDragOver,
    onAttachmentsAreaDragLeave,
    onAttachmentsAreaDrop,
    removeAttachment,
    moveAttachment,
    onAttachmentDragStart,
    onAttachmentDragOver,
    onAttachmentDrop,
    onAttachmentDragEnd,
  }
}
