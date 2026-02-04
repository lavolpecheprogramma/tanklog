type OneSignalDeferredFunction = (OneSignal: any) => void | Promise<void>

declare global {
  interface Window {
    OneSignalDeferred?: OneSignalDeferredFunction[]
  }
}

type OneSignalStatus = "idle" | "loading" | "ready" | "error"

const ONESIGNAL_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"

let sdkLoadPromise: Promise<void> | null = null
let initPromise: Promise<void> | null = null
let listenersBound = false

function normalizeBaseUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return "/"
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
}

function joinBase(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl)
  const suffix = path.startsWith("/") ? path.slice(1) : path
  return `${base}${suffix}`.replace(/\/{2,}/g, "/")
}

function ensureDeferredArray() {
  if (!import.meta.client) return
  window.OneSignalDeferred = window.OneSignalDeferred || []
}

function ensureSdkLoaded(timeoutMs = 15_000): Promise<void> {
  if (!import.meta.client) return Promise.resolve()
  ensureDeferredArray()

  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ONESIGNAL_SDK_URL}"]`)
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === "true") {
        resolve()
        return
      }

      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load OneSignal SDK.")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = ONESIGNAL_SDK_URL
    script.defer = true
    script.dataset.loaded = "false"
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true"
        resolve()
      },
      { once: true }
    )
    script.addEventListener("error", () => reject(new Error("Failed to load OneSignal SDK.")), { once: true })
    document.head.appendChild(script)

    // Safety timeout: if load never resolves, surface an error.
    window.setTimeout(() => {
      if (script.dataset.loaded === "true") return
      reject(new Error("OneSignal SDK did not load in time."))
    }, timeoutMs)
  })

  return sdkLoadPromise
}

async function runDeferred<T>(handler: (OneSignal: any) => Promise<T> | T): Promise<T> {
  if (!import.meta.client) throw new Error("OneSignal is only available in the browser.")
  ensureDeferredArray()
  await ensureSdkLoaded()

  return new Promise<T>((resolve, reject) => {
    window.OneSignalDeferred!.push(async (OneSignal: any) => {
      try {
        resolve(await handler(OneSignal))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function isLocalhostHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return normalized === "localhost" || normalized === "127.0.0.1"
}

export function useOneSignal() {
  const runtimeConfig = useRuntimeConfig()

  const status = useState<OneSignalStatus>("onesignal.status", () => "idle")
  const error = useState<string | null>("onesignal.error", () => null)

  const isInitialized = useState<boolean>("onesignal.initialized", () => false)
  const isSupported = useState<boolean | null>("onesignal.pushSupported", () => null)
  const hasPermission = useState<boolean | null>("onesignal.permission", () => null)
  const isOptedIn = useState<boolean | null>("onesignal.optedIn", () => null)
  const subscriptionId = useState<string | null>("onesignal.subscriptionId", () => null)

  const oneSignalId = useState<string | null>("onesignal.onesignalId", () => null)
  const externalId = useState<string | null>("onesignal.externalId", () => null)

  function resetError() {
    error.value = null
  }

  function getWorkerConfig() {
    const baseURL = normalizeBaseUrl(runtimeConfig.app?.baseURL)
    const serviceWorkerAbsolutePath = joinBase(baseURL, "push/onesignal/OneSignalSDKWorker.js")

    // OneSignal’s Web SDK expects `serviceWorkerPath` without a leading slash and will
    // typically prefix it internally. If we pass an absolute path (e.g. "/push/..."),
    // some SDK versions may accidentally create "//push/..." which becomes "https://push/..."
    // (cross-origin) and fails registration.
    const serviceWorkerPath = serviceWorkerAbsolutePath.replace(/^\/+/, "")

    return {
      serviceWorkerPath,
      serviceWorkerScope: joinBase(baseURL, "push/onesignal/"),
      serviceWorkerAbsolutePath,
      baseURL,
    }
  }

  async function refreshState() {
    if (!import.meta.client) return
    if (!isInitialized.value) return

    try {
      await runDeferred(async (OneSignal) => {
        try {
          isSupported.value = Boolean(OneSignal.Notifications?.isPushSupported?.())
        } catch {
          isSupported.value = null
        }

        try {
          hasPermission.value = Boolean(OneSignal.Notifications?.permission)
        } catch {
          hasPermission.value = null
        }

        try {
          isOptedIn.value = typeof OneSignal.User?.PushSubscription?.optedIn === "boolean" ? OneSignal.User.PushSubscription.optedIn : null
        } catch {
          isOptedIn.value = null
        }

        try {
          subscriptionId.value = OneSignal.User?.PushSubscription?.id ?? null
        } catch {
          subscriptionId.value = null
        }

        try {
          oneSignalId.value = OneSignal.User?.onesignalId ?? null
        } catch {
          oneSignalId.value = null
        }

        try {
          externalId.value = OneSignal.User?.externalId ?? null
        } catch {
          externalId.value = null
        }
      })
    } catch (err) {
      // Non-fatal: state refresh may fail if OneSignal isn't ready yet.
      error.value = err instanceof Error ? err.message : "Failed to read OneSignal state."
    }
  }

  async function init(options: { appId: string }) {
    if (!import.meta.client) return
    resetError()

    const appId = options.appId.trim()
    if (!appId) throw new Error("Missing OneSignal App ID.")

    if (initPromise) return initPromise

    status.value = "loading"
    initPromise = (async () => {
      const { serviceWorkerPath, serviceWorkerScope } = getWorkerConfig()

      await runDeferred(async (OneSignal) => {
        await OneSignal.init({
          appId,
          // Avoid conflicts with TankLog's PWA service worker by keeping a dedicated scope.
          serviceWorkerPath,
          serviceWorkerParam: { scope: serviceWorkerScope },
          // Localhost support for development environments.
          allowLocalhostAsSecureOrigin: isLocalhostHost(window.location.hostname),
        })
      })

      isInitialized.value = true
      status.value = "ready"

      await bindListeners()
      await refreshState()
    })()

    try {
      await initPromise
    } catch (err) {
      initPromise = null
      isInitialized.value = false
      status.value = "error"
      error.value = err instanceof Error ? err.message : "Failed to initialize OneSignal."
      throw err
    }
  }

  async function bindListeners() {
    if (!import.meta.client) return
    if (!isInitialized.value) return
    if (listenersBound) return
    listenersBound = true

    await runDeferred((OneSignal) => {
      try {
        OneSignal.Notifications?.addEventListener?.("permissionChange", (permission: boolean) => {
          hasPermission.value = Boolean(permission)
          void refreshState()
        })
      } catch {
        // ignore
      }

      try {
        OneSignal.User?.PushSubscription?.addEventListener?.("change", (event: any) => {
          subscriptionId.value = event?.current?.id ?? subscriptionId.value
          isOptedIn.value = typeof event?.current?.optedIn === "boolean" ? event.current.optedIn : isOptedIn.value
          void refreshState()
        })
      } catch {
        // ignore
      }

      try {
        OneSignal.User?.addEventListener?.("change", () => {
          void refreshState()
        })
      } catch {
        // ignore
      }
    })
  }

  async function requestPermission() {
    if (!import.meta.client) return
    resetError()
    if (!isInitialized.value) throw new Error("OneSignal is not initialized.")

    await runDeferred(async (OneSignal) => {
      await OneSignal.Notifications.requestPermission()
    })

    await refreshState()
  }

  async function optIn() {
    if (!import.meta.client) return
    resetError()
    if (!isInitialized.value) throw new Error("OneSignal is not initialized.")

    await runDeferred(async (OneSignal) => {
      await OneSignal.User.PushSubscription.optIn()
    })

    await refreshState()
  }

  async function optOut() {
    if (!import.meta.client) return
    resetError()
    if (!isInitialized.value) throw new Error("OneSignal is not initialized.")

    await runDeferred(async (OneSignal) => {
      await OneSignal.User.PushSubscription.optOut()
    })

    await refreshState()
  }

  async function login(nextExternalId: string) {
    if (!import.meta.client) return
    resetError()
    if (!isInitialized.value) throw new Error("OneSignal is not initialized.")
    const normalized = nextExternalId.trim()
    if (!normalized) throw new Error("Missing external id.")

    await runDeferred(async (OneSignal) => {
      await OneSignal.login(normalized)
    })
    await refreshState()
  }

  async function logout() {
    if (!import.meta.client) return
    resetError()
    if (!isInitialized.value) return

    await runDeferred(async (OneSignal) => {
      await OneSignal.logout()
    })
    await refreshState()
  }

  async function setLanguage(language: string) {
    if (!import.meta.client) return
    if (!isInitialized.value) return
    const normalized = language.trim()
    if (!normalized) return

    await runDeferred(async (OneSignal) => {
      await OneSignal.User.setLanguage(normalized)
    })
  }

  return {
    status: readonly(status),
    error: readonly(error),
    isInitialized: readonly(isInitialized),
    isSupported: readonly(isSupported),
    hasPermission: readonly(hasPermission),
    isOptedIn: readonly(isOptedIn),
    subscriptionId: readonly(subscriptionId),
    oneSignalId: readonly(oneSignalId),
    externalId: readonly(externalId),
    getWorkerConfig,
    init,
    refreshState,
    requestPermission,
    optIn,
    optOut,
    login,
    logout,
    setLanguage,
  }
}

