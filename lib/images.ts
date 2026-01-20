export type NormalizedImageResult = {
  blob: Blob
  wasConverted: boolean
}

function normalizeMimeType(value: string | undefined): string {
  return (value || "").trim().toLowerCase()
}

function isHeicMimeType(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType)
  return normalized.includes("image/heic") || normalized.includes("image/heif")
}

async function looksLikeHeicContainer(blob: Blob): Promise<boolean> {
  try {
    const buffer = await blob.slice(0, 32).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes.length < 12) return false

    const toAscii = (start: number, length: number) =>
      String.fromCharCode(...Array.from(bytes.slice(start, start + length)))

    // ISO Base Media File: size(4) + "ftyp"(4) + majorBrand(4)
    if (toAscii(4, 4) !== "ftyp") return false

    const majorBrand = toAscii(8, 4)
    return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(majorBrand)
  } catch {
    return false
  }
}

async function isProbablyHeic(blob: Blob): Promise<boolean> {
  const type = normalizeMimeType(blob.type)
  if (isHeicMimeType(type)) return true

  // Some downloads may come back as octet-stream but still be HEIC/HEIF.
  if (!type || type === "application/octet-stream") {
    return await looksLikeHeicContainer(blob)
  }

  return false
}

async function convertHeicToJpeg(blob: Blob): Promise<Blob> {
  const module = (await import("heic2any")) as unknown as { default?: unknown }
  const heic2any = module.default as
    | ((options: { blob: Blob; toType: string; quality?: number }) => Promise<Blob | Blob[]>)
    | undefined

  if (!heic2any) {
    throw new Error("Missing HEIC converter.")
  }

  const converted = await heic2any({
    blob,
    toType: "image/jpeg",
    quality: 0.9,
  })

  const first = Array.isArray(converted) ? converted[0] : converted
  if (!(first instanceof Blob)) {
    throw new Error("Failed to convert HEIC image.")
  }

  return first
}

export async function normalizeImageBlobForBrowser(blob: Blob): Promise<NormalizedImageResult> {
  if (!import.meta.client) {
    return { blob, wasConverted: false }
  }

  if (!(await isProbablyHeic(blob))) {
    return { blob, wasConverted: false }
  }

  const converted = await convertHeicToJpeg(blob)
  return { blob: converted, wasConverted: true }
}

