import type { MergeRequest } from '../../shared/types'
import { formatDate, formatDateTime } from './dateFormat'

export interface DeveloperData {
  authored: MergeRequest[]
  merged: MergeRequest[]
  reviewed: MergeRequest[]
}

export interface ReportMeta {
  name: string
  username: string
  groupName: string
  timeframeLabel: string
}

/** ป้องกัน CSV / Excel Formula Injection (CWE-1236) และการขึ้นบรรทัดใหม่หลุดคอลัมน์ */
export function escapeCSVCell(value: string | number): string {
  const normalized = String(value).replace(/[\r\n]+/g, ' ')
  const neutralized = /^[\s]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
  return `"${neutralized.replace(/"/g, '""')}"`
}

/** สร้างเนื้อหารายงานเป็น Markdown (pure function — เขียน test ได้ง่าย) */
export function buildReportMarkdown(meta: ReportMeta, data: DeveloperData): string {
  const formatMRList = (mrs: MergeRequest[]) => {
    if (mrs.length === 0) return '_No Merge Requests._\n'
    return mrs
      .map((mr, idx) => {
        const stateBadge = mr.state === 'merged' ? '✅ Merged' : mr.state === 'closed' ? '❌ Closed' : '🔵 Open'
        const dateStr = formatDate(mr.createdAt)
        return `${idx + 1}. **!${mr.iid}**: [${mr.title.replace(/[\[\]]/g, '\\$&')}](${mr.webUrl}) - [${stateBadge}] (Created: ${dateStr})`
      })
      .join('\n')
  }

  return `# Developer Contribution Report: ${meta.name} (@${meta.username})

* **Group:** ${meta.groupName}
* **Period:** ${meta.timeframeLabel}
* **Generated At:** ${formatDateTime(new Date())}

---

## 📊 Summary of Contributions

| Contribution Type | Count |
| :--- | :---: |
| **MRs Created (สร้าง)** | **${data.authored.length}** |
| **MRs Merged (สลักเสร็จสิ้น)** | **${data.merged.length}** |
| **MRs Reviewed / Assigned (ตรวจทาน/รับมอบหมาย)** | **${data.reviewed.length}** |

---

## ✍️ Created Merge Requests (${data.authored.length})

${formatMRList(data.authored)}

## 🏆 Merged Merge Requests (${data.merged.length})

${formatMRList(data.merged)}

## 👁️ Reviewed / Assigned Merge Requests (${data.reviewed.length})

${formatMRList(data.reviewed)}
`
}

/** สร้างเนื้อหารายงานเป็น CSV สำหรับ Excel (pure function — เขียน test ได้ง่าย) */
export function buildReportCSV(meta: ReportMeta, data: DeveloperData): string {
  let csv = `Developer Performance Report\n`
  csv += `Name,${escapeCSVCell(`${meta.name} (@${meta.username})`)}\n`
  csv += `Group,${escapeCSVCell(meta.groupName)}\n`
  csv += `Timeframe,${escapeCSVCell(meta.timeframeLabel)}\n`
  csv += `Generated At,${escapeCSVCell(formatDateTime(new Date()))}\n\n`

  csv += `Summary Metrics\n`
  csv += `Metric,Value\n`
  csv += `MRs Created,${data.authored.length}\n`
  csv += `MRs Merged,${data.merged.length}\n`
  csv += `MRs Reviewed / Assigned,${data.reviewed.length}\n\n`

  csv += `Detailed Activity List\n`
  csv += `Activity Type,MR IID,Title,State,Created At,URL\n`

  const addRows = (list: MergeRequest[], type: string) => {
    list.forEach((mr) => {
      csv += `${escapeCSVCell(type)},${mr.iid},${escapeCSVCell(mr.title)},${escapeCSVCell(mr.state)},${escapeCSVCell(formatDate(mr.createdAt))},${escapeCSVCell(mr.webUrl)}\n`
    })
  }

  addRows(data.authored, 'Created')
  addRows(data.merged, 'Merged')
  addRows(data.reviewed, 'Reviewed/Assigned')

  return csv
}
