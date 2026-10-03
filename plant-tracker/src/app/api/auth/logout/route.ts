import { adminCookieName } from "@/lib/admin-auth"

export async function POST() {
  const response = Response.json({ authenticated: false })
  response.headers.append("Set-Cookie", `${adminCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`)
  return response
}
