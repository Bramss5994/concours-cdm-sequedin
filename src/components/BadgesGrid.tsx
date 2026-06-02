import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { evaluateBadges, type BadgeContext } from "@/lib/badges";
import { Award } from "lucide-react";

export function BadgesGrid({ ctx }: { ctx: BadgeContext }) {
  const badges = evaluateBadges(ctx);
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Badges & succès</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {unlockedCount}/{badges.length}
          </span>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {badges.map((b, i) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className={`relative flex aspect-square cursor-help flex-col items-center justify-center rounded-lg border p-2 text-center transition ${
                      b.unlocked
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border bg-muted/30 opacity-60 grayscale"
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">{b.icon}</span>
                    <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight">
                      {b.name}
                    </span>
                    {b.unlocked && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                        ✓
                      </span>
                    )}
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs">{b.description}</p>
                  {b.progress && !b.unlocked && (
                    <div className="mt-2 w-40">
                      <Progress value={(b.progress.current / b.progress.target) * 100} className="h-1.5" />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {b.progress.current} / {b.progress.target}
                      </p>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
