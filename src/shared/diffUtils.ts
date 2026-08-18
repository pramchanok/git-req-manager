const GENERATED_FILE_PATTERNS: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)npm-shrinkwrap\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)bun\.lockb?$/,
  /(^|\/)composer\.lock$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /(^|\/)poetry\.lock$/,
  /(^|\/)Pipfile\.lock$/,
  /(^|\/)go\.sum$/,
  /(^|\/)Podfile\.lock$/,
  /(^|\/)packages\.lock\.json$/,
  /\.min\.(js|css)$/i,
  /\.map$/i,
  /\.generated\.(ts|js|go|java|cs)$/i,
]

export function isGeneratedFilePath(filePath: string): boolean {
  if (!filePath) return false
  return GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(filePath))
}

/**
 * Extracts the raw unified diff slice for a specific file path from full MR raw diff output.
 */
export function extractFileDiffFromRaw(rawDiff: string, filePath: string): string {
  if (!rawDiff || !filePath) return ''

  const sections = rawDiff.split(/(?=^diff --git )/m)

  for (const section of sections) {
    if (!section.startsWith('diff --git ')) continue
    const firstLine = section.split(/\r?\n/, 1)[0]

    if (
      firstLine.startsWith(`diff --git a/${filePath} `) ||
      firstLine.endsWith(` b/${filePath}`) ||
      firstLine.includes(`a/${filePath} b/`) ||
      firstLine.includes(` b/${filePath}`)
    ) {
      return section
    }
  }

  return ''
}
