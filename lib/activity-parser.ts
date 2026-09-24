export type ActivityMetrics = {
  distanceKm: number | null;
  durationSeconds: number | null;
  caloriesKcal: number | null;
  activityDate: string | null;
};

export type ActivityTargets = {
  distanceKm: number;
  durationMinutes: number;
  caloriesKcal: number;
};

export type ActivityValidation = {
  valid: boolean;
  failures: string[];
  today: string;
  metrics: ActivityMetrics;
};

function normalizeOcrText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'");
}

function normalizeDigits(value: string): string {
  return value.replace(/[OoQ]/g, "0").replace(/[Il|]/g, "1");
}

function parseNumber(value: string): number | null {
  const normalized = normalizeDigits(value).replace(/\s/g, "").replace(",", ".");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function findLabeledValue(
  text: string,
  label: RegExp,
  value: RegExp,
): RegExpMatchArray | null {
  const lines = normalizeOcrText(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    label.lastIndex = 0;
    const sameLine = lines[index].replace(label, " ");
    const match = sameLine.match(value) ?? lines[index + 1]?.match(value) ?? null;
    if (match) return match;
  }
  return null;
}

function parseDistance(text: string): number | null {
  const match = findLabeledValue(
    text,
    /\b(jarak|distance)\b/i,
    /([0-9OoQIl|]+(?:[.,][0-9OoQIl|]+)?)\s*(km|kilomet(?:er|re)s?|m|meter(?:s)?)?\b/i,
  );
  if (!match) return null;

  const amount = parseNumber(match[1]);
  if (amount === null || amount < 0) return null;
  const unit = (match[2] ?? "km").toLowerCase();
  return unit === "m" || unit.startsWith("meter") ? amount / 1000 : amount;
}

function parseDuration(text: string): number | null {
  const match = findLabeledValue(
    text,
    /\b(durasi(?:\s+olahraga)?|duration|elapsed\s+time)\b/i,
    /([0-9OoQIl|]{1,3})\s*:\s*([0-5]?[0-9OoQIl|])(?:\s*:\s*([0-5]?[0-9OoQIl|]))?\b/i,
  );
  if (!match) return null;

  const first = Number(normalizeDigits(match[1]));
  const second = Number(normalizeDigits(match[2]));
  const third = match[3] === undefined ? null : Number(normalizeDigits(match[3]));
  if (!Number.isInteger(first) || !Number.isInteger(second) || (third !== null && !Number.isInteger(third))) {
    return null;
  }

  // A three-part value is hh:mm:ss. A two-part value is mm:ss.
  if (third === null) return first * 60 + second;
  return first * 3600 + second * 60 + third;
}

function parseCalories(text: string): number | null {
  const match = findLabeledValue(
    text,
    /\b(kalori|calories?|energi|energy)\b/i,
    /([0-9OoQIl|]+(?:[.,][0-9OoQIl|]+)?)\s*(kcal|cal)?\b/i,
  );
  if (!match) return null;
  const amount = parseNumber(match[1]);
  return amount !== null && amount >= 0 ? amount : null;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseActivityDate(text: string): string | null {
  const normalized = normalizeDigits(normalizeOcrText(text));
  const iso = normalized.match(/\b(20\d{2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\b/);
  if (iso) {
    const [, yearText, monthText, dayText] = iso;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    return isValidCalendarDate(year, month, day)
      ? `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null;
  }

  const localized = normalized.match(/\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(20\d{2})\b/);
  if (!localized) return null;
  const [, dayText, monthText, yearText] = localized;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return isValidCalendarDate(year, month, day)
    ? `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;
}

export function parseActivityScreenshotText(text: string): ActivityMetrics {
  return {
    distanceKm: parseDistance(text),
    durationSeconds: parseDuration(text),
    caloriesKcal: parseCalories(text),
    activityDate: parseActivityDate(text),
  };
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validateActivityMetrics(
  metrics: ActivityMetrics,
  targets: ActivityTargets,
  now = new Date(),
): ActivityValidation {
  const today = getLocalDateString(now);
  const failures: string[] = [];

  if (metrics.distanceKm === null) {
    failures.push("Jarak tidak terbaca dari screenshot.");
  } else if (metrics.distanceKm < targets.distanceKm) {
    failures.push(`Jarak ${metrics.distanceKm.toFixed(2)} km, target ${targets.distanceKm} km.`);
  }

  if (metrics.durationSeconds === null) {
    failures.push("Durasi tidak terbaca dari screenshot.");
  } else {
    const targetSeconds = targets.durationMinutes * 60;
    if (metrics.durationSeconds < targetSeconds) {
      failures.push(
        `Durasi ${formatDuration(metrics.durationSeconds)}, target ${targets.durationMinutes} menit.`,
      );
    }
  }

  if (metrics.caloriesKcal === null) {
    failures.push("Kalori tidak terbaca dari screenshot.");
  } else if (metrics.caloriesKcal < targets.caloriesKcal) {
    failures.push(`Kalori ${Math.round(metrics.caloriesKcal)} kcal, target ${targets.caloriesKcal} kcal.`);
  }

  if (metrics.activityDate === null) {
    failures.push("Tanggal tidak terbaca dari screenshot.");
  } else if (metrics.activityDate !== today) {
    failures.push(`Tanggal screenshot ${metrics.activityDate}, hari ini ${today}.`);
  }

  return { valid: failures.length === 0, failures, today, metrics };
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes} menit ${seconds} detik`;
}
