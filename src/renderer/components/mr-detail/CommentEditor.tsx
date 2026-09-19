import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor'
import { Smile } from 'lucide-react'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import { getEmojiPickerPosition, isOutsideEmojiToolbar, nextEmojiPickerOpen } from './emojiToolbarState'

const EmojiPicker = lazy(() => import('./EmojiPicker'))

interface EmojiToolbarButtonProps {
  command: ICommand
  disabled: boolean
  executeCommand: (command: ICommand, name?: string) => void
}

function EmojiToolbarButton({ command, disabled, executeCommand }: EmojiToolbarButtonProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!buttonRef.current || !pickerRef.current) return
    const anchor = buttonRef.current.getBoundingClientRect()
    const picker = pickerRef.current.getBoundingClientRect()
    setPosition(getEmojiPickerPosition(anchor, picker, { width: window.innerWidth, height: window.innerHeight }))
  }, [])

  useEffect(() => {
    if (!open) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (isOutsideEmojiToolbar(buttonRef.current, pickerRef.current, event.composedPath())) {
        setOpen(current => nextEmojiPickerOpen(current, 'close'))
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !pickerRef.current) return

    const frame = window.requestAnimationFrame(updatePosition)
    const observer = new ResizeObserver(updatePosition)
    observer.observe(pickerRef.current)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) setPosition(null)
          setOpen(current => nextEmojiPickerOpen(current, 'toggle'))
        }}
        aria-label="Insert emoji"
        title="Insert emoji"
        aria-expanded={open}
      >
        <Smile size={14} aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={pickerRef}
          className="comment-emoji-picker fixed z-[100] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-700 bg-[#161b22] shadow-2xl"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
        >
          <Suspense fallback={<div className="p-4 text-sm text-gray-400">Loading emoji…</div>}>
            <EmojiPicker
              compact
              onSelect={emoji => {
                executeCommand({
                  ...command,
                  execute: (_state, api) => api.replaceSelection(emoji.native),
                })
                setOpen(current => nextEmojiPickerOpen(current, 'close'))
              }}
            />
          </Suspense>
        </div>,
        document.body,
      )}
    </>
  )
}

export default function CommentEditor({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const toolbarCommands = useMemo(() => {
    const defaultCommands = commands.getCommands()
    const emojiCommand: ICommand = {
      name: 'emoji',
      keyCommand: 'emoji',
      buttonProps: { 'aria-label': 'Insert emoji', title: 'Insert emoji' },
      render: (command, toolbarDisabled, executeCommand) => (
        <EmojiToolbarButton command={command} disabled={disabled || toolbarDisabled} executeCommand={executeCommand} />
      ),
    }
    const helpIndex = defaultCommands.findIndex(command => command.keyCommand === 'help')
    defaultCommands.splice(helpIndex >= 0 ? helpIndex : defaultCommands.length, 0, emojiCommand)
    return defaultCommands
  }, [disabled])

  return <MDEditor value={value} onChange={value => onChange(value || '')} commands={toolbarCommands} preview="edit" height={200} className="!rounded-t-xl !bg-[#161b22] !border-0" textareaProps={{ placeholder: 'Write your thoughts...', disabled, 'aria-label': 'Comment' }} />
}
