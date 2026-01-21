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

export class AuthRequiredError extends Error {
  override name = "AuthRequiredError"
}

type LoginOptions = {
  /**
   * GIS prompt behavior:
   * - "select_account" (default): lets the user pick an account; consent appears if needed
   * - "consent": forces the consent screen
   * - "": default behavior (may show UI the first time if needed)
   * - "none": silent request (no UI). Fails if user interaction is required.
   */
  prompt?: "" | "none" | "consent" | "select_account"
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
let bootstrapPromise: Promise<void> | null = null
let tokenRequestPromise: Promise<AuthSession> | null = null
let idClientInitialized = false

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

function isInteractionRequiredErrorCode(code: string | undefined): boolean {
  if (!code) return false
  return (
    code === "interaction_required" ||
    code === "login_required" ||
    code === "consent_required" ||
    code === "invalid_grant" ||
    code === "access_denied"
  )
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = normalized.length % 4
  const padded = padLength ? normalized + "=".repeat(4 - padLength) : normalized
  return atob(padded)
}

function decodeGoogleIdTokenProfile(credential: string): GoogleUserProfile | null {
  try {
    const parts = credential.split(".")
    if (parts.length < 2) return null
    const payloadJson = decodeBase64Url(parts[1]!)
    const payload = JSON.parse(payloadJson) as {
      email?: string
      name?: string
      picture?: string
    }
    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    }
  } catch {
    return null
  }
}

async function ensureGoogleIdentityReady(timeoutMs = 10_000): Promise<void> {
  if (!process.client) throw new Error("Google Identity can only run in the browser.")
  if (window.google?.accounts?.oauth2?.initTokenClient && window.google?.accounts?.id?.initialize) return

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
        if (window.google?.accounts?.oauth2?.initTokenClient && window.google?.accounts?.id?.initialize) {
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
  const profile = useState<GoogleUserProfile | null>("auth.profile", () => null)
  const needsUserInteraction = useState<boolean>("auth.needsUserInteraction", () => false)

  const user = computed(() => profile.value ?? session.value?.user ?? null)
  const accessToken = computed(() => session.value?.accessToken ?? null)

  // "Authenticated" means we currently hold an access token (it may still need silent refresh).
  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))

  function isSessionFresh(value: AuthSession | null): boolean {
    if (!value?.accessToken) return false
    return value.expiresAt > Date.now() + EXPIRY_SKEW_MS
  }

  function persist(next: AuthSession | null) {
    const storage = getSessionStorage()
    if (!storage) return

    if (!next) {
      storage.removeItem(STORAGE_KEY)
      return
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function setSession(next: AuthSession | null) {
    session.value = next
    if (next?.user) profile.value = next.user
    if (!next) needsUserInteraction.value = false
    persist(next)
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

    session.value = parsed
    profile.value = parsed.user ?? null
  }

  async function requestAccessToken(options: { prompt: LoginOptions["prompt"]; hint?: string }): Promise<AuthSession> {
    hydrateFromStorage()

    const config = useRuntimeConfig()
    const clientId = config.public.googleClientId
    if (!clientId) {
      throw new Error("Missing Google Client ID. Set NUXT_PUBLIC_GOOGLE_CLIENT_ID.")
    }

    await ensureGoogleIdentityReady()

    const scope = GOOGLE_OAUTH_SCOPES
    const prompt = options.prompt ?? "select_account"

    if (tokenRequestPromise) return tokenRequestPromise

    tokenRequestPromise = new Promise<AuthSession>((resolve, reject) => {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: clientId,
        scope,
        callback: (response) => {
          if (response.error) {
            tokenRequestPromise = null
            const err = new Error(response.error_description || response.error)
            ;(err as Error & { code?: string }).code = response.error
            reject(err)
            return
          }

          if (!response.access_token || !response.expires_in) {
            tokenRequestPromise = null
            reject(new Error("Google did not return an access token."))
            return
          }

          const now = Date.now()
          const nextSession: AuthSession = {
            accessToken: response.access_token,
            tokenType: response.token_type ?? "Bearer",
            scope: response.scope ?? scope,
            createdAt: now,
            expiresAt: now + response.expires_in * 1000,
            user: user.value ?? undefined,
          }

          tokenRequestPromise = null
          resolve(nextSession)
        },
      })

      tokenClient.requestAccessToken({
        prompt,
        hint: options.hint,
      })
    })

    return tokenRequestPromise
  }

  async function loginWithGoogle(options: LoginOptions = {}) {
    hydrateFromStorage()
    needsUserInteraction.value = false

    const hint = user.value?.email
    const nextSession = await requestAccessToken({ prompt: options.prompt ?? "select_account", hint })
    setSession(nextSession)

    // If we don't have user info yet, fetch it via OpenID Connect userinfo.
    if (!user.value) {
      try {
        const nextProfile = await fetchUserProfile(nextSession.accessToken)
        setSession({ ...nextSession, user: nextProfile })
      } catch {
        // Profile is optional; token is enough for Google APIs.
      }
    }

    return session.value
  }

  async function trySilentLogin(): Promise<AuthSession | null> {
    hydrateFromStorage()

    const current = session.value
    if (isSessionFresh(current)) return current

    try {
      const hint = user.value?.email
      const next = await requestAccessToken({ prompt: "none", hint })
      setSession(next)
      return next
    } catch (error) {
      const code = (error as Error & { code?: string } | null)?.code
      // If GIS indicates interaction is required, we should prompt the user to login again.
      // We also mark this state to help the UI display the right CTA.
      if (isInteractionRequiredErrorCode(code)) {
        needsUserInteraction.value = true
      }
      // Do not keep an expired/invalid access token around.
      session.value = null
      persist(null)
      return null
    }
  }

  async function getValidAccessToken(): Promise<string> {
    hydrateFromStorage()

    const current = session.value
    if (isSessionFresh(current)) return current!.accessToken

    const refreshed = await trySilentLogin()
    if (refreshed?.accessToken) return refreshed.accessToken

    throw new AuthRequiredError("Google authentication is required.")
  }

  async function bootstrap(): Promise<void> {
    if (!process.client) return
    if (bootstrapPromise) return bootstrapPromise

    bootstrapPromise = (async () => {
      hydrateFromStorage()
      const config = useRuntimeConfig()
      if (!config.public.googleClientId) return

      try {
        await ensureGoogleIdentityReady()
      } catch {
        return
      }

      // If we don't have a fresh token, attempt a silent request.
      if (!isSessionFresh(session.value)) {
        await trySilentLogin()
      }
    })()

    return bootstrapPromise
  }

  async function initializeGoogleSignIn() {
    if (!process.client) return

    const config = useRuntimeConfig()
    const clientId = config.public.googleClientId
    if (!clientId) return

    await ensureGoogleIdentityReady()
    if (idClientInitialized) return
    idClientInitialized = true

    window.google!.accounts!.id!.initialize({
      client_id: clientId,
      callback: (response) => {
        const nextProfile = decodeGoogleIdTokenProfile(response.credential)
        if (nextProfile) profile.value = nextProfile

        // Best-effort: after a successful One Tap / button sign-in, try to silently
        // obtain (or refresh) the access token for Sheets/Drive.
        void trySilentLogin()
      },
      auto_select: true,
      cancel_on_tap_outside: false,
    })
  }

  async function renderGoogleSignInButton(container: HTMLElement, options: GoogleIdButtonConfig = {}) {
    await initializeGoogleSignIn()
    container.innerHTML = ""
    window.google!.accounts!.id!.renderButton(container, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      width: 320,
      ...options,
    })
  }

  async function promptOneTap() {
    await initializeGoogleSignIn()
    window.google!.accounts!.id!.prompt(() => {})
  }

  async function logout(options: LogoutOptions = {}) {
    const token = session.value?.accessToken
    setSession(null)
    profile.value = null

    if (!options.revoke || !token || !process.client) return

    try {
      await ensureGoogleIdentityReady()
      window.google?.accounts?.oauth2?.revoke?.(token, () => {})
      window.google?.accounts?.id?.disableAutoSelect?.()
    } catch {
      // best effort
    }
  }

  return {
    session: readonly(session),
    hydrated: readonly(hydrated),
    needsUserInteraction: readonly(needsUserInteraction),
    user,
    accessToken,
    isAuthenticated,
    hydrateFromStorage,
    bootstrap,
    loginWithGoogle,
    trySilentLogin,
    getValidAccessToken,
    renderGoogleSignInButton,
    promptOneTap,
    logout,
    scopes: GOOGLE_OAUTH_SCOPES,
  }
}

