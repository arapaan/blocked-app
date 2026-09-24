"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { parseActivityScreenshotText, validateActivityMetrics, type ActivityValidation } from "../../lib/activity-parser";
import { recognizeActivityScreenshot } from "../../lib/recognize-activity";
import { sendExtensionMessage } from "../lib/extension";
import { DEFAULT_SETTINGS, readSettings, type AppSettings } from "../lib/settings";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function displayValue(value: number | null, unit: string) {
  return value === null ? "Belum terbaca" : `${value}${unit}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Belum terbaca";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes} menit ${remainder} detik`;
}

export default function UploadFileDialog() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ActivityValidation | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");

  useEffect(() => {
    const hydration = window.setTimeout(() => setSettings(readSettings()), 0);
    return () => window.clearTimeout(hydration);
  }, []);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  async function processScreenshot(selectedFile: File) {
    if (!selectedFile.type.startsWith("image/")) {
      setFeedback("Pilih file gambar seperti JPG, PNG, atau WebP.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFeedback("Ukuran screenshot maksimal 20 MB.");
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(selectedFile);
    setPreview(previewRef.current);
    setFile(selectedFile);
    setValidation(null);
    setFeedback("");
    setBusy(true);
    setProgress(0);
    setProgressLabel("Menyiapkan pembaca gambar…");
    try {
      const text = await recognizeActivityScreenshot(selectedFile, (nextProgress, status) => {
        setProgress(nextProgress);
        setProgressLabel(status === "recognizing text" ? "Membaca teks screenshot…" : "Memuat pembaca teks…");
      });
      const metrics = parseActivityScreenshotText(text);
      const result = validateActivityMetrics(metrics, {
        distanceKm: settings.distanceKm,
        durationMinutes: settings.durationMinutes,
        caloriesKcal: settings.caloriesKcal,
      });
      setValidation(result);
      setProgress(100);
      setProgressLabel("Pemeriksaan selesai");

      if (metrics.activityDate === result.today) {
        await sendExtensionMessage({
          type: "SAVE_PROGRESS",
          progress: {
            date: result.today,
            distanceKm: metrics.distanceKm,
            durationSeconds: metrics.durationSeconds,
            caloriesKcal: metrics.caloriesKcal,
          },
        }).catch(() => undefined);
      }

      if (result.valid) {
        try {
          await sendExtensionMessage({ type: "SET_OPEN_TODAY", date: result.today });
          setFeedback("Target tercapai. Situs terdaftar terbuka sampai tengah malam waktu lokal.");
        } catch (error) {
          setFeedback(error instanceof Error ? `Bukti valid, tetapi belum terkirim ke ekstensi. ${error.message}` : "Bukti valid, tetapi ekstensi belum terhubung.");
        }
      } else {
        setFeedback("Belum memenuhi semua target hari ini. Periksa hasil baca di bawah.");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? `OCR gagal: ${error.message}` : "OCR gagal membaca screenshot.");
      setProgressLabel("Pembacaan gagal");
    } finally {
      setBusy(false);
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (selected) void processScreenshot(selected);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) void processScreenshot(selected);
  }

  return (
    <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_22px_80px_-45px_rgba(15,23,42,.25)] sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Bukti olahraga hari ini</p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-4xl">Selesaikan gerakmu. Buka kembali internetmu.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">Unggah screenshot dari aplikasi olahraga. Kami membaca jarak, durasi, kalori, dan tanggal langsung di browser.</p>
          </div>
          <span aria-hidden="true" className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-900 sm:grid">↗</span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-8 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-8 text-center transition ${isDragging ? "border-emerald-800 bg-emerald-50" : "border-zinc-300 bg-zinc-50/80 hover:border-emerald-700 hover:bg-emerald-50/50"}`}
        >
          <input ref={inputRef} type="file" accept="image/*" onChange={handleInput} className="sr-only" aria-label="Pilih screenshot olahraga" />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Pratinjau screenshot aktivitas" className="mb-4 max-h-44 max-w-full rounded-2xl object-contain shadow-sm" />
          ) : (
            <span aria-hidden="true" className="mb-4 grid size-14 place-items-center rounded-2xl bg-white text-2xl text-emerald-900 shadow-sm">↑</span>
          )}
          <span className="text-sm font-semibold text-zinc-900">{file ? file.name : "Tarik screenshot ke sini"}</span>
          <span className="mt-1 text-sm text-zinc-500">atau pilih file dari perangkat · JPG, PNG, WebP · maks. 20 MB</span>
          <span className="mt-5 rounded-full bg-emerald-950 px-5 py-2.5 text-sm font-semibold text-white">{file ? "Pilih screenshot lain" : "Pilih screenshot"}</span>
        </div>

        {(busy || progressLabel) && (
          <div className="mt-5" aria-live="polite">
            <div className="mb-2 flex justify-between text-xs text-zinc-500"><span>{progressLabel}</span><span>{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-700 transition-[width]" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {feedback && <p role="status" className={`mt-5 rounded-2xl px-4 py-3 text-sm leading-6 ${validation?.valid ? "bg-emerald-50 text-emerald-900" : validation ? "bg-amber-50 text-amber-900" : "bg-zinc-100 text-zinc-700"}`}>{feedback}</p>}

        {validation && (
          <div className="mt-6 rounded-2xl border border-zinc-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-zinc-950">Hasil pembacaan</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${validation.valid ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{validation.valid ? "Target tercapai" : "Perlu dilengkapi"}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Jarak" value={displayValue(validation.metrics.distanceKm, " km")} />
              <Metric label="Durasi" value={formatDuration(validation.metrics.durationSeconds)} />
              <Metric label="Kalori" value={displayValue(validation.metrics.caloriesKcal, " kcal")} />
              <Metric label="Tanggal" value={validation.metrics.activityDate ?? "Belum terbaca"} />
            </dl>
            {validation.failures.length > 0 && <ul className="mt-4 space-y-1 text-sm text-amber-900">{validation.failures.map((failure) => <li key={failure}>• {failure}</li>)}</ul>}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-[2rem] bg-emerald-950 p-6 text-emerald-50 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Target hari ini</p>
          <div className="mt-5 space-y-4">
            <Target label="Jarak" value={`${settings.distanceKm} km`} />
            <Target label="Durasi" value={`${settings.durationMinutes} menit`} />
            <Target label="Kalori" value={`${settings.caloriesKcal} kcal`} />
          </div>
          <a href="/settings" className="mt-6 inline-flex rounded-full border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-900">Ubah target</a>
        </section>
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 sm:p-7">
          <p className="text-sm font-semibold text-zinc-900">Cara kerjanya</p>
          <ol className="mt-4 space-y-4 text-sm leading-5 text-zinc-600">
            <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-800">1</span>Ambil screenshot detail aktivitas hari ini.</li>
            <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-800">2</span>OCR memeriksa tiga target dan tanggal.</li>
            <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-800">3</span>Jika lolos, ekstensi membuka situs sampai tengah malam.</li>
          </ol>
          <p className="mt-5 border-t border-zinc-100 pt-4 text-xs leading-5 text-zinc-500">Gambar diproses di perangkatmu. Akurasi OCR bergantung pada kualitas screenshot.</p>
        </section>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-zinc-50 p-3"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 truncate text-sm font-semibold text-zinc-900">{value}</dd></div>;
}

function Target({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-emerald-900 pb-3 last:border-0 last:pb-0"><span className="text-sm text-emerald-200">{label}</span><span className="text-lg font-semibold tracking-tight">{value}</span></div>;
}
