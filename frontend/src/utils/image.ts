export function toMigrationThumbUrl(rawUrl: string | undefined): string {
  const source = String(rawUrl ?? '').trim()
  if (!source) return ''
  if (/\/migration-old\/small_/i.test(source)) return source
  if (/\/migration-old\//i.test(source)) {
    const idx = source.lastIndexOf('/')
    if (idx >= 0) {
      const prefix = source.slice(0, idx + 1)
      const name = source.slice(idx + 1)
      if (name) return `${prefix}small_${name}`
    }
  }
  return source
}
