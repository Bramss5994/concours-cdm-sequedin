import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getLiveScores, kickoffKeyFromISO, type LiveFixture } from "@/lib/livescores.functions";

/**
 * Fetches live World Cup fixtures from API-Football, refreshing every 30s
 * when any match is live, otherwise every 5 minutes.
 * Returns a map keyed by minute-precision UTC kickoff ("YYYY-MM-DDTHH:MM").
 */
export function useLiveScores() {
  const fn = useServerFn(getLiveScores);
  const query = useQuery({
    queryKey: ["live-scores"],
    queryFn: () => fn(),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 60_000;
      return data.fixtures.some((f) => f.isLive) ? 30_000 : 5 * 60_000;
    },
    staleTime: 20_000,
  });

  const byKickoff = useMemo(() => {
    const map: Record<string, LiveFixture> = {};
    for (const f of query.data?.fixtures || []) map[f.kickoffKey] = f;
    return map;
  }, [query.data]);

  return { byKickoff, error: query.data?.error || null, isLoading: query.isLoading };
}

export { kickoffKeyFromISO };
export type { LiveFixture };
