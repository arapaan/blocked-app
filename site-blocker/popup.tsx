import { useEffect, useState } from "react"
import { DEFAULT_SETTINGS, normalizeSite, sanitizeProgress, sanitizeSettings, scheduleIsActive, STORAGE_KEY } from "./state"
import type { ExtensionState, Schedule, Settings } from "./state"

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const APP_URL = `http://localhost:3000/settings?extensionId=${chrome.runtime.id}`

function popupState(value: Partial<ExtensionState> | undefined): ExtensionState {
  const settings = sanitizeSettings(value)
  const openUntil = typeof value?.openUntil === "number" && value.openUntil > Date.now() ? value.openUntil : null
  return { ...settings, openUntil, active: settings.enabled && scheduleIsActive(settings.schedule) && openUntil === null, progress: sanitizeProgress(value?.progress) }
}

function IndexPopup() {
  const [state, setState] = useState<ExtensionState>({ ...DEFAULT_SETTINGS, openUntil: null, active: false, progress: null })
  const [siteInput, setSiteInput] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const stored = result[STORAGE_KEY] as Partial<ExtensionState> | undefined
      setState(popupState(stored))
    })
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return
      const stored = changes[STORAGE_KEY].newValue as Partial<ExtensionState> | undefined
      setState(popupState(stored))
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const save = async (settings: Settings) => {
    const value = { ...settings, openUntil: state.openUntil, progress: state.progress }
    await chrome.storage.local.set({ [STORAGE_KEY]: value })
    setState(popupState({ ...state, ...settings }))
  }

  const updateSchedule = (schedule: Schedule) => void save({ ...state, schedule })

  const addSite = async (event: React.FormEvent) => {
    event.preventDefault()
    const site = normalizeSite(siteInput)
    if (!site) {
      setError("Masukkan domain yang valid, misalnya youtube.com.")
      return
    }
    if (state.sites.includes(site)) {
      setError("Domain sudah ada di daftar.")
      return
    }
    await save({ ...state, sites: [...state.sites, site] })
    setSiteInput("")
    setError("")
  }

  const setDay = (day: number) => {
    const days = state.schedule.days.includes(day)
      ? state.schedule.days.filter((item) => item !== day)
      : [...state.schedule.days, day].sort()
    updateSchedule({ ...state.schedule, days })
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Site Blocker</h1>
          <p style={styles.muted}>{state.active ? "Pemblokiran sedang aktif" : "Pemblokiran sedang nonaktif"}</p>
        </div>
        <button style={state.enabled ? styles.toggleOn : styles.toggleOff} onClick={() => void save({ ...state, enabled: !state.enabled })}>
          {state.enabled ? "Aktif" : "Mati"}
        </button>
      </header>

      <section style={styles.section}>
        <div style={styles.row}>
          <h2 style={styles.heading}>Situs diblokir</h2>
          <span style={styles.muted}>{state.sites.length}</span>
        </div>
        <form onSubmit={addSite} style={styles.form}>
          <input aria-label="Domain situs" placeholder="contoh.com" value={siteInput} onChange={(event) => setSiteInput(event.target.value)} style={styles.input} />
          <button type="submit" style={styles.addButton}>Tambah</button>
        </form>
        {error && <p style={styles.error}>{error}</p>}
        {state.sites.length === 0 ? <p style={styles.muted}>Belum ada domain.</p> : (
          <ul style={styles.list}>
            {state.sites.map((site) => (
              <li key={site} style={styles.siteRow}>
                <span>{site}</span>
                <button aria-label={`Hapus ${site}`} onClick={() => void save({ ...state, sites: state.sites.filter((item) => item !== site) })} style={styles.removeButton}>Hapus</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.section}>
        <label style={styles.row}>
          <span style={styles.heading}>Jadwal blokir</span>
          <input type="checkbox" checked={state.schedule.enabled} onChange={(event) => updateSchedule({ ...state.schedule, enabled: event.target.checked })} />
        </label>
        {state.schedule.enabled && <>
          <div style={styles.timeRow}>
            <label>Mulai <input type="time" value={state.schedule.start} onChange={(event) => updateSchedule({ ...state.schedule, start: event.target.value })} style={styles.timeInput} /></label>
            <label>Selesai <input type="time" value={state.schedule.end} onChange={(event) => updateSchedule({ ...state.schedule, end: event.target.value })} style={styles.timeInput} /></label>
          </div>
          <div style={styles.days} aria-label="Hari aktif">
            {DAYS.map((label, day) => <button type="button" key={label} onClick={() => setDay(day)} style={state.schedule.days.includes(day) ? styles.daySelected : styles.day}>{label}</button>)}
          </div>
          <p style={styles.muted}>Jika jam selesai melewati tengah malam, jadwal berlanjut ke hari berikutnya.</p>
        </>}
      </section>

      <section style={styles.footer}>
        <p style={styles.muted}>{state.openUntil ? `Terbuka sampai ${new Date(state.openUntil).toLocaleString()}` : "Akses harian dibuka setelah target olahraga tercapai."}</p>
        <button style={styles.appButton} onClick={() => void chrome.tabs.create({ url: APP_URL })}>Buka aplikasi olahraga</button>
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { boxSizing: "border-box", width: 360, padding: 18, color: "#18212f", fontFamily: "Inter, system-ui, sans-serif", fontSize: 13 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid #e5e9ef" },
  title: { margin: 0, fontSize: 19 },
  heading: { margin: 0, fontSize: 14, fontWeight: 650 },
  muted: { margin: "5px 0 0", color: "#687386", fontSize: 12 },
  section: { padding: "14px 0", borderBottom: "1px solid #e5e9ef" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  toggleOn: { border: 0, borderRadius: 16, padding: "7px 13px", color: "white", background: "#157347", cursor: "pointer" },
  toggleOff: { border: 0, borderRadius: 16, padding: "7px 13px", color: "#394150", background: "#e8ebf0", cursor: "pointer" },
  form: { display: "flex", gap: 7, marginTop: 10 },
  input: { flex: 1, minWidth: 0, border: "1px solid #cdd4df", borderRadius: 7, padding: "8px 9px" },
  addButton: { border: 0, borderRadius: 7, padding: "8px 12px", color: "white", background: "#315ee7", cursor: "pointer" },
  error: { margin: "6px 0 0", color: "#b42318" },
  list: { listStyle: "none", margin: "10px 0 0", padding: 0, maxHeight: 125, overflowY: "auto" },
  siteRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid #f0f2f5" },
  removeButton: { border: 0, color: "#b42318", background: "transparent", cursor: "pointer" },
  timeRow: { display: "flex", gap: 14, marginTop: 12 },
  timeInput: { display: "block", marginTop: 4, border: "1px solid #cdd4df", borderRadius: 6, padding: 5 },
  days: { display: "flex", justifyContent: "space-between", marginTop: 11 },
  day: { border: "1px solid #d6dbe4", borderRadius: 14, padding: "5px 7px", background: "white", cursor: "pointer" },
  daySelected: { border: "1px solid #315ee7", borderRadius: 14, padding: "5px 7px", color: "white", background: "#315ee7", cursor: "pointer" },
  footer: { paddingTop: 13 },
  appButton: { width: "100%", marginTop: 8, border: 0, borderRadius: 7, padding: 10, color: "white", background: "#18212f", cursor: "pointer" }
}

export default IndexPopup
