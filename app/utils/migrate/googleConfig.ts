const CLIENT_ID_KEY = 'tanklog.migrate.googleClientId.v1'

export function getMigrateGoogleClientId(): string | null {
  if (!import.meta.client) return null
  return localStorage.getItem(CLIENT_ID_KEY)
}

export function setMigrateGoogleClientId(clientId: string) {
  if (!import.meta.client) return
  localStorage.setItem(CLIENT_ID_KEY, clientId.trim())
}

export function clearMigrateGoogleClientId() {
  if (!import.meta.client) return
  localStorage.removeItem(CLIENT_ID_KEY)
}
