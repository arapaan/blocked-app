"use client";

import { createWorker } from "tesseract.js";

export type OcrProgress = (progress: number, status: string) => void;

/** Runs English and Indonesian OCR in the browser; import this from client-side code only. */
export async function recognizeActivityScreenshot(
  image: File | Blob | string,
  onProgress?: OcrProgress,
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("OCR screenshot hanya dapat dijalankan di browser.");
  }

  const worker = await createWorker(["eng", "ind"], undefined, {
    logger: ({ progress, status }) => onProgress?.(Math.round(progress * 100), status),
  });

  try {
    const result = await worker.recognize(image);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
