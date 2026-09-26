const path = require("node:path");
const XLSX = require(path.join(__dirname, "..", "plant-tracker", "node_modules", "xlsx"));
const { PrismaClient } = require("@prisma/client");

const workbookPath = process.argv[2] || path.join(__dirname, "..", "Kaktukset.xlsx");
const sheetName = "Kaktukset";
const prisma = new PrismaClient();

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function parseDate(value, cellAddress) {
  if (!isNumber(value)) {
    throw new Error(`Expected an Excel date serial in ${cellAddress}`);
  }

  const parts = XLSX.SSF.parse_date_code(value);
  if (!parts || !parts.y || !parts.m || !parts.d) {
    throw new Error(`Invalid Excel date serial ${value} in ${cellAddress}`);
  }

  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
}

function parseGroup(value) {
  const label = textOrNull(value) || "unassigned";
  const intervalMatch = label.match(/^\d+$/);
  return {
    key: label,
    name: label === "unassigned" ? "Unassigned" : label,
    intervalDays: intervalMatch ? Number(label) : null,
  };
}

function isPlantRow(row) {
  const name = textOrNull(row[2]);
  return Boolean(typeof row[2] === "string" && name && name !== "seuraava" && (isNumber(row[3]) || isNumber(row[4])));
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet ${sheetName} was not found in ${workbookPath}`);

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const header = rows[0] || [];
  const dateColumns = [];
  for (let column = 8; column < header.length; column++) {
    if (isNumber(header[column])) {
      dateColumns.push({ column, date: parseDate(header[column], XLSX.utils.encode_cell({ r: 0, c: column })) });
    }
  }

  const plantRows = rows
    .map((row, index) => ({ row, sourceRow: index + 1 }))
    .filter(({ row }) => isPlantRow(row));

  let importedLogs = 0;
  const importedGroups = new Set();

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.plant.deleteMany({
        where: { sourceRow: { gt: 0, notIn: plantRows.map(({ sourceRow }) => sourceRow) } },
      });

      for (const { row, sourceRow } of plantRows) {
        const group = parseGroup(row[0]);
        const wateringGroup = await transaction.wateringGroup.upsert({
          where: { key: group.key },
          update: { name: group.name, intervalDays: group.intervalDays },
          create: group,
        });
        importedGroups.add(group.key);

        const plant = await transaction.plant.upsert({
          where: { sourceRow },
          update: {
            name: textOrNull(row[2]),
            minWeight: isNumber(row[3]) ? row[3] : null,
            maxWeight: isNumber(row[4]) ? row[4] : null,
            wateringGroupId: wateringGroup.id,
          },
          create: {
            name: textOrNull(row[2]),
            minWeight: isNumber(row[3]) ? row[3] : null,
            maxWeight: isNumber(row[4]) ? row[4] : null,
            sourceRow,
            wateringGroupId: wateringGroup.id,
          },
        });

        for (const { column, date } of dateColumns) {
          const weight = row[column];
          if (!isNumber(weight)) continue;

          await transaction.weightLog.upsert({
            where: { plantId_date: { plantId: plant.id, date } },
            update: { weight },
            create: { plantId: plant.id, date, weight },
          });
          importedLogs++;
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Imported ${plantRows.length} plants into ${importedGroups.size} watering groups.`);
  console.log(`Upserted ${importedLogs} dated weight logs.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
