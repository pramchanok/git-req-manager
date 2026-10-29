import type { MouseEvent } from 'react'
import type { Components } from 'react-markdown'
import DOMPurify from 'dompurify'

const FORBIDDEN_UNTRUSTED_TAGS = [
  'style',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'object',
  'embed',
  'iframe',
  'base',
  'meta',
  'link',
]

/** Sanitize untrusted HTML while stripping data-*, aria-*, and UI-redressing form/style elements */
export function sanitizeUntrustedHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: FORBIDDEN_UNTRUSTED_TAGS,
  })
}

/** แปลง href จาก Markdown ให้เป็น http(s) URL ที่ปลอดภัย (รองรับ relative path ของ GitLab) */
export function resolveExternalMarkdownHref(
  href: string | undefined | null,
  baseWebUrl?: string
): string | null {
  if (!href || typeof href !== 'string') return null
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  let candidate = trimmed
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && baseWebUrl) {
    try {
      candidate = `${new URL(baseWebUrl).origin}${trimmed}`
    } catch {
      return null
    }
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/** ดักคลิกลิงก์ <a> ภายในบล็อก dangerouslySetInnerHTML ทุกชั้น (รวมกรณีคลิก element ลูกข้างใน <a>) */
export function handleSanitizedLinkClick(
  event: MouseEvent<HTMLElement>,
  baseWebUrl?: string
): void {
  const target = event.target as HTMLElement | null
  const anchor = target?.closest('a')
  if (!anchor) return

  event.preventDefault()
  const safeUrl = resolveExternalMarkdownHref(anchor.getAttribute('href'), baseWebUrl)
  if (safeUrl) {
    void window.electronAPI.openUrl(safeUrl)
  }
}

/** Custom components ของ ReactMarkdown เพื่อไม่ให้คลิกลิงก์แล้ว BrowserWindow navigate ออกจากแอป */
export function createMarkdownComponents(baseWebUrl?: string): Components {
  return {
    a({ href, children, ...props }) {
      const safeUrl = resolveExternalMarkdownHref(href, baseWebUrl)
      if (!safeUrl) {
        return <span>{children}</span>
      }
      return (
        <a
          {...props}
          href={safeUrl}
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault()
            void window.electronAPI.openUrl(safeUrl)
          }}
        >
          {children}
        </a>
      )
    },
  }
}
