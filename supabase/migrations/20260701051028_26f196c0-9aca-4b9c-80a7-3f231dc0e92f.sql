ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER TABLE public.players REPLICA IDENTITY FULL;