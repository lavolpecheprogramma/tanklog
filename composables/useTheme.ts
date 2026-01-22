import { computed, readonly, watch } from "vue"
import { useLocalStorage } from "@vueuse/core"

export type ThemeMode = "light" | "dark"

const THEME_STORAGE_KEY = "tanklog.theme.v1"

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
  const initialized = useState<boolean>("theme.initialized", () => false)
  const storedMode = useLocalStorage<string | null>(THEME_STORAGE_KEY, null, { writeDefaults: false })

  const mode = computed<ThemeMode>({
    get: () => normalizeStoredMode(storedMode.value) ?? getSystemPreferredMode(),
    set: (value) => {
      storedMode.value = value
    },
  })

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

    watch(
      mode,
      (next) => {
        applyModeToDocument(next)
      },
      { immediate: true }
    )
  }

  return {
    mode: readonly(mode),
    isDark: computed(() => mode.value === "dark"),
    setMode,
    toggle,
    init,
  }
}

