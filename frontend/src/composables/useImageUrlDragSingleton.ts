/**
 * 站内图片拖拽会话单例（移动语义）：
 * 来源（附件区）dragstart 时登记 URL，接收方（物料图/包装图/主图）成功落图后标记已消费，
 * 来源在 dragend 读取消费结果决定是否把原图从自己列表移除。
 */
let activeUrl: string | null = null
let consumed = false

export function beginImageUrlDrag(url: string): void {
  activeUrl = url
  consumed = false
}

export function consumeImageUrlDrop(url: string): void {
  if (activeUrl && activeUrl === url) consumed = true
}

export function endImageUrlDrag(): boolean {
  const wasConsumed = consumed
  activeUrl = null
  consumed = false
  return wasConsumed
}
