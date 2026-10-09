import type { ReminderDueStatus } from '~/types/reminder'

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Classify a reminder by local calendar day relative to `now`. */
export function getReminderDueStatus(nextDueIso: string, now = new Date()): ReminderDueStatus {
  const due = new Date(nextDueIso)
  if (Number.isNaN(due.getTime())) return 'upcoming'

  const today = startOfLocalDay(now)
  const dueDay = startOfLocalDay(due)
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  return 'upcoming'
}

/** Advance `from` by `days`, skipping forward until strictly after `now` when needed. */
export function advanceNextDue(fromIso: string, days: number, now = new Date()): Date {
  const stepMs = days * 86_400_000
  let next = new Date(fromIso)
  if (Number.isNaN(next.getTime())) next = new Date(now)

  next = new Date(next.getTime() + stepMs)
  while (next.getTime() <= now.getTime()) {
    next = new Date(next.getTime() + stepMs)
  }
  return next
}

export function isPastEndDue(endDue: string | null | undefined, candidate: Date): boolean {
  if (!endDue) return false
  // end_due is a date; treat as inclusive end of that local calendar day
  const end = new Date(`${endDue}T23:59:59.999`)
  if (Number.isNaN(end.getTime())) return false
  return candidate.getTime() > end.getTime()
}
