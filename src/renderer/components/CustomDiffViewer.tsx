import React, { useMemo, useEffect } from 'react'
import parseDiff from 'parse-diff'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'

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
  viewMode?: 'inline' | 'split'
}

export const CustomDiffViewer: React.FC<CustomDiffViewerProps> = ({ diffString, viewMode = 'inline' }) => {
  useEffect(() => {
    Prism.highlightAll()
  }, [diffString, viewMode])

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

  const file = files[0]

  const highlightContent = (code: string) => {
    // In a real app we'd determine the language from file.to or file.from
    // For now we just use a generic 'javascript' highlighter or text
    const lang = 'javascript'
    if (Prism.languages[lang]) {
      return Prism.highlight(code, Prism.languages[lang], lang)
    }
    return code
  }

  const renderInlineChange = (change: Change, i: number) => {
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
    const codeContent = change.content.replace(/^[-+ ]/, '')

    return (
      <div key={i} className={`flex ${bgColor} hover:bg-white/5 transition-colors group`}>
        <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-800 ${lineNumberColor} bg-[#161b22]`}>
          {ln1}
        </div>
        <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-800 ${lineNumberColor} bg-[#161b22]`}>
          {ln2}
        </div>
        <div className="flex-1 pl-4 pr-2 whitespace-pre-wrap break-all relative font-mono text-[13px] leading-5">
          <span className={`absolute left-1 select-none ${lineNumberColor}`}>{sign}</span>
          <span className={contentColor} dangerouslySetInnerHTML={{ __html: highlightContent(codeContent) }} />
        </div>
      </div>
    )
  }

  const renderSplitChanges = (chunk: Chunk) => {
    // Basic align algorithm for split view
    const rows: { left?: Change, right?: Change }[] = []
    
    let leftBuffer: Change[] = []
    let rightBuffer: Change[] = []

    const flushBuffers = () => {
      const max = Math.max(leftBuffer.length, rightBuffer.length)
      for (let i = 0; i < max; i++) {
        rows.push({
          left: leftBuffer[i],
          right: rightBuffer[i]
        })
      }
      leftBuffer = []
      rightBuffer = []
    }

    chunk.changes.forEach((change) => {
      if (change.type === 'normal') {
        flushBuffers()
        rows.push({ left: change, right: change })
      } else if (change.type === 'del') {
        leftBuffer.push(change)
      } else if (change.type === 'add') {
        rightBuffer.push(change)
      }
    })
    flushBuffers()

    return rows.map((row, i) => {
      const left = row.left
      const right = row.right

      const renderSide = (c?: Change) => {
        if (!c) {
          return (
            <div className="flex-1 flex bg-gray-900/50">
              <div className="w-12 flex-shrink-0 border-r border-gray-800 bg-[#161b22]" />
              <div className="flex-1" />
            </div>
          )
        }

        let bgColor = 'bg-transparent'
        let contentColor = 'text-gray-300'
        let lineNumberColor = 'text-gray-500'
        let ln = ''
        
        if (c.type === 'add') {
          bgColor = 'bg-green-500/15'
          contentColor = 'text-green-300'
          lineNumberColor = 'text-green-500/50'
          ln = c.ln?.toString() || ''
        } else if (c.type === 'del') {
          bgColor = 'bg-red-500/15'
          contentColor = 'text-red-300'
          lineNumberColor = 'text-red-500/50'
          ln = c.ln?.toString() || ''
        } else {
          ln = (c.ln1 || c.ln2)?.toString() || ''
        }

        const codeContent = c.content.replace(/^[-+ ]/, '')

        return (
          <div className={`flex-1 flex ${bgColor} hover:bg-white/5 transition-colors group relative overflow-hidden`}>
            <div className={`w-12 flex-shrink-0 text-right pr-2 select-none border-r border-gray-800 ${lineNumberColor} bg-[#161b22]`}>
              {ln}
            </div>
            <div className="flex-1 pl-4 pr-2 whitespace-pre-wrap break-all font-mono text-[13px] leading-5">
              <span className={contentColor} dangerouslySetInnerHTML={{ __html: highlightContent(codeContent) }} />
            </div>
          </div>
        )
      }

      return (
        <div key={i} className="flex border-b border-gray-800/30 w-full">
          {renderSide(left)}
          {renderSide(right)}
        </div>
      )
    })
  }

  return (
    <div className="text-[13px] overflow-x-auto bg-[#0d1117] border-t border-gray-800 w-full rounded-b-xl custom-diff-viewer">
      <div className="min-w-max w-full">
        {file.chunks.map((chunk, chunkIdx) => (
          <div key={chunkIdx} className="mb-4 last:mb-0 w-full">
            {/* Hunk Header */}
            <div className="flex bg-[#161b22] text-blue-400 font-mono py-1 select-none border-y border-gray-800 w-full">
              {viewMode === 'inline' ? (
                <>
                  <div className="w-24 flex-shrink-0 border-r border-gray-800"></div>
                  <div className="pl-4">{chunk.content}</div>
                </>
              ) : (
                <>
                  <div className="flex-1 border-r border-gray-800 flex">
                    <div className="w-12 flex-shrink-0 border-r border-gray-800"></div>
                    <div className="pl-4">{chunk.content}</div>
                  </div>
                  <div className="flex-1 flex">
                    <div className="w-12 flex-shrink-0 border-r border-gray-800"></div>
                  </div>
                </>
              )}
            </div>
            
            {/* Changes */}
            <div className="flex flex-col w-full">
              {viewMode === 'inline' 
                ? chunk.changes.map((change, changeIdx) => renderInlineChange(change, changeIdx))
                : renderSplitChanges(chunk)
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
