import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getUnreadAnnouncementsFn, markAnnouncementReadFn } from "@/lib/announcements.functions";
import { Megaphone } from "lucide-react";

type Announcement = { id: string; title: string; body: string; created_at: string };

export function AnnouncementModal() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(getUnreadAnnouncementsFn);
  const markRead = useServerFn(markAnnouncementReadFn);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);

  const q = useQuery({
    queryKey: ["unread-announcements", user?.id],
    queryFn: () => list() as Promise<Announcement[]>,
    enabled: !loading && !!user,
    staleTime: 60_000,
  });

  const current = q.data?.[0];

  useEffect(() => {
    setConfirmed(false);
  }, [current?.id]);

  if (!user || !current) return null;

  async function handleConfirm() {
    if (!confirmed || !current) return;
    setPending(true);
    try {
      await markRead({ data: { id: current.id } });
      await qc.invalidateQueries({ queryKey: ["unread-announcements", user!.id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => { /* forced */ }}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {current.title}
          </DialogTitle>
          <DialogDescription className="sr-only">Message du super admin</DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {current.body}
        </div>
        <label className="mt-2 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Je confirme avoir lu ce message.</span>
        </label>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!confirmed || pending}>
            {pending ? "Enregistrement…" : "Fermer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
