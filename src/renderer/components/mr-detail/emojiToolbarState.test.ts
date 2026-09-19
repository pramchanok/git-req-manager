import { describe, expect, it } from 'vitest'
import { getEmojiPickerPosition, isOutsideEmojiToolbar, nextEmojiPickerOpen } from './emojiToolbarState'

describe('emoji toolbar state', () => {
  it('can reopen after being dismissed without choosing an emoji', () => {
    let open = nextEmojiPickerOpen(false, 'toggle')
    open = nextEmojiPickerOpen(open, 'close')
    open = nextEmojiPickerOpen(open, 'toggle')

    expect(open).toBe(true)
  })

  it('does not treat the toolbar button or picker as an outside click', () => {
    const toolbar = new EventTarget()
    const pickerChild = new EventTarget()
    const picker = new EventTarget()
    const outside = new EventTarget()

    expect(isOutsideEmojiToolbar(toolbar, picker, [pickerChild, picker])).toBe(false)
    expect(isOutsideEmojiToolbar(toolbar, picker, [toolbar])).toBe(false)
    expect(isOutsideEmojiToolbar(toolbar, picker, [outside])).toBe(true)
  })

  it('opens above the toolbar and stays inside the viewport when space below is insufficient', () => {
    expect(getEmojiPickerPosition(
      { top: 700, bottom: 720, left: 900 },
      { width: 320, height: 360 },
      { width: 1100, height: 900 },
    )).toEqual({ top: 332, left: 768 })
  })

  it('opens below the toolbar when there is enough room', () => {
    expect(getEmojiPickerPosition(
      { top: 40, bottom: 60, left: 40 },
      { width: 320, height: 360 },
      { width: 1100, height: 900 },
    )).toEqual({ top: 68, left: 40 })
  })
})
