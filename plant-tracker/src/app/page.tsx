import PlantDashboard from "@/components/plant-dashboard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function Home() {
  const plants = await prisma.plant.findMany({
    include: {
      wateringGroup: true,
      weightLogs: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { sourceRow: "asc" },
  })
  const latestLogDate = plants
    .flatMap((plant) => plant.weightLogs.map((log) => log.date))
    .sort((firstDate, secondDate) => secondDate.getTime() - firstDate.getTime())[0]
    ?.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" }) ?? "No measurements"

  return (
    <PlantDashboard
      lastUpdated={latestLogDate}
      plants={plants.map((plant) => {
        const latestWeight = plant.weightLogs.at(-1)?.weight ?? 0

        return {
          id: plant.id,
          name: plant.name,
          species: plant.qualifier ?? "No qualifier",
          group: plant.wateringGroup?.name ?? "Unassigned",
          room: plant.wateringGroup?.intervalDays
            ? `Every ${plant.wateringGroup.intervalDays} days`
            : "No schedule",
          minWeight: plant.minWeight ?? latestWeight,
          maxWeight: plant.maxWeight ?? latestWeight,
          history: plant.weightLogs.map((log) => ({
            date: log.date.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              timeZone: "UTC",
            }),
            weight: log.weight,
          })),
        }
      })}
    />
  )
}
