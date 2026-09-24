import type { AppSettings } from "./settings";

const EXTENSION_ID_KEY = "ruang-fokus-extension-id";

export type ExtensionState = {
  sites: string[];
  enabled: boolean;
  schedule: AppSettings["schedule"];
  targets: Pick<AppSettings, "distanceKm" | "durationMinutes" | "caloriesKcal">;
  openUntil: number | null;
  active: boolean;
  progress: {
    date: string;
    distanceKm: number | null;
    durationSeconds: number | null;
    caloriesKcal: number | null;
  } | null;
};

type ExtensionMessage =
  | { type: "GET_STATE" }
  | { type: "SET_OPEN_TODAY"; date: string }
  | {
      type: "SAVE_PROGRESS";
      progress: {
        date: string;
        distanceKm: number | null;
        durationSeconds: number | null;
        caloriesKcal: number | null;
      };
    }
  | {
      type: "UPDATE_SETTINGS";
      settings: {
        sites: string[];
        enabled: boolean;
        schedule: AppSettings["schedule"];
        targets: Pick<AppSettings, "distanceKm" | "durationMinutes" | "caloriesKcal">;
      };
    };

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: ExtensionMessage,
          callback: (response: { ok: boolean; state?: ExtensionState; error?: string }) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

export function getExtensionId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const provided = params.get("extensionId");
  if (provided && /^[a-p]{32}$/.test(provided)) {
    localStorage.setItem(EXTENSION_ID_KEY, provided);
    params.delete("extensionId");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }
  return localStorage.getItem(EXTENSION_ID_KEY);
}

export function sendExtensionMessage<T = ExtensionState>(message: ExtensionMessage): Promise<T> {
  const extensionId = getExtensionId();
  const runtime = window.chrome?.runtime;
  if (!extensionId || !runtime?.sendMessage) {
    return Promise.reject(new Error("Ekstensi belum terhubung. Buka aplikasi dari popup Site Blocker."));
  }

  return new Promise((resolve, reject) => {
    runtime.sendMessage(extensionId, message, (response) => {
      const error = runtime.lastError?.message;
      if (error) return reject(new Error("Ekstensi tidak merespons. Pastikan Site Blocker sudah aktif."));
      if (!response?.ok) return reject(new Error(response?.error ?? "Permintaan ke ekstensi gagal."));
      resolve(response.state as T);
    });
  });
}

export function settingsMessage(settings: AppSettings): ExtensionMessage {
  return {
    type: "UPDATE_SETTINGS",
    settings: {
      sites: settings.sites,
      enabled: settings.enabled,
      schedule: settings.schedule,
      targets: {
        distanceKm: settings.distanceKm,
        durationMinutes: settings.durationMinutes,
        caloriesKcal: settings.caloriesKcal,
      },
    },
  };
}
