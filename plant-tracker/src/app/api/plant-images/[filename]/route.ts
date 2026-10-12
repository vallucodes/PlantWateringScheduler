import { readFile } from "node:fs/promises"
import path from "node:path"

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const extension = path.extname(filename).toLowerCase()
  const contentType = contentTypes[extension]
  if (!contentType || path.basename(filename) !== filename) return new Response("Not found", { status: 404 })

  try {
    const image = await readFile(path.resolve(process.cwd(), "..", "imgs", filename))
    return new Response(image, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400" } })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
