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
      .limit(1000);

    if (error) throw new Error(error.message);

    const match = profiles?.find(
      (profile) =>
        normalizeLoginPart(profile.prenom ?? "") === targetPrenom &&
        normalizeLoginPart(profile.num_paie ?? "") === targetNumPaie,
    );

    return { email: match?.email ?? null };
  });