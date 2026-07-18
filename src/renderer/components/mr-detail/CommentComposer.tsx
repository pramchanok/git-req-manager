import { useState } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface CommentComposerProps {
  value: string
  onChange: (value: string) => void
  submitting: boolean
  onSubmit: () => void
}

/** กล่องเขียน comment (Markdown editor + emoji picker + ปุ่มส่ง) */
export default function CommentComposer({ value, onChange, submitting, onSubmit }: CommentComposerProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  return (
    <div className="mt-8 flex gap-4">
      <div className="flex-1 rounded-xl overflow-visible transition-colors relative">
        <div data-color-mode="dark" className="border border-gray-700 rounded-t-xl overflow-hidden">
          <MDEditor
            value={value}
            onChange={val => onChange(val || '')}
            preview="edit"
            height={200}
            className="!bg-[#161b22] !border-0"
            textareaProps={{
              placeholder: "Write your thoughts...",
            }}
            commands={[
              ...commands.getCommands(),
              commands.divider,
              {
                name: 'emoji',
                keyCommand: 'emoji',
                buttonProps: { 'aria-label': 'Insert emoji', title: 'Insert emoji' },
                icon: (
                  <svg width="14" height="14" viewBox="0 0 20 20">
                    <path d="M10 20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-3-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-3 6a4 4 0 0 1-3.46-2h6.92A4 4 0 0 1 10 15z" fill="currentColor"/>
                  </svg>
                ),
                execute: () => {
                  setShowEmojiPicker(prev => !prev)
                }
              }
            ]}
          />
        </div>

        {showEmojiPicker && (
          <div className="absolute top-12 left-[340px] z-50 shadow-[0_10px_50px_rgba(0,0,0,0.7)] border border-gray-700 rounded-lg overflow-hidden">
            <Picker
              data={data}
              theme="dark"
              onEmojiSelect={(emoji: any) => {
                onChange(value + emoji.native)
                setShowEmojiPicker(false)
              }}
              onClickOutside={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        <div className="bg-[#161b22] px-4 py-2 border border-t-0 border-gray-700 rounded-b-xl flex justify-between items-center">
          <span className="text-xs text-gray-500">Supports Markdown</span>
          <button
            onClick={onSubmit}
            disabled={!value.trim() || submitting}
            className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold py-1 px-5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(234,88,12,0.2)] hover:shadow-[0_0_20px_rgba(234,88,12,0.4)]"
          >
            {submitting ? 'Posting...' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  )
}
