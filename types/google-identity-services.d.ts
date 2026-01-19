export {}

declare global {
  type GoogleIdentityTokenResponse = {
    access_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
    error?: string
    error_description?: string
  }

  type GoogleIdentityTokenClient = {
    requestAccessToken: (options?: { prompt?: string }) => void
  }

  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleIdentityTokenResponse) => void
          }) => GoogleIdentityTokenClient
          revoke?: (accessToken: string, done: () => void) => void
        }
      }
    }
  }
}

