import {
  DEFAULT_SETTINGS,
  RULE_ID_END,
  RULE_ID_START,
  sanitizeProgress,
  sanitizeSettings,
  scheduleIsActive,
  STORAGE_KEY,
  todayKey,
  nextLocalMidnight
} from "./state"
import type { ExtensionState } from "./state"

const REFRESH_ALARM = "site-blocker-refresh"

type StoredState = {
  sites?: unknown
  enabled?: unknown
  schedule?: unknown
  openUntil?: unknown
  progress?: unknown
}

async function readState(): Promise<ExtensionState> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as StoredState | undefined
  const settings = sanitizeSettings(stored ?? DEFAULT_SETTINGS)
  const openUntil = typeof stored?.openUntil === "number" && stored.openUntil > Date.now() ? stored.openUntil : null
  return {
    ...settings,
    openUntil,
    active: settings.enabled && scheduleIsActive(settings.schedule) && openUntil === null,
    progress: sanitizeProgress(stored?.progress)
  }
}

async function syncRules(): Promise<ExtensionState> {
  const state = await readState()
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules()
  const managedIds = currentRules.filter((rule) => rule.id >= RULE_ID_START && rule.id < RULE_ID_END).map((rule) => rule.id)
  const addRules: chrome.declarativeNetRequest.Rule[] = state.active
    ? state.sites.map((site, index) => ({
        id: RULE_ID_START + index,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: { extensionPath: `/tabs/blocked.html?site=${encodeURIComponent(site)}` }
        },
        condition: {
          requestDomains: [site],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
        }
      }))
    : []

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: managedIds, addRules })
  if (state.openUntil) {
    chrome.alarms.create(REFRESH_ALARM, { when: Math.min(state.openUntil, Date.now() + 60_000) })
  } else {
    chrome.alarms.create(REFRESH_ALARM, { when: Date.now() + 60_000 })
  }
  return state
}

async function persistSettings(input: unknown): Promise<ExtensionState> {
  const settings = sanitizeSettings(input)
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as StoredState | undefined
  const openUntil = typeof stored?.openUntil === "number" && stored.openUntil > Date.now() ? stored.openUntil : null
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...settings, openUntil, progress: stored?.progress ?? null } })
  return syncRules()
}

async function openToday(date: unknown): Promise<ExtensionState> {
  if (date !== todayKey()) throw new Error("Tanggal harus sama dengan hari ini di perangkat ini.")
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as StoredState | undefined
  const settings = sanitizeSettings(stored ?? DEFAULT_SETTINGS)
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...settings, openUntil: nextLocalMidnight(), progress: stored?.progress ?? null } })
  return syncRules()
}

async function saveProgress(input: unknown): Promise<ExtensionState> {
  const progress = sanitizeProgress(input)
  if (!progress) throw new Error("Progress harus berisi nilai yang valid dan tanggal hari ini.")
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as StoredState | undefined
  const settings = sanitizeSettings(stored ?? DEFAULT_SETTINGS)
  const openUntil = typeof stored?.openUntil === "number" && stored.openUntil > Date.now() ? stored.openUntil : null
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...settings, openUntil, progress } })
  return syncRules()
}

function isAllowedWebApp(urlValue?: string): boolean {
  if (!urlValue) return false
  try {
    const url = new URL(urlValue)
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)
  } catch {
    return false
  }
}

chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object") return
  const request = message as { type?: string; date?: unknown; settings?: unknown; progress?: unknown }
  if (!isAllowedWebApp(sender.url)) {
    sendResponse({ ok: false, error: "Origin tidak diizinkan." })
    return
  }

  const operation = async () => {
    if (request.type === "GET_STATE") return { ok: true, state: await syncRules() }
    if (request.type === "SET_OPEN_TODAY") return { ok: true, state: await openToday(request.date) }
    if (request.type === "UPDATE_SETTINGS") return { ok: true, state: await persistSettings(request.settings) }
    if (request.type === "SAVE_PROGRESS") return { ok: true, state: await saveProgress(request.progress) }
    return { ok: false, error: "Pesan tidak dikenal." }
  }

  operation().then(sendResponse).catch((error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." })
  })
  return true
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) void syncRules()
})

chrome.runtime.onInstalled.addListener(() => void syncRules())
chrome.runtime.onStartup.addListener(() => void syncRules())
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) void syncRules()
})
