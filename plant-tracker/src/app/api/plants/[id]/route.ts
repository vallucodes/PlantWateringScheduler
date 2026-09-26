import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const hasName = Object.prototype.hasOwnProperty.call(body ?? {}, "name")
  const hasInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "intervalDays")
  const hasEstimatedInterval = Object.prototype.hasOwnProperty.call(body ?? {}, "estimatedWateringInterval")
  const season = body?.season ?? "summer"
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const rawInterval = body?.intervalDays
  const rawEstimatedInterval = body?.estimatedWateringInterval

  if (!hasName && !hasInterval && !hasEstimatedInterval) return Response.json({ error: "No plant changes were provided." }, { status: 400 })
  if (hasName && !name) return Response.json({ error: "Plant name is required." }, { status: 400 })
  if (season !== "summer" && season !== "winter") return Response.json({ error: "Season must be summer or winter." }, { status: 400 })

  if (hasInterval && rawInterval !== null && (!Number.isInteger(rawInterval) || rawInterval < 1 || rawInterval > 365)) {
    return Response.json({ error: "Interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  if (hasEstimatedInterval && rawEstimatedInterval !== null && (!Number.isInteger(rawEstimatedInterval) || rawEstimatedInterval < 1 || rawEstimatedInterval > 365)) {
    return Response.json({ error: "Estimated interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }
  const plant = await prisma.plant.findUnique({ where: { id }, include: { wateringGroup: true } })
  if (!plant) return Response.json({ error: "Plant not found." }, { status: 404 })

  if (!hasInterval) {
    if (hasEstimatedInterval && plant.wateringGroup?.key !== "unassigned") {
      return Response.json({ error: "Estimated intervals are only available for Unassigned plants." }, { status: 400 })
    }
    const updatedPlant = await prisma.plant.update({
      where: { id },
      data: {
        ...(hasName ? { name } : {}),
        ...(hasEstimatedInterval ? { estimatedWateringInterval: rawEstimatedInterval as number | null } : {}),
      },
    })
    return Response.json({ name: updatedPlant.name, estimatedWateringInterval: updatedPlant.estimatedWateringInterval })
  }

  const intervalDays = rawInterval as number | null
  const groupKey = season === "winter"
    ? `winter:${intervalDays === null ? "unassigned" : intervalDays}`
    : intervalDays === null ? "unassigned" : String(intervalDays)
  const groupName = intervalDays === null
    ? season === "winter" ? "Winter Unassigned" : "Unassigned"
    : String(intervalDays)
  const existingWinterGroup = season === "winter"
    ? await prisma.wateringGroup.findFirst({ where: { key: { startsWith: "winter:" }, intervalDays } })
    : null
  const wateringGroup = existingWinterGroup ?? await prisma.wateringGroup.upsert({
    where: { key: groupKey },
    update: { name: groupName, intervalDays },
    create: { key: groupKey, name: groupName, intervalDays },
  })

  await prisma.plant.update({
    where: { id },
    data: {
      ...(hasName ? { name } : {}),
      ...(season === "winter" ? { winterWateringGroupId: wateringGroup.id } : { wateringGroupId: wateringGroup.id }),
      ...(season === "summer" && wateringGroup.key !== "unassigned" ? { estimatedWateringInterval: null } : {}),
    },
  })

  return Response.json({ name: hasName ? name : plant.name, season, group: wateringGroup.name, wateringInterval: wateringGroup.intervalDays })
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
