import PlantDashboard from "@/components/plant-dashboard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function buildHistory(weightLogs: { date: Date; weight: number | null }[]) {
  if (weightLogs.length === 0) return []

  const firstDate = new Date(weightLogs[0].date)
  const lastDate = new Date(weightLogs.at(-1)?.date ?? firstDate)
  const weightsByDate = new Map(
    weightLogs.map((log) => [log.date.toISOString().slice(0, 10), log.weight]),
  )
  const history = []

  for (const date = new Date(firstDate); date <= lastDate; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateKey = date.toISOString().slice(0, 10)
    history.push({
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        timeZone: "UTC",
      }),
      weight: weightsByDate.get(dateKey) ?? null,
    })
  }

  return history
}

export default async function Home() {
  const plants = await prisma.plant.findMany({
    include: {
      wateringGroup: true,
      winterWateringGroup: true,
      weightLogs: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { sourceRow: "asc" },
  })
  const wateringGroups = await prisma.wateringGroup.findMany({
    select: { key: true, name: true, lastWateredAt: true },
  })
  const latestLogDate = plants
    .flatMap((plant) => plant.weightLogs.map((log) => log.date))
    .sort((firstDate, secondDate) => secondDate.getTime() - firstDate.getTime())[0]
    ?.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" }) ?? "No measurements"

  return (
    <PlantDashboard
      lastUpdated={latestLogDate}
      groupDates={wateringGroups.map((group) => ({
        season: group.key.startsWith("winter:") ? "winter" as const : "summer" as const,
        name: group.name,
        date: group.lastWateredAt?.toISOString() ?? null,
      }))}
      plants={plants.map((plant) => {
        const latestWeight = plant.weightLogs.at(-1)?.weight ?? 0

        return {
          id: plant.id,
          name: plant.name,
          group: plant.wateringGroup?.name ?? "Unassigned",
          wateringInterval: plant.wateringGroup?.intervalDays ?? null,
          lastWatered: plant.wateringGroup?.lastWateredAt?.toISOString() ?? null,
          winterGroup: plant.winterWateringGroup?.name ?? "Winter Unassigned",
          winterWateringInterval: plant.winterWateringGroup?.intervalDays ?? null,
          winterLastWatered: plant.winterWateringGroup?.lastWateredAt?.toISOString() ?? null,
          estimatedWateringInterval: plant.estimatedWateringInterval,
          room: plant.wateringGroup?.intervalDays
            ? `Every ${plant.wateringGroup.intervalDays} days`
            : "No schedule",
          minWeight: plant.minWeight ?? latestWeight,
          maxWeight: plant.maxWeight ?? latestWeight,
          history: buildHistory(plant.weightLogs),
        }
      })}
    />
  )
}
