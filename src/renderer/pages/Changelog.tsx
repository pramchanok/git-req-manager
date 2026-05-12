import { useState, useEffect } from 'react'
import { marked } from 'marked'

interface Props {
  onBack: () => void
  currentVersion: string
}

export default function Changelog({ onBack, currentVersion }: Props) {
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)

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
