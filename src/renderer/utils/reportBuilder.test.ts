import { describe, expect, test } from 'vitest'
import type { MergeRequest } from '../../shared/types'
import { buildReportCSV, escapeCSVCell } from './reportBuilder'
import { resolveExternalMarkdownHref } from './safeMarkdown'

describe('CSV formula injection protection', () => {
  test.each([
    ['=CMD|\' /C calc\'!A0', `"'=CMD|' /C calc'!A0"`],
    ['+SUM(1,2)', `"'+SUM(1,2)"`],
    ['-10+20', `"'-10+20"`],
    ['@ attacker', `"'@ attacker"`],
    ['  =HYPERLINK("https://evil.example")', `"'  =HYPERLINK(""https://evil.example"")"`],
    ['feat: line1\r\n=evil()', `"feat: line1 =evil()"`],
  ])('neutralizes dangerous spreadsheet formula prefix in %j', (input, expected) => {
    expect(escapeCSVCell(input)).toBe(expected)
  })

  test('renders safe CSV report rows without raw leading formula operators', () => {
    const mr = {
      id: 1,
      iid: 42,
      title: '=1+1',
      state: 'opened',
      createdAt: '2026-10-20T00:00:00.000Z',
      webUrl: 'https://gitlab.example.com/group/proj/-/merge_requests/42',
    } as MergeRequest

    const csv = buildReportCSV(
      { name: '=Evil Name', username: 'dev', groupName: '+Team', timeframeLabel: 'Weekly' },
      { authored: [mr], merged: [], reviewed: [] }
    )

    expect(csv).toContain(`Name,"'=Evil Name (@dev)"`)
    expect(csv).toContain(`Group,"'+Team"`)
    expect(csv).toContain(`"Created",42,"'=1+1"`)
  })
})

describe('Markdown external link resolution', () => {
  test('resolves relative GitLab paths and allows http(s) URLs', () => {
    expect(
      resolveExternalMarkdownHref('/group/proj/-/issues/9', 'https://gitlab.example.com/group/proj/-/merge_requests/1')
    ).toBe('https://gitlab.example.com/group/proj/-/issues/9')

    expect(resolveExternalMarkdownHref('https://docs.gitlab.com/ee/')).toBe('https://docs.gitlab.com/ee/')
  })

  test.each([
    'javascript:alert(document.domain)',
    'data:text/html,<script>alert(1)</script>',
    'file:///C:/Windows/win.ini',
    '//evil.example/protocol-relative',
    '#section-heading',
    '',
  ])('rejects unsafe or non-external href: %j', (href) => {
    expect(
      resolveExternalMarkdownHref(href, 'https://gitlab.example.com/group/proj/-/merge_requests/1')
    ).toBeNull()
  })
})
