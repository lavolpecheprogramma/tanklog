export type NotificationPermissionState = NotificationPermission | 'unsupported'

export function useNotifications() {
  const permission = useState<NotificationPermissionState>('tanklog.notifications.permission', () => {
    if (!import.meta.client || typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  })

  const notifiedIds = useState<string[]>('tanklog.notifications.notifiedIds', () => [])
  const prefs = useNotificationPrefs()

  function refreshPermission() {
    if (!import.meta.client || typeof Notification === 'undefined') {
      permission.value = 'unsupported'
      return
    }
    permission.value = Notification.permission
  }

  /** Must be called from a user gesture. */
  async function requestPermission(): Promise<NotificationPermissionState> {
    if (!import.meta.client || typeof Notification === 'undefined') {
      permission.value = 'unsupported'
      return permission.value
    }

    const result = await Notification.requestPermission()
    permission.value = result
    return result
  }

  function notify(title: string, options?: NotificationOptions): boolean {
    if (!import.meta.client || typeof Notification === 'undefined') return false
    if (Notification.permission !== 'granted') return false

    if (prefs.isQuietNow()) return false

    try {
      const _notification = new Notification(title, {
        icon: '/favicon.ico',
        ...options
      })
      void _notification
      return true
    } catch {
      return false
    }
  }

  /** Best-effort: notify once per id while the app is open. */
  function notifyOnce(id: string, title: string, body?: string): boolean {
    if (notifiedIds.value.includes(id)) return false
    const ok = notify(title, body ? { body } : undefined)
    if (ok) notifiedIds.value = [...notifiedIds.value, id]
    return ok
  }

  function clearNotified(id?: string) {
    if (!id) {
      notifiedIds.value = []
      return
    }
    notifiedIds.value = notifiedIds.value.filter(item => item !== id)
  }

  return {
    permission,
    notifiedIds,
    refreshPermission,
    requestPermission,
    notify,
    notifyOnce,
    clearNotified
  }
}
