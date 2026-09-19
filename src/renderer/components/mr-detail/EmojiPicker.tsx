import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface EmojiPickerProps {
  onSelect: (emoji: { id: string; native: string }) => void
  onClose?: () => void
  compact?: boolean
}

export default function EmojiPicker({ onSelect, onClose, compact = false }: EmojiPickerProps) {
  const compactProps = compact ? {
    perLine: 8,
    emojiButtonSize: 32,
    emojiSize: 20,
    maxFrequentRows: 2,
    previewPosition: 'none',
    skinTonePosition: 'search',
  } : {}

  return <Picker data={data} theme="dark" onEmojiSelect={onSelect} {...compactProps} {...(onClose ? { onClickOutside: onClose } : {})} />
}
