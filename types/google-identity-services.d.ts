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

  type GoogleIdentityTokenRequestOptions = {
    /**
     * GIS prompt behavior:
     * - "none": silent request (no UI). Fails if interaction is required.
     * - "": default behavior (may show UI the first time if needed)
     * - "consent": force consent UI
     * - "select_account": force account chooser UI
     */
    prompt?: "" | "none" | "consent" | "select_account"
    /**
     * Optional account hint (typically the user's email) to reduce account chooser prompts.
     * See GIS docs for details.
     */
    hint?: string
  }

  type GoogleIdentityTokenClient = {
    requestAccessToken: (options?: GoogleIdentityTokenRequestOptions) => void
  }

  type GoogleIdCredentialResponse = {
    credential: string
    select_by?: string
    clientId?: string
  }

  type GoogleIdPromptMomentNotification = {
    isDisplayMoment: () => boolean
    isNotDisplayed: () => boolean
    getNotDisplayedReason: () => string
    isSkippedMoment: () => boolean
    getSkippedReason: () => string
    isDismissedMoment: () => boolean
    getDismissedReason: () => string
    getMomentType: () => string
  }

  type GoogleIdInitializeConfig = {
    client_id: string
    callback: (response: GoogleIdCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    // Keep this lightweight; add fields as needed.
  }

  type GoogleIdButtonConfig = {
    type?: "standard" | "icon"
    theme?: "outline" | "filled_blue" | "filled_black"
    size?: "large" | "medium" | "small"
    text?: "signin_with" | "continue_with" | "signup_with"
    shape?: "rectangular" | "pill" | "circle" | "square"
    logo_alignment?: "left" | "center"
    width?: number | string
    locale?: string
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
        id?: {
          initialize: (config: GoogleIdInitializeConfig) => void
          renderButton: (parent: HTMLElement, options: GoogleIdButtonConfig) => void
          prompt: (momentListener?: (notification: GoogleIdPromptMomentNotification) => void) => void
          disableAutoSelect: () => void
          cancel: () => void
        }
      }
    }
  }
}

