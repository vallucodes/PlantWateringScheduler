import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const hasName = Object.prototype.hasOwnProperty.call(body ?? {}, "name")
  const hasInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "intervalDays")
  const hasWinterInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "winterIntervalDays")
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const rawInterval = body?.intervalDays
  const rawWinterInterval = body?.winterIntervalDays

  if (!hasName && !hasInterval && !hasWinterInterval) return Response.json({ error: "No plant changes were provided." }, { status: 400 })
  if (hasName && !name) return Response.json({ error: "Plant name is required." }, { status: 400 })

  if (hasInterval && rawInterval !== null && (!Number.isInteger(rawInterval) || rawInterval < 1 || rawInterval > 365)) {
    return Response.json({ error: "Interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  if (hasWinterInterval && rawWinterInterval !== null && (!Number.isInteger(rawWinterInterval) || rawWinterInterval < 1 || rawWinterInterval > 365)) {
    return Response.json({ error: "Winter interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }

  const plant = await prisma.plant.findUnique({ where: { id } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  if (!hasInterval && !hasWinterInterval) {
    const updatedPlant = await prisma.plant.update({ where: { id }, data: { name } })
    return Response.json({ name: updatedPlant.name })
  }

  const [currentGroup, currentWinterGroup] = await Promise.all([
    plant.wateringGroupId ? prisma.wateringGroup.findUnique({ where: { id: plant.wateringGroupId } }) : null,
    plant.winterWateringGroupId ? prisma.wateringGroup.findUnique({ where: { id: plant.winterWateringGroupId } }) : null,
  ])
  const intervalDays = hasInterval ? rawInterval as number | null : currentGroup?.intervalDays ?? null
  const winterIntervalDays = hasWinterInterval
    ? rawWinterInterval as number | null
    : currentWinterGroup?.intervalDays ?? (intervalDays === null ? null : intervalDays * 2)
  const wateringGroup = await prisma.wateringGroup.upsert({
    where: { key: intervalDays === null ? "unassigned" : String(intervalDays) },
    update: { name: intervalDays === null ? "Unassigned" : String(intervalDays), intervalDays },
    create: { key: intervalDays === null ? "unassigned" : String(intervalDays), name: intervalDays === null ? "Unassigned" : String(intervalDays), intervalDays },
  })
  const winterWateringGroup = await prisma.wateringGroup.upsert({
    where: { key: winterIntervalDays === null ? "winter:unassigned" : `winter:${winterIntervalDays}` },
    update: { name: winterIntervalDays === null ? "Winter Unassigned" : String(winterIntervalDays), intervalDays: winterIntervalDays },
    create: { key: winterIntervalDays === null ? "winter:unassigned" : `winter:${winterIntervalDays}`, name: winterIntervalDays === null ? "Winter Unassigned" : String(winterIntervalDays), intervalDays: winterIntervalDays },
  })

  await prisma.plant.update({
    where: { id },
    data: { ...(hasName ? { name } : {}), wateringGroupId: wateringGroup.id, winterWateringGroupId: winterWateringGroup.id },
  })

  return Response.json({ name: hasName ? name : plant.name, group: wateringGroup.name, wateringInterval: wateringGroup.intervalDays, winterWateringInterval: winterWateringGroup.intervalDays })
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
