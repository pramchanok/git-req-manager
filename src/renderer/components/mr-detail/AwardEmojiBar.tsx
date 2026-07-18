import { useState } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { getEmojiChar } from '../../utils/emoji'

export type EmojiGroups = Record<string, { count: number; hasVoted: boolean }>

interface AwardEmojiBarProps {
  emojiGroups: EmojiGroups
  onToggle: (name: string) => void
}

/** แถว award emoji (👍 👎 + reaction อื่นๆ) พร้อมปุ่มเปิด emoji picker */
export default function AwardEmojiBar({ emojiGroups, onToggle }: AwardEmojiBarProps) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 relative">
      {['thumbsup', 'thumbsdown', ...Object.keys(emojiGroups).filter(name => name !== 'thumbsup' && name !== 'thumbsdown')].map(name => {
        const group = emojiGroups[name]
        if (!group && (name !== 'thumbsup' && name !== 'thumbsdown')) return null
        const count = group?.count || 0
        const hasVoted = group?.hasVoted || false
        if (count === 0 && name !== 'thumbsup' && name !== 'thumbsdown') return null

        const nativeChar = getEmojiChar(name)

        return (
          <button
            key={name}
            onClick={() => onToggle(name)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors border ${hasVoted ? 'bg-[#1d4ed8]/20 border-[#1d4ed8] text-blue-400' : 'bg-[#21262d] border-transparent text-gray-400 hover:bg-[#30363d]'}`}
          >
            <span className="text-base leading-none">{nativeChar}</span>
            <span>{count}</span>
          </button>
        )
      })}

      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowPicker(prev => !prev)
        }}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#21262d] border border-transparent text-gray-400 hover:bg-[#30363d] transition-colors"
        title="Add reaction"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {showPicker && (
        <div className="absolute top-10 left-0 z-50 shadow-2xl border border-gray-700 rounded-lg overflow-hidden">
          <Picker
            data={data}
            theme="dark"
            onEmojiSelect={(emoji: any) => {
              onToggle(emoji.id)
              setShowPicker(false)
            }}
            onClickOutside={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  )
}
