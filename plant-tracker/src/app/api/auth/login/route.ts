import { adminCookieName, adminPasswordMatches, adminSessionToken } from "@/lib/admin-auth"
import { clientAddress, clearFailedLogins, loginBlockFor, recordFailedLogin } from "@/lib/login-rate-limit"

export async function POST(request: Request) {
  const address = clientAddress(request)
  const blockedFor = loginBlockFor(address)
  if (blockedFor) {
    return Response.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(blockedFor) } },
    )
  }

  const body = await request.json().catch(() => null)
  if (!adminPasswordMatches(body?.password)) {
    const lockoutFor = recordFailedLogin(address)
    if (lockoutFor) {
      return Response.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(lockoutFor) } },
      )
    }
    return Response.json({ error: "Incorrect password." }, { status: 401 })
  }

  clearFailedLogins(address)
  const response = Response.json({ authenticated: true })
  response.headers.append("Set-Cookie", `${adminCookieName}=${adminSessionToken(body.password)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`)
  return response
}
