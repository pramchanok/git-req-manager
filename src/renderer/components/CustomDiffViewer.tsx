import React, { useMemo } from 'react'
import parseDiff from 'parse-diff'

interface Change {
  type: string
  content: string
  ln?: number
  ln1?: number
  ln2?: number
}

interface Chunk {
  content: string
  changes: Change[]
}

interface CustomDiffViewerProps {
  diffString: string
}

export const CustomDiffViewer: React.FC<CustomDiffViewerProps> = ({ diffString }) => {
  const files = useMemo(() => {
    try {
      return parseDiff(diffString)
    } catch (e) {
      console.error('Failed to parse diff', e)
      return []
    }
  }, [diffString])

  if (!files || files.length === 0) {
    return <div className="p-4 text-gray-500 text-sm">No diff content or failed to parse.</div>
  }

  const file = files[0] // We render per file diff anyway

  const renderChange = (change: Change, i: number) => {
    let bgColor = 'bg-transparent'
    let contentColor = 'text-gray-300'
    let lineNumberColor = 'text-gray-500'
    let sign = ' '
    
    if (change.type === 'add') {
      bgColor = 'bg-green-500/15'
      contentColor = 'text-green-300'
      lineNumberColor = 'text-green-500/50'
      sign = '+'
    } else if (change.type === 'del') {
      bgColor = 'bg-red-500/15'
      contentColor = 'text-red-300'
      lineNumberColor = 'text-red-500/50'
      sign = '-'
    }

    const ln1 = change.type === 'normal' ? change.ln1 : change.type === 'del' ? change.ln : ''
    const ln2 = change.type === 'normal' ? change.ln2 : change.type === 'add' ? change.ln : ''

    return (
      <div key={i} className={`flex ${bgColor} hover:bg-white/5 transition-colors group`}>
        {/* Old line number */}
        <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-800 ${lineNumberColor} bg-[#161b22]`}>
          {ln1}
        </div>
        {/* New line number */}
        <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-800 ${lineNumberColor} bg-[#161b22]`}>
          {ln2}
        </div>
        {/* Content */}
        <div className="flex-1 pl-4 pr-2 whitespace-pre-wrap break-all relative font-mono text-[13px] leading-5">
          <span className={`absolute left-1 select-none ${lineNumberColor}`}>{sign}</span>
          <span className={contentColor}>{change.content.replace(/^[-+ ]/, '')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="text-[13px] overflow-x-auto bg-[#0d1117] border-t border-gray-800 w-full rounded-b-xl custom-diff-viewer">
      <div className="min-w-max">
        {file.chunks.map((chunk, chunkIdx) => (
          <div key={chunkIdx} className="mb-4 last:mb-0">
            {/* Hunk Header */}
            <div className="flex bg-[#161b22] text-blue-400 font-mono py-1 select-none border-y border-gray-800">
              <div className="w-24 flex-shrink-0 border-r border-gray-800"></div>
              <div className="pl-4">{chunk.content}</div>
            </div>
            
            {/* Changes */}
            <div className="flex flex-col">
              {chunk.changes.map((change, changeIdx) => renderChange(change, changeIdx))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
