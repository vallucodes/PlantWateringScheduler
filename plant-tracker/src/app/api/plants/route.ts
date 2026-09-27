import { prisma } from "@/lib/prisma"

function parseWeight(value: unknown) {
  return value === "" || value === null || value === undefined ? null : Number(value)
}

function winterGroupFor(group: { key: string; name: string; intervalDays: number | null }) {
  const intervalDays = group.intervalDays === null ? null : group.intervalDays * 2
  return {
    key: `winter:${group.key}`,
    name: intervalDays === null ? `Winter ${group.name}` : String(intervalDays),
    intervalDays,
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const minWeight = parseWeight(body?.minWeight)
  const maxWeight = parseWeight(body?.maxWeight)
  const intervalDays = body?.intervalDays === "" || body?.intervalDays === null || body?.intervalDays === undefined
    ? null
    : Number(body.intervalDays)

  if (!name) return Response.json({ error: "Plant name is required." }, { status: 400 })
  if ([minWeight, maxWeight].some((weight) => weight !== null && (!Number.isFinite(weight) || weight < 0))) {
    return Response.json({ error: "Weights must be zero or greater." }, { status: 400 })
  }
  if (minWeight !== null && maxWeight !== null && minWeight >= maxWeight) {
    return Response.json({ error: "Fully watered weight must be greater than dry weight." }, { status: 400 })
  }
  if (intervalDays !== null && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)) {
    return Response.json({ error: "Interval must be a whole number from 1 to 365 days." }, { status: 400 })
  }

  const plant = await prisma.$transaction(async (transaction) => {
    const lowestManualRow = await transaction.plant.aggregate({ _min: { sourceRow: true } })
    const sourceRow = Math.min(-1, (lowestManualRow._min.sourceRow ?? 0) - 1)
    const groupKey = intervalDays === null ? "unassigned" : String(intervalDays)
    const wateringGroup = await transaction.wateringGroup.upsert({
      where: { key: groupKey },
      update: { name: intervalDays === null ? "Unassigned" : groupKey, intervalDays },
      create: { key: groupKey, name: intervalDays === null ? "Unassigned" : groupKey, intervalDays },
    })
    const winterGroup = winterGroupFor({
      key: groupKey,
      name: intervalDays === null ? "Unassigned" : groupKey,
      intervalDays,
    })
    const winterWateringGroup = await transaction.wateringGroup.upsert({
      where: { key: winterGroup.key },
      update: { name: winterGroup.name, intervalDays: winterGroup.intervalDays },
      create: winterGroup,
    })

    return transaction.plant.create({
      data: {
        name,
        minWeight,
        maxWeight,
        sourceRow,
        wateringGroupId: wateringGroup.id,
        winterWateringGroupId: winterWateringGroup.id,
      },
    })
  })

  return Response.json({
    plant: {
      id: plant.id,
      name: plant.name,
      group: intervalDays === null ? "Unassigned" : String(intervalDays),
      wateringInterval: intervalDays,
      lastWatered: null,
      room: intervalDays ? `Every ${intervalDays} days` : "No schedule",
      minWeight: minWeight ?? 0,
      maxWeight: maxWeight ?? 0,
      history: [],
    },
  }, { status: 201 })
}
