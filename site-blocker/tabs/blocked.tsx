import { useEffect, useState } from "react"
import { DEFAULT_SETTINGS, sanitizeProgress, sanitizeSettings, STORAGE_KEY } from "../state"
import type { ActivityTargets, DailyProgress } from "../state"

type BlockedState = { targets: ActivityTargets; progress: DailyProgress | null }

const APP_URL = `http://localhost:3000/settings?extensionId=${chrome.runtime.id}`

function BlockedPage() {
  const [site, setSite] = useState("situs ini")
  const [activity, setActivity] = useState<BlockedState>({ targets: DEFAULT_SETTINGS.targets, progress: null })

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("site")
    const siteTimer = window.setTimeout(() => {
      if (value) setSite(value)
    }, 0)
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const stored = result[STORAGE_KEY] as Record<string, unknown> | undefined
      const settings = sanitizeSettings(stored)
      setActivity({ targets: settings.targets, progress: sanitizeProgress(stored?.progress) })
    })
    return () => window.clearTimeout(siteTimer)
  }, [])

  const progress = activity.progress
  const remainingDistance = Math.max(0, activity.targets.distanceKm - (progress?.distanceKm ?? 0))
  const remainingMinutes = Math.max(0, activity.targets.durationMinutes - (progress?.durationSeconds ?? 0) / 60)
  const remainingCalories = Math.max(0, activity.targets.caloriesKcal - (progress?.caloriesKcal ?? 0))

  return (
    <main style={styles.page}>
      <div style={{ fontSize: 44 }} aria-hidden="true">🏃</div>
      <h1 style={styles.title}>Saatnya bergerak dulu</h1>
      <p style={styles.description}><strong>{site}</strong> masuk daftar blokir. Selesaikan target olahraga harian, lalu unggah screenshot aktivitas untuk membuka semua situs sampai tengah malam.</p>
      <section style={styles.targets} aria-label="Target olahraga yang tersisa">
        <h2 style={styles.heading}>Sisa target hari ini</h2>
        <div style={styles.targetGrid}>
          <Target label="Jarak" value={`${remainingDistance.toFixed(2)} km`} />
          <Target label="Durasi" value={`${remainingMinutes.toFixed(1)} menit`} />
          <Target label="Kalori" value={`${Math.ceil(remainingCalories)} kcal`} />
        </div>
        {progress && <p style={styles.progressNote}>Progress hari ini sudah diperbarui dari aplikasi.</p>}
      </section>
      <a href={APP_URL} style={styles.button}>Buka aplikasi olahraga</a>
    </main>
  )
}

function Target({ label, value }: { label: string; value: string }) {
  return <div style={styles.target}>
    <span style={styles.targetLabel}>{label}</span>
    <strong style={styles.targetValue}>{value}</strong>
  </div>
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: "12vh auto", padding: 28, color: "#18212f", fontFamily: "system-ui, sans-serif", textAlign: "center" },
  title: { marginBottom: 8 },
  description: { color: "#5c6678", lineHeight: 1.6 },
  targets: { margin: "26px 0 18px", padding: 18, border: "1px solid #e2e7ef", borderRadius: 14, textAlign: "left" },
  heading: { margin: "0 0 14px", fontSize: 17 },
  targetGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  target: { padding: 12, borderRadius: 10, background: "#f3f6fb" },
  targetLabel: { display: "block", color: "#5c6678", fontSize: 13 },
  targetValue: { display: "block", marginTop: 5, fontSize: 18 },
  progressNote: { margin: "12px 0 0", color: "#687386", fontSize: 12 },
  button: { display: "inline-block", marginTop: 8, borderRadius: 8, padding: "11px 16px", color: "white", background: "#315ee7", textDecoration: "none" }
}

export default BlockedPage
