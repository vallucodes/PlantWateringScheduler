import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const adminCookieName = "plant_tracker_admin"

function sessionToken() {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return null
  return createHmac("sha256", password).update("plant-tracker-admin-session").digest("hex")
}

function valuesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export async function isAdminAuthenticated() {
  const expectedToken = sessionToken()
  if (!expectedToken) return false

  const cookieStore = await cookies()
  const providedToken = cookieStore.get(adminCookieName)?.value
  return providedToken ? valuesMatch(providedToken, expectedToken) : false
}

export async function requireAdmin() {
  if (await isAdminAuthenticated()) return null
  return Response.json({ error: "Admin authentication required." }, { status: 401 })
}

export function adminSessionToken(password: string) {
  return createHmac("sha256", password).update("plant-tracker-admin-session").digest("hex")
}

export function adminPasswordMatches(password: unknown) {
  const configuredPassword = process.env.ADMIN_PASSWORD
  if (typeof password !== "string" || !configuredPassword) return false
  return valuesMatch(password, configuredPassword)
}
