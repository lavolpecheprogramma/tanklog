export const DEFAULT_CHART_COLOR = "#2563eb"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase()
  const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (!match) return null

  const raw = match[1]!
  const expanded = raw.length === 3 || raw.length === 4 ? raw.split("").map((ch) => ch + ch).join("") : raw
  const rgbHex = expanded.slice(0, 6)

  const r = Number.parseInt(rgbHex.slice(0, 2), 16)
  const g = Number.parseInt(rgbHex.slice(2, 4), 16)
  const b = Number.parseInt(rgbHex.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null

  return { r, g, b }
}

export function hexToRgbaOrFallback(options: {
  hex: string | null | undefined
  alpha: number
  fallbackHex?: string
}): string {
  const fallbackHex = options.fallbackHex ?? DEFAULT_CHART_COLOR
  const baseHex = options.hex ?? fallbackHex

  const rgb = parseHexRgb(baseHex)
  const alpha = clamp01(options.alpha)

  if (!rgb) {
    const fallbackRgb = parseHexRgb(fallbackHex)
    if (!fallbackRgb) return `rgba(37, 99, 235, ${alpha})`
    return `rgba(${fallbackRgb.r}, ${fallbackRgb.g}, ${fallbackRgb.b}, ${alpha})`
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

