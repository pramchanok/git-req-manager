import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

export default function CommentEditor({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <MDEditor value={value} onChange={value => onChange(value || '')} preview="edit" height={200} className="!bg-[#161b22] !border-0" textareaProps={{ placeholder: 'Write your thoughts...', disabled, 'aria-label': 'Comment' }} />
}
