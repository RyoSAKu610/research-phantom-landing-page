export type MotionSettings = {
  intensity: number;
  tempo: number;
  props: number;
};

export const MOTION_STORAGE_KEY = "researchphantom-motion-v1";
export const MOTION_EVENT = "researchphantom:motion";

export const MOTION_PRESETS = {
  focus: { intensity: 20, tempo: 0.8, props: 25 },
  standard: { intensity: 60, tempo: 1, props: 65 },
  cinema: { intensity: 100, tempo: 1.2, props: 100 },
} as const satisfies Record<string, MotionSettings>;

export const DEFAULT_MOTION: Readonly<MotionSettings> = MOTION_PRESETS.standard;

function bounded(value: unknown, fallback: number, min: number, max: number, scale = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.max(min, Math.min(max, value)) * scale) / scale;
}

/** Do not coerce strings, arrays, null, or non-finite values into CSS settings. */
export function normalizeMotionSettings(value: unknown): MotionSettings {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    intensity: bounded(source.intensity, DEFAULT_MOTION.intensity, 0, 100),
    tempo: bounded(source.tempo, DEFAULT_MOTION.tempo, 0.6, 1.4, 20),
    props: bounded(source.props, DEFAULT_MOTION.props, 0, 100),
  };
}

export function parseMotionSettings(value: string | null): MotionSettings {
  try {
    return normalizeMotionSettings(value === null ? null : JSON.parse(value));
  } catch {
    return { ...DEFAULT_MOTION };
  }
}
