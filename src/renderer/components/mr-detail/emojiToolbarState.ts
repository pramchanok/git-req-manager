export type EmojiPickerAction = 'toggle' | 'close'

interface AnchorRect {
  top: number
  bottom: number
  left: number
}

interface Size {
  width: number
  height: number
}

export function nextEmojiPickerOpen(current: boolean, action: EmojiPickerAction): boolean {
  return action === 'toggle' ? !current : false
}

export function isOutsideEmojiToolbar(toolbar: object | null, picker: object | null, eventPath: EventTarget[]): boolean {
  if (!toolbar) return true
  return !eventPath.includes(toolbar as EventTarget) && (!picker || !eventPath.includes(picker as EventTarget))
}

export function getEmojiPickerPosition(
  anchor: AnchorRect,
  picker: Size,
  viewport: Size,
  gap = 8,
  margin = 12,
): { top: number; left: number } {
  const below = anchor.bottom + gap
  const above = anchor.top - gap - picker.height
  const top = below + picker.height <= viewport.height - margin ? below : Math.max(margin, above)
  const maximumLeft = Math.max(margin, viewport.width - margin - picker.width)
  const left = Math.min(Math.max(margin, anchor.left), maximumLeft)

  return { top, left }
}
