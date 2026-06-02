// Système de badges/succès calculé côté client à partir des pronostics.

export type BadgeDef = {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  check: (ctx: BadgeContext) => boolean;
  progress?: (ctx: BadgeContext) => { current: number; target: number };
};

export type JoinedPrediction = {
  p: { score_a: number; score_b: number; points: number; exact_score: boolean; good_winner: boolean };
  m: {
    id: string;
    kickoff_at: string;
    stage: string;
    finished: boolean;
    score_a: number | null;
    score_b: number | null;
    group_letter?: string | null;
  };
};

export type BadgeContext = {
  joined: JoinedPrediction[]; // pronostics sur matchs terminés, triés par date
  totalPredictions: number;
};

function countExact(j: JoinedPrediction[]) { return j.filter((x) => x.p.exact_score).length; }
function countGood(j: JoinedPrediction[]) { return j.filter((x) => (x.p.points || 0) > 0).length; }
function bestStreak(j: JoinedPrediction[]) {
  let best = 0, cur = 0;
  for (const x of j) {
    if ((x.p.points || 0) > 0) { cur++; if (cur > best) best = cur; } else cur = 0;
  }
  return best;
}
function exactStreak(j: JoinedPrediction[]) {
  let best = 0, cur = 0;
  for (const x of j) {
    if (x.p.exact_score) { cur++; if (cur > best) best = cur; } else cur = 0;
  }
  return best;
}
function countByStage(j: JoinedPrediction[], stages: string[]) {
  return j.filter((x) => stages.includes(x.m.stage) && (x.p.points || 0) > 0).length;
}
function totalPoints(j: JoinedPrediction[]) {
  return j.reduce((s, x) => s + (x.p.points || 0), 0);
}

export const BADGES: BadgeDef[] = [
  {
    id: "first_exact",
    name: "1er pronostic parfait",
    description: "Trouve ton premier score exact",
    icon: "🎯",
    check: (c) => countExact(c.joined) >= 1,
    progress: (c) => ({ current: Math.min(countExact(c.joined), 1), target: 1 }),
  },
  {
    id: "sharp_shooter",
    name: "Sniper",
    description: "5 scores exacts au total",
    icon: "🏹",
    check: (c) => countExact(c.joined) >= 5,
    progress: (c) => ({ current: Math.min(countExact(c.joined), 5), target: 5 }),
  },
  {
    id: "oracle",
    name: "Oracle",
    description: "10 scores exacts au total",
    icon: "🔮",
    check: (c) => countExact(c.joined) >= 10,
    progress: (c) => ({ current: Math.min(countExact(c.joined), 10), target: 10 }),
  },
  {
    id: "streak_3",
    name: "Sur sa lancée",
    description: "3 bons pronostics d'affilée",
    icon: "🔥",
    check: (c) => bestStreak(c.joined) >= 3,
    progress: (c) => ({ current: Math.min(bestStreak(c.joined), 3), target: 3 }),
  },
  {
    id: "streak_5",
    name: "5 victoires d'affilée",
    description: "5 bons pronostics d'affilée",
    icon: "⚡",
    check: (c) => bestStreak(c.joined) >= 5,
    progress: (c) => ({ current: Math.min(bestStreak(c.joined), 5), target: 5 }),
  },
  {
    id: "streak_10",
    name: "Invincible",
    description: "10 bons pronostics d'affilée",
    icon: "👑",
    check: (c) => bestStreak(c.joined) >= 10,
    progress: (c) => ({ current: Math.min(bestStreak(c.joined), 10), target: 10 }),
  },
  {
    id: "exact_streak_2",
    name: "Double impact",
    description: "2 scores exacts d'affilée",
    icon: "💥",
    check: (c) => exactStreak(c.joined) >= 2,
    progress: (c) => ({ current: Math.min(exactStreak(c.joined), 2), target: 2 }),
  },
  {
    id: "group_specialist",
    name: "Spécialiste des groupes",
    description: "10 bons pronostics en phase de groupes",
    icon: "🅰️",
    check: (c) => countByStage(c.joined, ["group"]) >= 10,
    progress: (c) => ({ current: Math.min(countByStage(c.joined, ["group"]), 10), target: 10 }),
  },
  {
    id: "ko_specialist",
    name: "Roi de la phase finale",
    description: "5 bons pronostics en phase à élimination",
    icon: "🏆",
    check: (c) => countByStage(c.joined, ["r32", "r16", "qf", "sf", "third", "final"]) >= 5,
    progress: (c) => ({
      current: Math.min(countByStage(c.joined, ["r32", "r16", "qf", "sf", "third", "final"]), 5),
      target: 5,
    }),
  },
  {
    id: "participant",
    name: "Participant assidu",
    description: "Pronostique 20 matchs",
    icon: "📝",
    check: (c) => c.totalPredictions >= 20,
    progress: (c) => ({ current: Math.min(c.totalPredictions, 20), target: 20 }),
  },
  {
    id: "marathoner",
    name: "Marathonien",
    description: "Pronostique 50 matchs",
    icon: "🏃",
    check: (c) => c.totalPredictions >= 50,
    progress: (c) => ({ current: Math.min(c.totalPredictions, 50), target: 50 }),
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Atteins 100 points",
    icon: "💯",
    check: (c) => totalPoints(c.joined) >= 100,
    progress: (c) => ({ current: Math.min(totalPoints(c.joined), 100), target: 100 }),
  },
  {
    id: "legend",
    name: "Légende",
    description: "Atteins 250 points",
    icon: "🌟",
    check: (c) => totalPoints(c.joined) >= 250,
    progress: (c) => ({ current: Math.min(totalPoints(c.joined), 250), target: 250 }),
  },
];

export function evaluateBadges(ctx: BadgeContext) {
  return BADGES.map((b) => {
    const unlocked = b.check(ctx);
    const progress = b.progress?.(ctx);
    return { ...b, unlocked, progress };
  });
}
