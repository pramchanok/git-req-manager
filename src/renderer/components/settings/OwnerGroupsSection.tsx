import type { GitLabGroup } from '../../../shared/types'
import ToggleSwitch from './ToggleSwitch'

interface OwnerGroupsSectionProps {
  ownerGroups: GitLabGroup[]
  loading: boolean
  selectedIds: number[]
  onToggle: (groupId: number) => void
}

/** ส่วนตั้งค่าแจ้งเตือน MR ใหม่ใน Group ที่เราเป็น Owner */
export default function OwnerGroupsSection({ ownerGroups, loading, selectedIds, onToggle }: OwnerGroupsSectionProps) {
  if (!loading && ownerGroups.length === 0) return null

  return (
    <div className="border-t border-gray-700 pt-2 flex flex-col gap-2">
      <div>
        <p className="text-xs font-semibold text-gray-300">👑 Owner Group Notifications</p>
        <p className="text-xs text-gray-600 mt-0.5">แจ้งเตือน MR ใหม่ทุกอันใน Group ที่คุณเป็น Owner</p>
      </div>
      {loading ? (
        <p className="text-xs text-gray-600 animate-pulse">กำลังโหลด Groups…</p>
      ) : (
        ownerGroups.map((group) => {
          const enabled = selectedIds.includes(group.id)
          return (
            <div key={group.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">{group.name}</p>
                <p className="text-xs text-gray-600 truncate">{group.fullPath}</p>
              </div>
              <ToggleSwitch
                checked={enabled}
                onChange={() => onToggle(group.id)}
                className="flex-shrink-0"
              />
            </div>
          )
        })
      )}
    </div>
  )
}
