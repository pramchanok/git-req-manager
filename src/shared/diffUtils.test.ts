import { describe, expect, test } from 'vitest'
import { extractFileDiffFromRaw, isGeneratedFilePath } from './diffUtils'

describe('diffUtils', () => {
  describe('isGeneratedFilePath', () => {
    test('identifies lockfiles as generated', () => {
      expect(isGeneratedFilePath('package-lock.json')).toBe(true)
      expect(isGeneratedFilePath('subfolder/package-lock.json')).toBe(true)
      expect(isGeneratedFilePath('yarn.lock')).toBe(true)
      expect(isGeneratedFilePath('pnpm-lock.yaml')).toBe(true)
      expect(isGeneratedFilePath('composer.lock')).toBe(true)
      expect(isGeneratedFilePath('Cargo.lock')).toBe(true)
      expect(isGeneratedFilePath('go.sum')).toBe(true)
    })

    test('identifies minified and source map files as generated', () => {
      expect(isGeneratedFilePath('bundle.min.js')).toBe(true)
      expect(isGeneratedFilePath('style.min.css')).toBe(true)
      expect(isGeneratedFilePath('index.js.map')).toBe(true)
    })

    test('returns false for normal source files', () => {
      expect(isGeneratedFilePath('package.json')).toBe(false)
      expect(isGeneratedFilePath('src/index.ts')).toBe(false)
      expect(isGeneratedFilePath('README.md')).toBe(false)
    })
  })

  describe('extractFileDiffFromRaw', () => {
    const sampleRawDiff = `diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -8,6 +8,7 @@
 "start": "node index.js"
+ "watch": "node --watch index.js"
diff --git a/package-lock.json b/package-lock.json
index 3333333..4444444 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,6 @@
{
+ "name": "my-app"
}
`

    test('extracts the specific file diff slice', () => {
      const lockDiff = extractFileDiffFromRaw(sampleRawDiff, 'package-lock.json')
      expect(lockDiff).toContain('diff --git a/package-lock.json b/package-lock.json')
      expect(lockDiff).toContain('+ "name": "my-app"')
      expect(lockDiff).not.toContain('diff --git a/package.json b/package.json')
    })

    test('extracts the first file diff slice', () => {
      const pkgDiff = extractFileDiffFromRaw(sampleRawDiff, 'package.json')
      expect(pkgDiff).toContain('diff --git a/package.json b/package.json')
      expect(pkgDiff).toContain('+ "watch": "node --watch index.js"')
      expect(pkgDiff).not.toContain('diff --git a/package-lock.json b/package-lock.json')
    })

    test('returns empty string if file is not found', () => {
      expect(extractFileDiffFromRaw(sampleRawDiff, 'non-existent.js')).toBe('')
    })
  })
})
