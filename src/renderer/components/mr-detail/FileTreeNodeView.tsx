import { useState } from 'react'
import { FileTreeNode } from '../../utils/pathTree'

/** โหนดไฟล์/โฟลเดอร์ใน sidebar ของแท็บ Changes (คลิกไฟล์เพื่อ scroll ไปที่ diff) */
export const FileTreeNodeView = ({ node, depth = 0 }: { node: FileTreeNode, depth?: number }) => {
  const [expanded, setExpanded] = useState(true)

  if (node.isDirectory) {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-gray-300 select-none rounded"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          <span className="text-xs truncate">{node.name}</span>
        </div>
        {expanded && node.children?.map((child, i) => (
          <FileTreeNodeView key={i} node={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 hover:bg-white/5 cursor-pointer select-none rounded group ${node.isViewed ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={() => {
        document.getElementById(`diff-${node.path}`)?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      <div className="flex items-center gap-1.5 overflow-hidden">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        <span className={`text-xs truncate ${node.isViewed ? 'line-through text-gray-500' : 'text-gray-300'}`}>{node.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-100 transition-opacity">
        {(node.additions ?? 0) > 0 && <span className="text-[10px] text-green-400">+{node.additions}</span>}
        {(node.deletions ?? 0) > 0 && <span className="text-[10px] text-red-400">-{node.deletions}</span>}
        {node.isViewed && <svg className="w-3 h-3 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </div>
    </div>
  )
}
