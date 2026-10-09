import type { Reminder } from '~/types/reminder'

/**
 * Best-effort OneSignal schedule/cancel for reminders.
 * Never throws to callers — returns null / false on failure.
 */
export function useReminderPush() {
  const config = useOneSignalConfig()
  const oneSignal = useOneSignal()
  const api = useOneSignalApi()
  const auth = useAuth()
  const prefs = useNotificationPrefs()
  const { t } = useI18n()
  const runtimeConfig = useRuntimeConfig()

  function canSchedule(): boolean {
    if (!import.meta.client) return false
    if (!config.canSchedule.value) return false
    if (!auth.user.value?.id) return false
    return true
  }

  function reminderUrl(tankId: string): string {
    const base = runtimeConfig.app.baseURL || '/'
    const path = `${base}dashboard/tank/${tankId}/reminders`.replace(/\/{2,}/g, '/')
    return new URL(path, window.location.origin).toString()
  }

  async function cancelMessage(messageId: string | null | undefined): Promise<void> {
    if (!messageId?.trim()) return
    if (!config.appId.value || !config.proxyUrl.value) return
    try {
      await api.cancelPushMessage({
        appId: config.appId.value,
        proxyUrl: config.proxyUrl.value,
        proxyKey: config.proxyKey.value,
        messageId: messageId.trim()
      })
    } catch {
      // best effort
    }
  }

  async function scheduleReminder(reminder: Reminder): Promise<string | null> {
    if (!canSchedule()) return null

    const dueMs = Date.parse(reminder.nextDue)
    if (!Number.isFinite(dueMs) || dueMs <= Date.now()) return null

    const externalId = auth.user.value?.id
    if (!externalId || !config.appId.value || !config.proxyUrl.value) return null

    try {
      // Ensure identity is linked before targeting by external_id
      if (oneSignal.isInitialized.value) {
        await oneSignal.login(externalId).catch(() => undefined)
      }

      const sendAfter = prefs.clampOutsideQuiet(new Date(dueMs))
      if (sendAfter.getTime() <= Date.now()) return null

      const result = await api.schedulePushMessage({
        appId: config.appId.value,
        proxyUrl: config.proxyUrl.value,
        proxyKey: config.proxyKey.value,
        externalId,
        title: t('app.name'),
        body: reminder.title,
        sendAfter: sendAfter.toISOString(),
        url: reminderUrl(reminder.tankId),
        idempotencyKey: `reminder:${reminder.id}:${sendAfter.toISOString()}`
      })
      return result.messageId
    } catch {
      return null
    }
  }

  return {
    canSchedule,
    cancelMessage,
    scheduleReminder
  }
}
