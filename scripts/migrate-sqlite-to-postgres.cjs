const path = require("node:path")
const { execFileSync } = require("node:child_process")
const dotenv = require(path.join(__dirname, "..", "plant-tracker", "node_modules", "dotenv"))
const { PrismaClient } = require(path.join(__dirname, "..", "plant-tracker", "src", "generated", "prisma"))

dotenv.config({ path: path.join(__dirname, "..", "plant-tracker", ".env.local") })

const databasePath = path.join(__dirname, "..", "prisma", "dev.db")
const prisma = new PrismaClient()

function readTable(table, columns) {
  const output = execFileSync("sqlite3", ["-json", databasePath, `SELECT ${columns} FROM ${table};`], { encoding: "utf8" })
  return JSON.parse(output || "[]")
}

function dateOrNull(value) {
  return value === null ? null : new Date(value)
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.")

  const [groups, plants, weightLogs] = [
    readTable("WateringGroup", "id, key, name, intervalDays, lastWateredAt, createdAt, updatedAt"),
    readTable("Plant", "id, name, minWeight, maxWeight, sourceRow, wateringGroupId, winterWateringGroupId, estimatedWateringInterval, createdAt, updatedAt"),
    readTable("WeightLog", "id, weight, watered, date, plantId, createdAt"),
  ]

  const destinationCounts = await Promise.all([
    prisma.wateringGroup.count(),
    prisma.plant.count(),
    prisma.weightLog.count(),
  ])
  if (destinationCounts.some(Boolean)) {
    throw new Error("PostgreSQL already contains data. Migration stopped without changing it.")
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.wateringGroup.createMany({
      data: groups.map((group) => ({
        id: group.id,
        key: group.key,
        name: group.name,
        intervalDays: group.intervalDays,
        lastWateredAt: dateOrNull(group.lastWateredAt),
        createdAt: new Date(group.createdAt),
        updatedAt: new Date(group.updatedAt),
      })),
    })
    await transaction.plant.createMany({
      data: plants.map((plant) => ({
        id: plant.id,
        name: plant.name,
        minWeight: plant.minWeight,
        maxWeight: plant.maxWeight,
        sourceRow: plant.sourceRow,
        wateringGroupId: plant.wateringGroupId,
        winterWateringGroupId: plant.winterWateringGroupId,
        estimatedWateringInterval: plant.estimatedWateringInterval,
        createdAt: new Date(plant.createdAt),
        updatedAt: new Date(plant.updatedAt),
      })),
    })
    await transaction.weightLog.createMany({
      data: weightLogs.map((log) => ({
        id: log.id,
        weight: log.weight,
        watered: Boolean(log.watered),
        date: new Date(log.date),
        plantId: log.plantId,
        createdAt: new Date(log.createdAt),
      })),
    })
  })

  console.log(`Migrated ${plants.length} plants, ${groups.length} watering groups, and ${weightLogs.length} weight logs.`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
