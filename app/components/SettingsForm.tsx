"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getExtensionId, sendExtensionMessage, settingsMessage, type ExtensionState } from "../lib/extension";
import { DEFAULT_SETTINGS, readSettings, SETTINGS_KEY, type AppSettings } from "../lib/settings";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function normalizeDomain(input: string): string | null {
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || host.includes("..")) return null;
    return host;
  } catch {
    return null;
  }
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [siteInput, setSiteInput] = useState("");
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readSettings();
    const hydration = window.setTimeout(() => {
      setSettings(stored);
      setReady(true);
      if (getExtensionId()) {
        sendExtensionMessage<ExtensionState>({ type: "GET_STATE" })
          .then((state) => {
            setExtensionConnected(true);
            setSettings((current) => ({
              ...current,
              sites: state.sites,
              enabled: state.enabled,
              schedule: state.schedule,
              distanceKm: state.targets.distanceKm,
              durationMinutes: state.targets.durationMinutes,
              caloriesKcal: state.targets.caloriesKcal,
            }));
          })
          .catch(() => setExtensionConnected(false));
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatusMessage("");
  }

  function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = normalizeDomain(siteInput.trim());
    if (!domain) {
      setStatusMessage("Masukkan domain yang valid, misalnya youtube.com.");
      return;
    }
    if (settings.sites.includes(domain)) {
      setStatusMessage("Domain itu sudah ada di daftar.");
      return;
    }
    update("sites", [...settings.sites, domain]);
    setSiteInput("");
  }

  async function save() {
    const numericTargets = [settings.distanceKm, settings.durationMinutes, settings.caloriesKcal];
    if (numericTargets.some((value) => !Number.isFinite(value) || value <= 0)) {
      setStatusMessage("Semua target harus lebih besar dari nol.");
      return;
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    try {
      await sendExtensionMessage(settingsMessage(settings));
      setExtensionConnected(true);
      setStatusMessage("Pengaturan tersimpan dan tersinkron ke ekstensi.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? `${error.message} Pengaturan tersimpan di perangkat ini.` : "Pengaturan tersimpan di perangkat ini.");
    }
  }

  if (!ready) return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Memuat pengaturan…</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Target harian</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Atur bukti gerakmu</h2>
          <p className="mt-1 text-sm text-zinc-500">Ketiga target harus tercapai sebelum situs dibuka.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-zinc-700">Jarak <span className="text-zinc-400">(km)</span>
            <input type="number" min="0.1" step="0.1" required value={settings.distanceKm} onChange={(event) => update("distanceKm", Number(event.target.value))} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="text-sm font-medium text-zinc-700">Durasi <span className="text-zinc-400">(menit)</span>
            <input type="number" min="1" step="1" required value={settings.durationMinutes} onChange={(event) => update("durationMinutes", Number(event.target.value))} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="text-sm font-medium text-zinc-700">Kalori <span className="text-zinc-400">(kcal)</span>
            <input type="number" min="1" step="1" required value={settings.caloriesKcal} onChange={(event) => update("caloriesKcal", Number(event.target.value))} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Daftar blokir</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Situs yang mengganggu fokus</h2>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" checked={settings.enabled} onChange={(event) => update("enabled", event.target.checked)} className="size-4 accent-emerald-800" />
            Blokir aktif
          </label>
        </div>
        <form onSubmit={addSite} className="flex gap-2">
          <input value={siteInput} onChange={(event) => setSiteInput(event.target.value)} placeholder="youtube.com" aria-label="Domain yang akan diblokir" className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
          <button type="submit" className="rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800">Tambah</button>
        </form>
        <ul className="mt-4 divide-y divide-zinc-100">
          {settings.sites.length === 0 ? <li className="py-4 text-sm text-zinc-500">Belum ada situs. Tambahkan domain yang ingin kamu blokir.</li> : settings.sites.map((site) => (
            <li key={site} className="flex items-center justify-between py-3 text-sm">
              <span className="font-medium text-zinc-800">{site}</span>
              <button type="button" onClick={() => update("sites", settings.sites.filter((entry) => entry !== site))} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:bg-red-50 hover:text-red-700">Hapus</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Jadwal blokir</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Tentukan jam fokus</h2>
          <p className="mt-1 text-sm text-zinc-500">Jadwal memakai waktu lokal perangkat ini.</p>
        </div>
        <label className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
          <input type="checkbox" checked={settings.schedule.enabled} onChange={(event) => update("schedule", { ...settings.schedule, enabled: event.target.checked })} className="size-4 accent-emerald-800" />
          Aktifkan jadwal mingguan
        </label>
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">Mulai
            <input type="time" value={settings.schedule.start} onChange={(event) => update("schedule", { ...settings.schedule, start: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950" />
          </label>
          <label className="text-sm font-medium text-zinc-700">Selesai
            <input type="time" value={settings.schedule.end} onChange={(event) => update("schedule", { ...settings.schedule, end: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-950" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Hari dalam jadwal">
          {WEEKDAYS.map((day, index) => {
            const checked = settings.schedule.days.includes(index);
            return <label key={day} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition ${checked ? "border-emerald-900 bg-emerald-950 text-white" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
              <input type="checkbox" checked={checked} onChange={() => update("schedule", { ...settings.schedule, days: checked ? settings.schedule.days.filter((entry) => entry !== index) : [...settings.schedule.days, index].sort() })} className="sr-only" />{day}
            </label>;
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-zinc-600">{statusMessage || (extensionConnected ? "Tersambung ke Site Blocker." : "Sambungkan ekstensi dari popup Site Blocker untuk menyinkronkan situs dan jadwal.")}</p>
        <button type="button" onClick={save} className="rounded-full bg-emerald-950 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800">Simpan pengaturan</button>
      </div>
    </div>
  );
}
