import { useState, useEffect, useRef } from 'react'
import type { GitLabProject } from '../../shared/types'
import { Search, X, Loader2 } from 'lucide-react'

interface ProjectSelectorProps {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export default function ProjectSelector({ selectedIds, onChange }: ProjectSelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GitLabProject[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<{ id: number; name: string }[]>([])
  
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedProjects((prev) => {
      return selectedIds.map(id => {
        const existing = prev.find(p => p.id === id)
        return existing || { id, name: `Project ${id}` }
      })
    })
  }, [selectedIds])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await window.electronAPI.searchProjects(query)
        setResults(res)
      } catch (err) {
        console.error('Failed to search projects:', err)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (project: GitLabProject) => {
    if (!selectedIds.includes(project.id)) {
      onChange([...selectedIds, project.id])
      setSelectedProjects(prev => [...prev.filter(p => p.id !== project.id), { id: project.id, name: project.nameWithNamespace }])
    }
    setQuery('')
    setIsOpen(false)
  }

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter(x => x !== id))
    setSelectedProjects(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="flex flex-col gap-2 relative" ref={wrapperRef}>
      <div className="flex flex-wrap gap-2">
        {selectedProjects.map((p) => (
          <div key={p.id} className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded flex items-center gap-1 border border-gray-600">
            <span className="truncate max-w-[200px]" title={p.name}>{p.name}</span>
            <button onClick={() => handleRemove(p.id)} className="text-gray-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <Search className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search projects to add..."
          className="bg-gray-800 border border-gray-600 rounded pl-8 pr-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 w-full"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
          </div>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto z-10">
          {results.length === 0 && !loading ? (
            <div className="px-3 py-2 text-xs text-gray-500 text-center">No projects found</div>
          ) : (
            results.map(project => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-gray-200 transition-colors border-b border-gray-700 last:border-0"
              >
                <div className="font-medium text-gray-200">{project.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{project.nameWithNamespace}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
