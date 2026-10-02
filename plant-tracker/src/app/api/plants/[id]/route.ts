import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId) || plantId < 0) return Response.json({ error: "Invalid plant ID." }, { status: 400 })
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

  const plant = await prisma.plant.findUnique({ where: { id: plantId } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  if (!hasInterval && !hasWinterInterval) {
    const updatedPlant = await prisma.plant.update({ where: { id: plantId }, data: { name } })
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
    where: { id: plantId },
    data: { ...(hasName ? { name } : {}), wateringGroupId: wateringGroup.id, winterWateringGroupId: winterWateringGroup.id },
  })

  const selectedGroup = hasWinterInterval && !hasInterval ? winterWateringGroup : wateringGroup
  return Response.json({ name: hasName ? name : plant.name, season: hasWinterInterval && !hasInterval ? "winter" : "summer", group: selectedGroup.name === "Winter Unassigned" ? "Unassigned" : selectedGroup.name, wateringInterval: selectedGroup.intervalDays, winterWateringInterval: winterWateringGroup.intervalDays })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId) || plantId < 0) return Response.json({ error: "Invalid plant ID." }, { status: 400 })
  const body = await request.json().catch(() => null)

  if (body?.action === "setLastWatered") {
    const season = body?.season === "winter" ? "winter" : "summer"
    const dateValue = body?.date === null ? null : typeof body?.date === "string" ? body.date : null
    const date = dateValue === null ? null : new Date(`${dateValue}T00:00:00.000Z`)
    if (dateValue !== null && (!date || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue)) {
      return Response.json({ error: "Date must be a valid calendar day." }, { status: 400 })
    }

    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      select: { wateringGroupId: true, winterWateringGroupId: true },
    })
    if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

    const groupId = season === "winter" ? plant.winterWateringGroupId : plant.wateringGroupId
    if (!groupId) return Response.json({ error: "Plant has no watering group." }, { status: 400 })

    const group = await prisma.wateringGroup.update({
      where: { id: groupId },
      data: { lastWateredAt: date },
      select: { lastWateredAt: true },
    })
    return Response.json({ date: group.lastWateredAt?.toISOString() ?? null })
  }

  if (body?.action === "water") {
    const season = body?.season === "winter" ? "winter" : "summer"
    const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { wateringGroupId: true, winterWateringGroupId: true } })
    if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })
    const groupId = season === "winter" ? plant.winterWateringGroupId : plant.wateringGroupId
    if (!groupId) return Response.json({ error: "Plant has no watering group." }, { status: 400 })

    const now = new Date()
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const groupPlants = await prisma.plant.findMany({
      where: season === "winter" ? { winterWateringGroupId: groupId } : { wateringGroupId: groupId },
      select: { id: true },
    })

    await prisma.$transaction([
      prisma.wateringGroup.update({ where: { id: groupId }, data: { lastWateredAt: date } }),
      ...groupPlants.map(({ id: plantId }) =>
        prisma.weightLog.upsert({
          where: { plantId_date: { plantId, date } },
          update: { watered: true },
          create: { plantId, date, weight: null, watered: true },
        }),
      ),
    ])

    return Response.json({ date: date.toISOString(), plantIds: groupPlants.map(({ id: plantId }) => plantId) })
  }

  const weight = typeof body?.weight === "number" ? body.weight : Number(body?.weight)

  if (!Number.isFinite(weight) || weight < 0) {
    return Response.json({ error: "Weight must be zero or greater." }, { status: 400 })
  }

  const dateValue = typeof body?.date === "string" ? body.date : null
  const date = dateValue
    ? new Date(`${dateValue}T00:00:00.000Z`)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))
  if (dateValue && (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue)) {
    return Response.json({ error: "Date must be a valid calendar day." }, { status: 400 })
  }

  const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  const weightLog = await prisma.weightLog.upsert({
    where: { plantId_date: { plantId, date } },
    update: { weight },
    create: { plantId, date, weight },
  })

  return Response.json({ date: weightLog.date.toISOString(), weight: weightLog.weight })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId) || plantId < 0) return Response.json({ error: "Invalid plant ID." }, { status: 400 })
  const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  if (new URL(request.url).searchParams.get("weight") === "latest") {
    const latestWeight = await prisma.weightLog.findFirst({ where: { plantId }, orderBy: { date: "desc" } })
    if (!latestWeight) return Response.json({ error: "No weight history to remove." }, { status: 404 })

    await prisma.weightLog.delete({ where: { id: latestWeight.id } })
    return Response.json({ date: latestWeight.date.toISOString() })
  }

  await prisma.plant.delete({ where: { id: plantId } })
  return new Response(null, { status: 204 })
}
