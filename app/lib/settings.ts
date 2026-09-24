export type BlockSchedule = {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
};

export type AppSettings = {
  distanceKm: number;
  durationMinutes: number;
  caloriesKcal: number;
  sites: string[];
  enabled: boolean;
  schedule: BlockSchedule;
};

export const SETTINGS_KEY = "ruang-fokus-settings-v1";

export const DEFAULT_SETTINGS: AppSettings = {
  distanceKm: 3,
  durationMinutes: 30,
  caloriesKcal: 150,
  sites: [],
  enabled: true,
  schedule: { enabled: false, start: "08:00", end: "22:00", days: [0, 1, 2, 3, 4, 5, 6] },
};

export function readSettings(): AppSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(value as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function todayLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatRemaining(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
}
