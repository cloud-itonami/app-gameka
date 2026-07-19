import type { Etzhayyim } from "@etzhayyim/sdk";
import type { TickStudioInput, TickStudioOutput } from "./types.js";

export async function tickStudio(
  e: Etzhayyim,
  input: TickStudioInput
): Promise<TickStudioOutput> {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  const shouldRun =
    (hour >= 2 && hour < 4) || (hour >= 14 && hour < 16);

  if (!shouldRun) {
    return {
      status: "skipped",
      outcome: "schedule_not_met",
    };
  }

  const trendCount = Math.floor(Math.random() * 5) + 3;
  const brief = `Trend-driven game concept from media-gamers topics. Iteration ${now.getTime() % 1000}.`;

  return {
    status: "completed",
    outcome: "live",
    brief,
    trendCount,
  };
}
