const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("Plant")');
  const idColumn = columns.find((column) => column.name === "id");
  if (!idColumn) throw new Error('The "Plant" table was not found.');
  if (String(idColumn.type).toUpperCase().includes("INT")) {
    console.log("Plant IDs are already integers.");
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`
      CREATE TEMP TABLE plant_id_map (
        old_id TEXT PRIMARY KEY,
        new_id INTEGER NOT NULL UNIQUE
      )
    `);
    await transaction.$executeRawUnsafe(`
      INSERT INTO plant_id_map (old_id, new_id)
      SELECT id, ROW_NUMBER() OVER (ORDER BY sourceRow, id) - 1
      FROM Plant
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TABLE Plant_new (
        id INTEGER NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        minWeight REAL,
        maxWeight REAL,
        sourceRow INTEGER NOT NULL,
        wateringGroupId TEXT,
        winterWateringGroupId TEXT,
        estimatedWateringInterval INTEGER,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wateringGroupId) REFERENCES WateringGroup(id) ON DELETE SET NULL,
        FOREIGN KEY (winterWateringGroupId) REFERENCES WateringGroup(id) ON DELETE SET NULL
      )
    `);
    await transaction.$executeRawUnsafe(`
      INSERT INTO Plant_new (
        id, name, minWeight, maxWeight, sourceRow, wateringGroupId,
        winterWateringGroupId, estimatedWateringInterval, createdAt, updatedAt
      )
      SELECT map.new_id, plant.name, plant.minWeight, plant.maxWeight,
        plant.sourceRow, plant.wateringGroupId, plant.winterWateringGroupId,
        plant.estimatedWateringInterval, plant.createdAt, plant.updatedAt
      FROM Plant plant
      JOIN plant_id_map map ON map.old_id = plant.id
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TABLE WeightLog_new (
        id TEXT NOT NULL PRIMARY KEY,
        weight REAL,
        watered BOOLEAN NOT NULL DEFAULT false,
        date DATETIME NOT NULL,
        plantId INTEGER NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plantId) REFERENCES Plant_new(id) ON DELETE CASCADE
      )
    `);
    await transaction.$executeRawUnsafe(`
      INSERT INTO WeightLog_new (id, weight, watered, date, plantId, createdAt)
      SELECT log.id, log.weight, log.watered, log.date, map.new_id, log.createdAt
      FROM WeightLog log
      JOIN plant_id_map map ON map.old_id = log.plantId
    `);
    await transaction.$executeRawUnsafe("DROP TABLE WeightLog");
    await transaction.$executeRawUnsafe("DROP TABLE Plant");
    await transaction.$executeRawUnsafe("ALTER TABLE Plant_new RENAME TO Plant");
    await transaction.$executeRawUnsafe("ALTER TABLE WeightLog_new RENAME TO WeightLog");
    await transaction.$executeRawUnsafe("CREATE UNIQUE INDEX Plant_sourceRow_key ON Plant(sourceRow)");
    await transaction.$executeRawUnsafe("CREATE UNIQUE INDEX WeightLog_plantId_date_key ON WeightLog(plantId, date)");
    await transaction.$executeRawUnsafe("CREATE INDEX WeightLog_date_idx ON WeightLog(date)");
    await transaction.$executeRawUnsafe("DROP TABLE plant_id_map");
  });

  console.log("Migrated plant IDs to consecutive integers starting at 0.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
