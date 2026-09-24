export type Schedule = {
  enabled: boolean
  start: string
  end: string
  days: number[]
}

export type Settings = {
  sites: string[]
  enabled: boolean
  schedule: Schedule
  targets: ActivityTargets
}

export type ActivityTargets = {
  distanceKm: number
  durationMinutes: number
  caloriesKcal: number
}

export type DailyProgress = {
  date: string
  distanceKm: number | null
  durationSeconds: number | null
  caloriesKcal: number | null
}

export type ExtensionState = Settings & {
  openUntil: number | null
  active: boolean
  progress: DailyProgress | null
}

export const STORAGE_KEY = "siteBlockerState"
export const RULE_ID_START = 1000
export const RULE_ID_END = RULE_ID_START + 5000

export const DEFAULT_SETTINGS: Settings = {
  sites: [],
  enabled: true,
  targets: {
    distanceKm: 3,
    durationMinutes: 30,
    caloriesKcal: 150
  },
  schedule: {
    enabled: false,
    start: "22:00",
    end: "07:00",
    days: [0, 1, 2, 3, 4, 5, 6]
  }
}

export function normalizeSite(value: string): string | null {
  const input = value.trim().toLowerCase()
  if (!input) return null

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`)
    const hostname = url.hostname.replace(/^www\./, "")
    if (hostname !== "localhost" && !hostname.includes(".")) return null
    if (hostname.length > 253 || !/^[a-z0-9.-]+$/.test(hostname)) return null
    if (hostname.split(".").some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null
    return hostname
  } catch {
    return null
  }
}

export function sanitizeSettings(value: unknown): Settings {
  const candidate = value && typeof value === "object" ? (value as Partial<Settings>) : {}
  const sites = Array.isArray(candidate.sites)
    ? [...new Set(candidate.sites.flatMap((site) => (typeof site === "string" ? [normalizeSite(site)] : [])).filter((site): site is string => site !== null))].slice(0, RULE_ID_END - RULE_ID_START)
    : DEFAULT_SETTINGS.sites
  const rawSchedule = candidate.schedule && typeof candidate.schedule === "object" ? candidate.schedule : DEFAULT_SETTINGS.schedule
  const rawTargets = candidate.targets && typeof candidate.targets === "object" ? candidate.targets : DEFAULT_SETTINGS.targets
  const days = Array.isArray(rawSchedule.days)
    ? [...new Set(rawSchedule.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : DEFAULT_SETTINGS.schedule.days

  return {
    sites,
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled,
    targets: {
      distanceKm: finiteNonNegative(rawTargets.distanceKm, DEFAULT_SETTINGS.targets.distanceKm),
      durationMinutes: finiteNonNegative(rawTargets.durationMinutes, DEFAULT_SETTINGS.targets.durationMinutes),
      caloriesKcal: finiteNonNegative(rawTargets.caloriesKcal, DEFAULT_SETTINGS.targets.caloriesKcal)
    },
    schedule: {
      enabled: typeof rawSchedule.enabled === "boolean" ? rawSchedule.enabled : DEFAULT_SETTINGS.schedule.enabled,
      start: typeof rawSchedule.start === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawSchedule.start) ? rawSchedule.start : DEFAULT_SETTINGS.schedule.start,
      end: typeof rawSchedule.end === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawSchedule.end) ? rawSchedule.end : DEFAULT_SETTINGS.schedule.end,
      days
    }
  }
}

function finiteNonNegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback
}

export function sanitizeProgress(value: unknown): DailyProgress | null {
  if (!value || typeof value !== "object") return null
  const progress = value as Partial<DailyProgress>
  if (typeof progress.date !== "string" || progress.date !== todayKey()) return null
  if (![progress.distanceKm, progress.durationSeconds, progress.caloriesKcal].every((part) => part === null || (typeof part === "number" && Number.isFinite(part) && part >= 0))) return null
  return {
    date: progress.date,
    distanceKm: progress.distanceKm ?? null,
    durationSeconds: progress.durationSeconds ?? null,
    caloriesKcal: progress.caloriesKcal ?? null
  }
}

export function scheduleIsActive(schedule: Schedule, now = new Date()): boolean {
  if (!schedule.enabled) return true
  if (schedule.days.length === 0) return false

  const [startHour, startMinute] = schedule.start.split(":").map(Number)
  const [endHour, endMinute] = schedule.end.split(":").map(Number)
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  const current = now.getHours() * 60 + now.getMinutes()
  const day = now.getDay()

  if (start === end) return schedule.days.includes(day)
  if (start < end) return schedule.days.includes(day) && current >= start && current < end
  if (current >= start) return schedule.days.includes(day)
  if (current < end) return schedule.days.includes((day + 6) % 7)
  return false
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function nextLocalMidnight(date = new Date()): number {
  const midnight = new Date(date)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime()
}
