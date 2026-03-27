export interface DartConfig {
  id: string;
  name: string;
  tagline: string;
  speed: number; // 1–18
  stability: number; // 0–100
  weight: number; // grams
  color: string;
  barrelRadius: number;
  flightSize: number;
}

export const DART_CONFIGS: DartConfig[] = [
  {
    id: "specter",
    name: "SPECTER",
    tagline: "Lightning fast · Razor thin",
    speed: 18,
    stability: 55,
    weight: 12,
    color: "#00e8ff",
    barrelRadius: 0.04,
    flightSize: 0.08,
  },
  {
    id: "titan",
    name: "TITAN",
    tagline: "Heavy & rock solid",
    speed: 8,
    stability: 95,
    weight: 28,
    color: "#ff8800",
    barrelRadius: 0.085,
    flightSize: 0.18,
  },
  {
    id: "viper",
    name: "VIPER",
    tagline: "Perfectly balanced",
    speed: 14,
    stability: 75,
    weight: 18,
    color: "#ff40b0",
    barrelRadius: 0.055,
    flightSize: 0.12,
  },
];
