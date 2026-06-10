import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/uploads', () => ({
  uploadImage: vi.fn(async () => '/uploads/uploaded-new.png'),
}))
vi.mock('@/api/request', () => ({
  getErrorMessage: () => 'err',
  isErrorHandled: () => true,
}))
vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}))

import { useOrderAttachments } from './useOrderAttachments'
import { consumeImageUrlDrop } from './useImageUrlDragSingleton'
import { IMAGE_URL_DRAG_TYPE } from '@/utils/image'
import { uploadImage } from '@/api/uploads'

interface DragEventInit {
  types?: string[]
  files?: File[]
  data?: Record<string, string>
}

function makeDragEvent(init: DragEventInit = {}): DragEvent {
  const data = init.data ?? {}
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types: init.types ?? Object.keys(data),
      files: init.files ?? [],
      effectAllowed: '',
      dropEffect: '',
      getData: (type: string) => data[type] ?? '',
      setData: (type: string, value: string) => {
        data[type] = value
      },
    },
  } as unknown as DragEvent
}

function makeImageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' })
}

describe('useOrderAttachments 拖拽', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('区内排序：drop 在条目上只换位，冒泡到容器也不会重复上传', async () => {
    const api = useOrderAttachments()
    api.attachments.value = ['/uploads/a.png', '/uploads/b.png']

    const startEvt = makeDragEvent()
    api.onAttachmentDragStart(0, startEvt)

    // 浏览器对页面内 <img> 拖拽会同时带 Files + text/uri-list + 自定义类型
    const dropEvt = makeDragEvent({
      types: ['text/plain', IMAGE_URL_DRAG_TYPE, 'text/uri-list', 'Files'],
      files: [makeImageFile('a.png')],
      data: { 'text/plain': '0', [IMAGE_URL_DRAG_TYPE]: '/uploads/a.png' },
    })
    api.onAttachmentDrop(1, dropEvt)
    expect((dropEvt.stopPropagation as ReturnType<typeof vi.fn>)).toHaveBeenCalled()

    // 即便容器仍收到同一事件（防御层），也必须忽略
    await api.onAttachmentsAreaDrop(dropEvt)
    api.onAttachmentDragEnd()

    expect(api.attachments.value).toEqual(['/uploads/b.png', '/uploads/a.png'])
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('拖到其他板块（被消费）：dragend 后附件移除，实现移动语义', () => {
    const api = useOrderAttachments()
    api.attachments.value = ['/uploads/a.png', '/uploads/b.png']

    api.onAttachmentDragStart(0, makeDragEvent())
    consumeImageUrlDrop('/uploads/a.png')
    api.onAttachmentDragEnd()

    expect(api.attachments.value).toEqual(['/uploads/b.png'])
  })

  it('拖动取消（未被消费）：附件保持不变', () => {
    const api = useOrderAttachments()
    api.attachments.value = ['/uploads/a.png', '/uploads/b.png']

    api.onAttachmentDragStart(0, makeDragEvent())
    api.onAttachmentDragEnd()

    expect(api.attachments.value).toEqual(['/uploads/a.png', '/uploads/b.png'])
  })

  it('从系统文件夹拖文件进容器：正常上传追加', async () => {
    const api = useOrderAttachments()
    api.attachments.value = ['/uploads/a.png']

    const evt = makeDragEvent({ types: ['Files'], files: [makeImageFile('new.png')] })
    await api.onAttachmentsAreaDrop(evt)

    expect(uploadImage).toHaveBeenCalledTimes(1)
    expect(api.attachments.value).toEqual(['/uploads/a.png', '/uploads/uploaded-new.png'])
  })

  it('页面内其他图片的原生拖拽（带 uri-list）落到容器：忽略，不上传', async () => {
    const api = useOrderAttachments()
    api.attachments.value = ['/uploads/a.png']

    const evt = makeDragEvent({
      types: ['text/uri-list', 'text/html', 'Files'],
      files: [makeImageFile('from-page.png')],
    })
    await api.onAttachmentsAreaDrop(evt)

    expect(uploadImage).not.toHaveBeenCalled()
    expect(api.attachments.value).toEqual(['/uploads/a.png'])
  })
})
