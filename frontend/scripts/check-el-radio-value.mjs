import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src', import.meta.url))
const violations = []

function walk(dirPath) {
  const entries = readdirSync(dirPath)
  for (const entry of entries) {
    const fullPath = join(dirPath, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath)
      continue
    }
    if (!fullPath.endsWith('.vue')) continue
    checkFile(fullPath)
  }
}

function checkFile(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)
  const tagRegex = /<el-radio-button\b[^>]*:label\s*=|<el-radio\b[^>]*:label\s*=/i
  for (let i = 0; i < lines.length; i += 1) {
    if (!tagRegex.test(lines[i])) continue
    violations.push({ filePath, line: i + 1, code: lines[i].trim() })
  }
}

walk(ROOT)

if (violations.length) {
  console.error('[check-el-radio-value] 检测到旧写法（label 充当 value），请改为 :value：')
  violations.forEach((v) => {
    console.error(`- ${v.filePath}:${v.line}`)
    console.error(`  ${v.code}`)
  })
  process.exit(1)
}

console.log('[check-el-radio-value] 通过：未发现 el-radio/el-radio-button 的 :label 旧写法。')
