import { computed, readonly } from "vue"

export type GoogleUserProfile = {
  email?: string
  name?: string
  picture?: string
}

export type AuthSession = {
  accessToken: string
  tokenType: string
  scope: string
  createdAt: number
  expiresAt: number
  user?: GoogleUserProfile
}

type LoginOptions = {
  /**
   * GIS prompt behavior:
   * - "select_account" (default): lets the user pick an account; consent appears if needed
   * - "consent": forces the consent screen
   * - "": attempts a silent token request (may fail without user interaction)
   */
  prompt?: "" | "consent" | "select_account"
}

type LogoutOptions = {
  /** Best-effort token revocation via GIS. */
  revoke?: boolean
}

const STORAGE_KEY = "tanklog.auth.session.v1"
const EXPIRY_SKEW_MS = 30_000

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.file",
].join(" ")

let gsiLoadPromise: Promise<void> | null = null

function getSessionStorage(): Storage | null {
  if (!process.client) return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function isValidSession(candidate: unknown): candidate is AuthSession {
  if (!candidate || typeof candidate !== "object") return false
  const session = candidate as Record<string, unknown>

  return (
    typeof session.accessToken === "string" &&
    session.accessToken.length > 0 &&
    typeof session.tokenType === "string" &&
    typeof session.scope === "string" &&
    typeof session.createdAt === "number" &&
    Number.isFinite(session.createdAt) &&
    typeof session.expiresAt === "number" &&
    Number.isFinite(session.expiresAt)
  )
}

async function ensureGoogleIdentityReady(timeoutMs = 10_000): Promise<void> {
  if (!process.client) throw new Error("Google Identity can only run in the browser.")
  if (window.google?.accounts?.oauth2?.initTokenClient) return

  if (!gsiLoadPromise) {
    gsiLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
      if (!existing) {
        const script = document.createElement("script")
        script.src = "https://accounts.google.com/gsi/client"
        script.async = true
        script.defer = true
        script.onerror = () => reject(new Error("Failed to load Google Identity Services script."))
        document.head.appendChild(script)
      }

      const startedAt = Date.now()
      const checkReady = () => {
        if (window.google?.accounts?.oauth2?.initTokenClient) {
          resolve()
          return
        }
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("Google Identity Services did not become ready in time."))
          return
        }
        window.setTimeout(checkReady, 50)
      }

      checkReady()
    })
  }

  return gsiLoadPromise
}

async function fetchUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch Google profile.")
  }

  const data = (await response.json()) as {
    email?: string
    name?: string
    picture?: string
  }

  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}

export function useAuth() {
  const session = useState<AuthSession | null>("auth.session", () => null)
  const hydrated = useState<boolean>("auth.hydrated", () => false)

  const user = computed(() => session.value?.user ?? null)
  const accessToken = computed(() => session.value?.accessToken ?? null)

  const isAuthenticated = computed(() => {
    const value = session.value
    if (!value) return false
    if (!value.accessToken) return false
    return value.expiresAt > Date.now() + EXPIRY_SKEW_MS
  })

  function persist(next: AuthSession | null) {
    const storage = getSessionStorage()
    if (!storage) return

    if (!next) {
      storage.removeItem(STORAGE_KEY)
      return
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function hydrateFromStorage() {
    if (hydrated.value) return
    hydrated.value = true

    const storage = getSessionStorage()
    if (!storage) return

    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return

    const parsed = safeJsonParse<unknown>(raw)
    if (!isValidSession(parsed)) {
      storage.removeItem(STORAGE_KEY)
      return
    }

    if (parsed.expiresAt <= Date.now() + EXPIRY_SKEW_MS) {
      storage.removeItem(STORAGE_KEY)
      return
    }

    session.value = parsed
  }

  async function loginWithGoogle(options: LoginOptions = {}) {
    hydrateFromStorage()
    if (isAuthenticated.value) return session.value

    const config = useRuntimeConfig()
    const clientId = config.public.googleClientId
    if (!clientId) {
      throw new Error("Missing Google Client ID. Set NUXT_PUBLIC_GOOGLE_CLIENT_ID.")
    }

    await ensureGoogleIdentityReady()

    const scope = GOOGLE_OAUTH_SCOPES
    const prompt = options.prompt ?? "select_account"

    const tokenResponse = await new Promise<GoogleIdentityTokenResponse>((resolve, reject) => {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: clientId,
        scope,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error))
            return
          }
          resolve(response)
        },
      })

      tokenClient.requestAccessToken({ prompt })
    })

    if (!tokenResponse.access_token || !tokenResponse.expires_in) {
      throw new Error("Google did not return an access token.")
    }

    const now = Date.now()
    const nextSession: AuthSession = {
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type ?? "Bearer",
      scope: tokenResponse.scope ?? scope,
      createdAt: now,
      expiresAt: now + tokenResponse.expires_in * 1000,
    }

    session.value = nextSession
    persist(nextSession)

    try {
      const profile = await fetchUserProfile(nextSession.accessToken)
      session.value = { ...nextSession, user: profile }
      persist(session.value)
    } catch {
      // Profile is optional; token is enough for Google APIs.
    }

    return session.value
  }

  async function logout(options: LogoutOptions = {}) {
    const token = session.value?.accessToken
    session.value = null
    persist(null)

    if (!options.revoke || !token || !process.client) return

    try {
      await ensureGoogleIdentityReady()
      window.google?.accounts?.oauth2?.revoke?.(token, () => {})
    } catch {
      // best effort
    }
  }

  return {
    session: readonly(session),
    hydrated: readonly(hydrated),
    user,
    accessToken,
    isAuthenticated,
    hydrateFromStorage,
    loginWithGoogle,
    logout,
    scopes: GOOGLE_OAUTH_SCOPES,
  }
}

