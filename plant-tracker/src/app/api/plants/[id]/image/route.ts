import { put } from "@vercel/blob"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const maxImageSize = 4 * 1024 * 1024

async function matchesImageType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  return false
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorizedResponse = await requireAdmin()
  if (unauthorizedResponse) return unauthorizedResponse

  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId) || plantId < 0) return Response.json({ error: "Invalid plant ID." }, { status: 400 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get("file")
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose an image to upload." }, { status: 400 })
  if (!imageTypes[file.type]) return Response.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 })
  if (file.size > maxImageSize) return Response.json({ error: "Images must be 4 MB or smaller." }, { status: 400 })
  if (!(await matchesImageType(file))) return Response.json({ error: "The file contents do not match its image type." }, { status: 400 })

  const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true, imageUrl: true } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })
  if (plant.imageUrl) return Response.json({ error: "This plant already has an uploaded image." }, { status: 409 })
  const hasReadWriteToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  const hasOidcCredentials = Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
  if (!hasReadWriteToken && !hasOidcCredentials) {
    return Response.json({ error: "Vercel Blob credentials are missing. Add the Blob environment variables to .env.local and restart the dev server." }, { status: 503 })
  }

  let blob
  try {
    blob = await put(`plants/${plantId}/plant-image.${imageTypes[file.type]}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    })
  } catch (error) {
    console.error("Plant image upload to Vercel Blob failed.", error)
    return Response.json({ error: "Image storage upload failed. Check Blob configuration and server logs." }, { status: 502 })
  }

  await prisma.plant.update({ where: { id: plantId }, data: { imageUrl: blob.url } })
  return Response.json({ imageUrl: blob.url })
}
