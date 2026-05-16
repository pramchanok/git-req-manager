import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastData {
  message: string
  type: ToastType
}

interface ToastProps extends ToastData {
  onDismiss: () => void
}

export default function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const colorClass =
    type === 'error'
      ? 'bg-red-900/95 border-red-700 text-red-200'
      : type === 'info'
      ? 'bg-blue-900/95 border-blue-700 text-blue-200'
      : 'bg-gray-800 border-gray-600 text-gray-100'

  const icon = type === 'error' ? '✕' : type === 'info' ? 'ℹ' : '✓'

  return (
    <div className="fixed bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div
        className={`toast-enter pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border text-xs shadow-xl ${colorClass}`}
      >
        <span className="font-bold">{icon}</span>
        {message}
      </div>
    </div>
  )
}
