interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
  color?: 'orange' | 'blue'
  className?: string
}

/** สวิตช์เปิด/ปิดมาตรฐานของหน้า Settings */
export default function ToggleSwitch({ checked, onChange, color = 'orange', className = '' }: ToggleSwitchProps) {
  const activeBg = color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? activeBg : 'bg-gray-600'
      } ${className}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
