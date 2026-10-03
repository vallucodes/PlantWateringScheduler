type LoginAttempt = {
  failures: number
  blockedUntil: number
}

const maxFailedAttempts = 3
const lockoutDurationMs = 15 * 60 * 1000

const globalForLoginRateLimit = globalThis as typeof globalThis & {
  loginAttempts?: Map<string, LoginAttempt>
}

const loginAttempts = globalForLoginRateLimit.loginAttempts ?? new Map<string, LoginAttempt>()
globalForLoginRateLimit.loginAttempts = loginAttempts

export function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

export function loginBlockFor(address: string) {
  const attempt = loginAttempts.get(address)
  if (!attempt) return null

  if (attempt.blockedUntil > 0 && attempt.blockedUntil <= Date.now()) {
    loginAttempts.delete(address)
    return null
  }

  if (attempt.blockedUntil > 0) {
    return Math.ceil((attempt.blockedUntil - Date.now()) / 1000)
  }

  return null
}

export function recordFailedLogin(address: string) {
  const current = loginAttempts.get(address)
  const failures = (current?.failures ?? 0) + 1
  const blockedUntil = failures >= maxFailedAttempts ? Date.now() + lockoutDurationMs : 0
  loginAttempts.set(address, { failures, blockedUntil })
  return blockedUntil > 0 ? Math.ceil(lockoutDurationMs / 1000) : null
}

export function clearFailedLogins(address: string) {
  loginAttempts.delete(address)
}
