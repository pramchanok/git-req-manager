import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'

interface Props {
  onBack: () => void
  currentVersion: string
}

export default function Changelog({ onBack, currentVersion }: Props) {
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getChangelog().then((md) => {
      if (md) {
        setHtml(marked.parse(md) as string)
      }
      setLoading(false)
    })

    // Mark current version as seen
    void window.electronAPI.setLastSeenVersion()
  }, [])

  // Scroll to current version heading after HTML is rendered
  useEffect(() => {
    if (!html || !currentVersion || !contentRef.current) return
    const headings = contentRef.current.querySelectorAll('h2')
    for (const h of headings) {
      if (h.textContent?.includes(currentVersion)) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        h.classList.add('changelog-current-version')
        break
      }
    }
  }, [html, currentVersion])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ◀
        </button>
        <span className="text-xs font-semibold text-gray-300">สิ่งที่เปลี่ยนแปลง</span>
        {currentVersion && (
          <span className="text-xs text-gray-600 ml-auto">v{currentVersion}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-xs text-gray-500 animate-pulse">กำลังโหลด…</p>
        ) : html ? (
          <div
            ref={contentRef}
            className="changelog-content text-xs text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-xs text-gray-500">ไม่พบข้อมูล changelog</p>
        )}
      </div>
    </div>
  )
}
