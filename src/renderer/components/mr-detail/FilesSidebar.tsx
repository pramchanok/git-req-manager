import type { Ref } from 'react'
import { FileTreeNode } from '../../utils/pathTree'
import { FileTreeNodeView } from './FileTreeNodeView'

interface FilesSidebarProps {
  fileTree: FileTreeNode[]
  filesCount: number
  collapsed: boolean
  onToggleCollapsed: () => void
  width: number
  sidebarRef: Ref<HTMLDivElement>
  resizerRef: Ref<HTMLDivElement>
  onStartResize: (startX: number) => void
}

/** Sidebar รายชื่อไฟล์ในแท็บ Changes (ยุบ/ขยาย + ลากปรับความกว้างได้) */
export default function FilesSidebar({ fileTree, filesCount, collapsed, onToggleCollapsed, width, sidebarRef, resizerRef, onStartResize }: FilesSidebarProps) {
  return (
    <div
      ref={sidebarRef}
      className={`relative h-full min-h-0 shrink-0 border-r border-gray-800 bg-[#0d1117] flex flex-col transition-colors duration-150 ${collapsed ? 'w-12' : ''}`}
      style={{ width: collapsed ? undefined : width }}
    >
      <div className="shrink-0 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        {!collapsed && <span className="text-xs font-semibold text-gray-400">Files</span>}
        <div className="flex items-center gap-2">
          {!collapsed && <span className="text-xs text-gray-500">{filesCount}</span>}
          <button
            onClick={onToggleCollapsed}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-800"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="file-tree-scroll min-h-0 flex-1 overflow-y-auto custom-scrollbar overscroll-contain p-2 pb-14">
          {fileTree.map((node) => (
            <FileTreeNodeView key={node.path} node={node} />
          ))}
        </div>
      )}

      {/* Resizer Handle */}
      {!collapsed && (
        <div
          ref={resizerRef}
          className="absolute top-0 bottom-0 -right-px z-10 w-1 cursor-col-resize transition-colors will-change-transform hover:bg-orange-500/50 active:bg-orange-500"
          onMouseDown={(event) => {
            event.preventDefault()
            onStartResize(event.clientX)
          }}
        />
      )}
    </div>
  )
}
