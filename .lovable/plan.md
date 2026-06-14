## Mise à jour de l'écran info voyageurs

### Changements dans `src/components/BusLockBanner.tsx`

1. **Temps réel pour les stats**
   - Ajouter `useRealtimeSync()` (hook existant) dans le composant pour invalider automatiquement les caches `predictions` / `leaderboard-data` à chaque changement Postgres.
   - Réduire le `staleTime` / ajouter un `refetchInterval` court (ex. 15 s) sur la `useQuery` qui alimente les compteurs (Inscrits, Matchs joués, Pronostics, Actifs), pour que l'affichage LED reflète l'activité en direct même sans event realtime.
   - Garder le `useServerFn` actuel — pas de changement côté backend.

2. **Suppression du panneau opérateur**
   - Retirer entièrement le bloc « Ligne CDM26 · Kéolis · Ilévia » en bas de l'écran.
   - Réajuster les paddings/hauteurs pour que la scène nocturne et la grille de stats restent bien cadrées sans laisser de vide visible.

3. **Suppression du bus animé**
   - Retirer le `motion.div` du bus rouge en arrière-plan (carrosserie, phare ambre, roues) et son `useEffect` de boucle infinie.
   - Nettoyer les imports / variables devenus inutiles (timers, refs liés au bus).

### Conservé
- Horloge temps réel et indicateur « EN DIRECT ».
- Scène nocturne (dégradé, lune, étoiles, halo lampadaire, skyline avec fenêtres éclairées).
- Bandeau LED néon et grille de stats animée.

Aucune modification de schéma, de RLS ou de logique serveur.
