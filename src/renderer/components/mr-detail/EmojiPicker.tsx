import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: { id: string; native: string }) => void; onClose: () => void }) {
  return <Picker data={data} theme="dark" onEmojiSelect={onSelect} onClickOutside={onClose} />
}
