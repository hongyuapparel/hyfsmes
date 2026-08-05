import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src', import.meta.url))
const ALLOWED_DOCUMENT_STYLES = new Set([
  'components/packing/PackingDocument.css',
  'components/packing/PackingLabelPrint.css',
  'components/packing/PackingLabelPrint.print.css',
])
const SOURCE_EXTENSIONS = new Set(['.css', '.scss', '.vue'])
const violations = []

function normalizePath(filePath) {
  return relative(ROOT, filePath).split(sep).join('/')
}

function walk(dirPath) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath)
      continue
    }

    const extension = entry.slice(entry.lastIndexOf('.'))
    if (!SOURCE_EXTENSIONS.has(extension)) continue
    if (ALLOWED_DOCUMENT_STYLES.has(normalizePath(fullPath))) continue
    checkFile(fullPath)
  }
}

function checkFile(filePath) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  const numericFontSize = /font-size\s*:\s*-?\d*\.?\d+(?:px|pt|rem|em)\b/i

  lines.forEach((line, index) => {
    if (!numericFontSize.test(line)) return
    violations.push({
      filePath: normalizePath(filePath),
      line: index + 1,
      code: line.trim(),
    })
  })
}

walk(ROOT)

if (violations.length) {
  console.error('[check-typography] 检测到硬编码字号，请改用设计系统字号或图标尺寸 token：')
  violations.forEach((violation) => {
    console.error(`- ${violation.filePath}:${violation.line}`)
    console.error(`  ${violation.code}`)
  })
  process.exit(1)
}

console.log('[check-typography] 通过：业务界面未发现硬编码字号。')
