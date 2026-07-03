import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { kickoffKeyFromISO } from "./livescores.shared";
import type { GoalEvent, LiveFixture } from "./livescores.shared";

export type { GoalEvent, LiveFixture };
export { kickoffKeyFromISO };

export const getLiveScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ fixtures: LiveFixture[]; fetchedAt: string; error: string | null }> => {
    const { fetchLiveScores } = await import("./livescores.server");
    return fetchLiveScores();
  },
);

export const getFixtureEvents = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ fixtureId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }): Promise<{ goals: GoalEvent[]; error: string | null }> => {
    const { fetchFixtureEvents } = await import("./livescores.server");
    return fetchFixtureEvents(data.fixtureId);
  });
