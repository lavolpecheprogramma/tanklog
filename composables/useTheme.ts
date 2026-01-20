import { computed, readonly, watch } from "vue"

export type ThemeMode = "light" | "dark"

const THEME_STORAGE_KEY = "tanklog.theme.v1"

function getLocalStorage(): Storage | null {
  if (!import.meta.client) return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeStoredMode(value: string | null): ThemeMode | null {
  if (value === "light" || value === "dark") return value
  return null
}

function getSystemPreferredMode(): ThemeMode {
  if (!import.meta.client) return "dark"
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light"
  } catch {
    return "dark"
  }
}

function applyModeToDocument(mode: ThemeMode) {
  if (!import.meta.client) return
  document.documentElement.classList.toggle("dark", mode === "dark")
  document.documentElement.style.colorScheme = mode
}

export function useTheme() {
  const mode = useState<ThemeMode>("theme.mode", () => "dark")
  const initialized = useState<boolean>("theme.initialized", () => false)

  function setMode(value: ThemeMode) {
    mode.value = value
  }

  function toggle() {
    setMode(mode.value === "dark" ? "light" : "dark")
  }

  function init() {
    if (!import.meta.client) return
    if (initialized.value) return
    initialized.value = true

    const storage = getLocalStorage()
    const stored = normalizeStoredMode(storage?.getItem(THEME_STORAGE_KEY) ?? null)
    mode.value = stored ?? getSystemPreferredMode()

    applyModeToDocument(mode.value)

    watch(mode, (next) => {
      applyModeToDocument(next)
      storage?.setItem(THEME_STORAGE_KEY, next)
    })
  }

  return {
    mode: readonly(mode),
    isDark: computed(() => mode.value === "dark"),
    setMode,
    toggle,
    init,
  }
}

