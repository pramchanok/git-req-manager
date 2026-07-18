import data from '@emoji-mart/data'

/** แปลงชื่อ award emoji ของ GitLab (เช่น thumbsup, tada) เป็นตัวอักษร emoji จริง */
export function getEmojiChar(name: string): string {
  if (name === 'thumbsup' || name === '+1') return '👍'
  if (name === 'thumbsdown' || name === '-1') return '👎'
  try {
    const emojiData = (data as any).emojis[name]
    if (emojiData && emojiData.skins && emojiData.skins[0]) {
      return emojiData.skins[0].native
    }
    for (const key of Object.keys((data as any).emojis || {})) {
      const e = (data as any).emojis[key]
      if (e.id === name || (e.shortcodes && e.shortcodes.includes(`:${name}:`))) {
        return e.skins[0].native
      }
    }
  } catch (e) {}
  return `:${name}:`
}
