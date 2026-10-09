export type ConfirmDialogOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'error' | 'primary' | 'neutral' | 'warning'
}

type ConfirmFn = (options: ConfirmDialogOptions) => Promise<boolean>

let hostConfirm: ConfirmFn | null = null

export function registerConfirmDialog(fn: ConfirmFn) {
  hostConfirm = fn
  return () => {
    if (hostConfirm === fn) hostConfirm = null
  }
}

export function useConfirmDialog() {
  function confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (!hostConfirm) {
      if (import.meta.dev) {
        console.warn('[useConfirmDialog] ConfirmDialogHost is not mounted')
      }
      return Promise.resolve(false)
    }
    return hostConfirm(options)
  }

  return { confirm }
}
