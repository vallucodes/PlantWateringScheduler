import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorizedResponse = await requireAdmin()
  if (unauthorizedResponse) return unauthorizedResponse

  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId) || plantId < 0) return Response.json({ error: "Invalid plant ID." }, { status: 400 })
  const body = await request.json().catch(() => null)
  const hasName = Object.prototype.hasOwnProperty.call(body ?? {}, "name")
  const hasInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "intervalDays")
  const hasWinterInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "winterIntervalDays")
  const hasEstimatedInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "estimatedWateringInterval")
  const hasMinWeight = Object.prototype.hasOwnProperty.call(body ?? {}, "minWeight")
  const hasMaxWeight = Object.prototype.hasOwnProperty.call(body ?? {}, "maxWeight")
  const hasToleranceColor = Object.prototype.hasOwnProperty.call(body ?? {}, "toleranceColor")
  const hasWinterToleranceColor = Object.prototype.hasOwnProperty.call(body ?? {}, "winterToleranceColor")
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const rawInterval = body?.intervalDays
  const rawWinterInterval = body?.winterIntervalDays
  const rawEstimatedInterval = body?.estimatedWateringInterval
  const rawMinWeight = body?.minWeight
  const rawMaxWeight = body?.maxWeight
  const parseWeight = (value: unknown) => value === "" || value === null || value === undefined ? null : Number(value)
  const minWeight = hasMinWeight ? parseWeight(rawMinWeight) : undefined
  const maxWeight = hasMaxWeight ? parseWeight(rawMaxWeight) : undefined
  const toleranceColors = ["red", "orange", "green", "blue"] as const
  const toleranceColor = body?.toleranceColor
  const winterToleranceColor = body?.winterToleranceColor

  if (!hasName && !hasInterval && !hasWinterInterval && !hasEstimatedInterval && !hasMinWeight && !hasMaxWeight && !hasToleranceColor && !hasWinterToleranceColor) return Response.json({ error: "No plant changes were provided." }, { status: 400 })
  if (hasName && !name) return Response.json({ error: "Plant name is required." }, { status: 400 })
  if (hasToleranceColor && (typeof toleranceColor !== "string" || !toleranceColors.includes(toleranceColor as typeof toleranceColors[number]))) return Response.json({ error: "Invalid summer tolerance color." }, { status: 400 })
  if (hasWinterToleranceColor && (typeof winterToleranceColor !== "string" || !toleranceColors.includes(winterToleranceColor as typeof toleranceColors[number]))) return Response.json({ error: "Invalid winter tolerance color." }, { status: 400 })

  if (hasInterval && rawInterval !== null && (!Number.isInteger(rawInterval) || rawInterval < 1 || rawInterval > 365)) {
    return Response.json({ error: "Interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  if (hasWinterInterval && rawWinterInterval !== null && (!Number.isInteger(rawWinterInterval) || rawWinterInterval < 1 || rawWinterInterval > 365)) {
    return Response.json({ error: "Winter interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  if (hasEstimatedInterval && rawEstimatedInterval !== null && (!Number.isInteger(rawEstimatedInterval) || rawEstimatedInterval < 1 || rawEstimatedInterval > 365)) {
    return Response.json({ error: "Estimated interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  if ([minWeight, maxWeight].some((weight) => weight !== undefined && weight !== null && (!Number.isFinite(weight) || weight < 0))) {
    return Response.json({ error: "Weights must be zero or greater." }, { status: 400 })
  }

  const plant = await prisma.plant.findUnique({ where: { id: plantId } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })
  const nextMinWeight = hasMinWeight ? minWeight as number | null : plant.minWeight
  const nextMaxWeight = hasMaxWeight ? maxWeight as number | null : plant.maxWeight
  if (nextMinWeight !== null && nextMaxWeight !== null && nextMinWeight >= nextMaxWeight) {
    return Response.json({ error: "Fully watered weight must be greater than dry weight." }, { status: 400 })
  }

  if (!hasInterval && !hasWinterInterval) {
    const updatedPlant = await prisma.plant.update({
      where: { id: plantId },
      data: {
        ...(hasName ? { name } : {}),
        ...(hasEstimatedInterval ? { estimatedWateringInterval: rawEstimatedInterval as number | null } : {}),
        ...(hasMinWeight ? { minWeight } : {}),
        ...(hasMaxWeight ? { maxWeight } : {}),
        ...(hasToleranceColor ? { summerToleranceColor: toleranceColor as string } : {}),
        ...(hasWinterToleranceColor ? { winterToleranceColor: winterToleranceColor as string } : {}),
      },
    })
    return Response.json({ name: updatedPlant.name, estimatedWateringInterval: updatedPlant.estimatedWateringInterval, minWeight: updatedPlant.minWeight, maxWeight: updatedPlant.maxWeight, summerToleranceColor: updatedPlant.summerToleranceColor, winterToleranceColor: updatedPlant.winterToleranceColor })
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
    data: { ...(hasName ? { name } : {}), ...(hasEstimatedInterval ? { estimatedWateringInterval: rawEstimatedInterval as number | null } : {}), ...(hasMinWeight ? { minWeight } : {}), ...(hasMaxWeight ? { maxWeight } : {}), ...(hasToleranceColor ? { summerToleranceColor: toleranceColor as string } : {}), ...(hasWinterToleranceColor ? { winterToleranceColor: winterToleranceColor as string } : {}), wateringGroupId: wateringGroup.id, winterWateringGroupId: winterWateringGroup.id },
  })

  const selectedGroup = hasWinterInterval && !hasInterval ? winterWateringGroup : wateringGroup
  return Response.json({ name: hasName ? name : plant.name, estimatedWateringInterval: hasEstimatedInterval ? rawEstimatedInterval : plant.estimatedWateringInterval, minWeight: nextMinWeight, maxWeight: nextMaxWeight, season: hasWinterInterval && !hasInterval ? "winter" : "summer", group: selectedGroup.name === "Winter Unassigned" ? "Unassigned" : selectedGroup.name, wateringInterval: selectedGroup.intervalDays, winterWateringInterval: winterWateringGroup.intervalDays })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorizedResponse = await requireAdmin()
  if (unauthorizedResponse) return unauthorizedResponse

  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId) || plantId < 0) return Response.json({ error: "Invalid plant ID." }, { status: 400 })
  const body = await request.json().catch(() => null)

  if (body?.action === "setToleranceColor") {
    const season = body?.season === "winter" ? "winter" : body?.season === "summer" ? "summer" : null
    const color = body?.color
    const toleranceColors = ["red", "orange", "green", "blue"] as const
    if (!season || typeof color !== "string" || !toleranceColors.includes(color as typeof toleranceColors[number])) {
      return Response.json({ error: "Invalid tolerance color." }, { status: 400 })
    }

    const existingPlant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true } })
    if (!existingPlant) return Response.json({ error: "Plant not found." }, { status: 404 })

    const plant = await prisma.plant.update({
      where: { id: plantId },
      data: season === "winter" ? { winterToleranceColor: color } : { summerToleranceColor: color },
      select: { summerToleranceColor: true, winterToleranceColor: true },
    })
    return Response.json(plant)
  }

  if (body?.action === "setLastWatered") {
    const season = body?.season === "winter" ? "winter" : "summer"
    const dateValue = body?.date === null ? null : typeof body?.date === "string" ? body.date : null
    const date = dateValue === null ? null : new Date(`${dateValue}T00:00:00.000Z`)
    if (dateValue !== null && (!date || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue)) {
      return Response.json({ error: "Date must be a valid calendar day." }, { status: 400 })
    }

    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      select: { wateringGroup: { select: { id: true, intervalDays: true } }, winterWateringGroup: { select: { id: true, intervalDays: true } } },
    })
    if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

    const group = season === "winter" ? plant.winterWateringGroup : plant.wateringGroup
    if (!group) return Response.json({ error: "Plant has no watering group." }, { status: 400 })

    if (group.intervalDays === null) {
      const updatedPlant = await prisma.plant.update({
        where: { id: plantId },
        data: season === "winter" ? { winterLastWateredAt: date } : { summerLastWateredAt: date },
        select: { summerLastWateredAt: true, winterLastWateredAt: true },
      })
      const lastWateredAt = season === "winter" ? updatedPlant.winterLastWateredAt : updatedPlant.summerLastWateredAt
      return Response.json({ date: lastWateredAt?.toISOString() ?? null })
    }

    const updatedGroup = await prisma.wateringGroup.update({
      where: { id: group.id },
      data: { lastWateredAt: date },
      select: { lastWateredAt: true },
    })
    return Response.json({ date: updatedGroup.lastWateredAt?.toISOString() ?? null })
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
  const unauthorizedResponse = await requireAdmin()
  if (unauthorizedResponse) return unauthorizedResponse

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
