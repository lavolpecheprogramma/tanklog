const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const MIGRATE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
].join(' ')

let scriptPromise: Promise<void> | null = null

export async function loadGoogleIdentityServices(): Promise<void> {
  if (!import.meta.client) throw new Error('Google Identity is client-only')
  if (window.google?.accounts?.oauth2) return

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-tanklog-gis="1"]')
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')))
        return
      }
      const script = document.createElement('script')
      script.src = GIS_SCRIPT
      script.async = true
      script.defer = true
      script.dataset.tanklogGis = '1'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
      document.head.appendChild(script)
    })
  }

  await scriptPromise
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services unavailable')
  }
}

export async function requestMigrateAccessToken(clientId: string): Promise<string> {
  await loadGoogleIdentityServices()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services unavailable')

  return await new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: MIGRATE_SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google auth failed'))
          return
        }
        resolve(response.access_token)
      }
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

export function revokeMigrateAccessToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    const revoke = window.google?.accounts?.oauth2?.revoke
    if (!revoke || !accessToken) {
      resolve()
      return
    }
    revoke(accessToken, () => resolve())
  })
}
