import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function normalizeLoginPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export const resolveParticipantLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        prenom: z.string().trim().min(1).max(50),
        numPaie: z.string().trim().min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const targetPrenom = normalizeLoginPart(data.prenom);
    const targetNumPaie = normalizeLoginPart(data.numPaie);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("email, prenom, num_paie")
      .eq("active", true)
      .limit(2000);

    if (error) throw new Error(error.message);
    if (!profiles || profiles.length === 0) return { email: null };

    // 1. Strict match: same normalized prénom AND n° de paie
    const strict = profiles.find(
      (p) =>
        normalizeLoginPart(p.prenom ?? "") === targetPrenom &&
        normalizeLoginPart(p.num_paie ?? "") === targetNumPaie,
    );
    if (strict) return { email: strict.email };

    // 2. Fallback: unique match on n° de paie alone (employee ID is unique)
    const byNumPaie = profiles.filter(
      (p) => normalizeLoginPart(p.num_paie ?? "") === targetNumPaie,
    );
    if (byNumPaie.length === 1) return { email: byNumPaie[0].email };

    // 3. Fallback: unique match on prénom alone
    const byPrenom = profiles.filter(
      (p) => normalizeLoginPart(p.prenom ?? "") === targetPrenom,
    );
    if (byPrenom.length === 1) return { email: byPrenom[0].email };

    return { email: null };
  });
