"use server"

import { prisma } from "@/lib/prisma"

export async function setSeasonSetting(season: "summer" | "winter") {
  await prisma.appSetting.upsert({
    where: { key: "season" },
    update: { value: season },
    create: { key: "season", value: season },
  })
}
