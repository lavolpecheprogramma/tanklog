import type { Reminder } from '~/types/reminder'
import { toOffsetIsoString } from '~/utils/datetime'

export type ScheduleReminderResult = {
  messageId: string | null
  sendAfter: string | null
  error: string | null
}

/**
 * Best-effort OneSignal schedule/cancel for reminders.
 * Returns structured result so the UI can show schedule success/failure.
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

  async function scheduleReminder(reminder: Reminder): Promise<ScheduleReminderResult> {
    if (!canSchedule()) {
      return { messageId: null, sendAfter: null, error: null }
    }

    const dueMs = Date.parse(reminder.nextDue)
    if (!Number.isFinite(dueMs) || dueMs <= Date.now()) {
      return { messageId: null, sendAfter: null, error: null }
    }

    const externalId = auth.user.value?.id
    if (!externalId || !config.appId.value || !config.proxyUrl.value) {
      return { messageId: null, sendAfter: null, error: null }
    }

    try {
      // Ensure identity is linked before targeting by external_id
      if (oneSignal.isInitialized.value) {
        await oneSignal.login(externalId).catch(() => undefined)
      }

      const sendAfter = prefs.clampOutsideQuiet(new Date(dueMs))
      if (sendAfter.getTime() <= Date.now()) {
        return { messageId: null, sendAfter: null, error: null }
      }

      const sendAfterIso = toOffsetIsoString(sendAfter)
      const result = await api.schedulePushMessage({
        appId: config.appId.value,
        proxyUrl: config.proxyUrl.value,
        proxyKey: config.proxyKey.value,
        externalId,
        title: t('app.name'),
        body: reminder.title,
        sendAfter: sendAfterIso,
        url: reminderUrl(reminder.tankId),
        idempotencyKey: `reminder:${reminder.id}:${sendAfter.toISOString()}`
      })
      return { messageId: result.messageId, sendAfter: sendAfterIso, error: null }
    } catch (e) {
      return {
        messageId: null,
        sendAfter: null,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }

  return {
    canSchedule,
    cancelMessage,
    scheduleReminder
  }
}
