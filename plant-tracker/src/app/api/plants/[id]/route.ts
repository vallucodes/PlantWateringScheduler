import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const hasName = Object.prototype.hasOwnProperty.call(body ?? {}, "name")
  const hasInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "intervalDays")
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const rawInterval = body?.intervalDays

  if (!hasName && !hasInterval) return Response.json({ error: "No plant changes were provided." }, { status: 400 })
  if (hasName && !name) return Response.json({ error: "Plant name is required." }, { status: 400 })

  if (hasInterval && rawInterval !== null && (!Number.isInteger(rawInterval) || rawInterval < 1 || rawInterval > 365)) {
    return Response.json({ error: "Interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  const plant = await prisma.plant.findUnique({ where: { id } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  if (!hasInterval) {
    const updatedPlant = await prisma.plant.update({ where: { id }, data: { name } })
    return Response.json({ name: updatedPlant.name })
  }

  const intervalDays = rawInterval as number | null
  const wateringGroup = intervalDays === null
    ? await prisma.wateringGroup.upsert({
        where: { key: "unassigned" },
        update: { name: "Unassigned", intervalDays: null },
        create: { key: "unassigned", name: "Unassigned", intervalDays: null },
      })
    : await prisma.wateringGroup.upsert({
        where: { key: String(intervalDays) },
        update: { name: String(intervalDays), intervalDays },
        create: { key: String(intervalDays), name: String(intervalDays), intervalDays },
      })

  await prisma.plant.update({
    where: { id },
    data: { ...(hasName ? { name } : {}), wateringGroupId: wateringGroup.id },
  })

  return Response.json({ name: hasName ? name : plant.name, group: wateringGroup.name, wateringInterval: wateringGroup.intervalDays })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const weight = typeof body?.weight === "number" ? body.weight : Number(body?.weight)

  if (!Number.isFinite(weight) || weight < 0) {
    return Response.json({ error: "Weight must be zero or greater." }, { status: 400 })
  }

  const plant = await prisma.plant.findUnique({ where: { id }, select: { id: true } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const weightLog = await prisma.weightLog.upsert({
    where: { plantId_date: { plantId: id, date } },
    update: { weight },
    create: { plantId: id, date, weight },
  })

  return Response.json({ date: weightLog.date.toISOString(), weight: weightLog.weight })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plant = await prisma.plant.findUnique({ where: { id }, select: { id: true } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  await prisma.plant.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
