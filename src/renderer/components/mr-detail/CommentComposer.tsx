import { lazy, Suspense, useState } from 'react'

const CommentEditor = lazy(() => import('./CommentEditor'))

interface CommentComposerProps {
  value: string
  onChange: (value: string) => void
  submitting: boolean
  onSubmit: () => void
  draftStatus?: string
  disabled?: boolean
}

export default function CommentComposer({ value, onChange, submitting, onSubmit, draftStatus, disabled = false }: CommentComposerProps) {
  const [editing, setEditing] = useState(true)
  const input = <textarea aria-label="Comment" value={value} onChange={event => onChange(event.target.value)} disabled={submitting || disabled} placeholder="Write your thoughts..." className="w-full h-[200px] resize-y bg-[#161b22] p-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-orange-500/60" />
  return (
    <div className="mt-8 relative" data-color-mode="dark">
      <div className="relative rounded-t-xl border border-gray-700">
        {editing ? <Suspense fallback={input}><CommentEditor value={value} onChange={onChange} disabled={submitting || disabled} /></Suspense> : input}
      </div>
      <div className="bg-[#161b22] px-4 py-2 border border-t-0 border-gray-700 rounded-b-xl flex flex-wrap gap-3 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <button type="button" onClick={() => setEditing(!editing)} className="hover:text-orange-300">{editing ? 'Plain text' : 'Markdown toolbar'}</button>
          {draftStatus && <span role="status" className="text-gray-500">{draftStatus}</span>}
        </div>
        <button onClick={onSubmit} disabled={!value.trim() || submitting || disabled} className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold py-1 px-5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{submitting ? 'Posting...' : 'Comment'}</button>
      </div>
    </div>
  )
}
