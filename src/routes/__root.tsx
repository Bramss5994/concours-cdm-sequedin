import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Toaster } from "@/components/ui/sonner";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

function RealtimeBridge() {
  useRealtimeSync();
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas ou a été déplacée.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Erreur de chargement</h1>
        <p className="mt-2 text-sm text-muted-foreground">Une erreur est survenue. Réessayez ou revenez à l'accueil.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Réessayer</button>
          <a href="/" className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">Accueil</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Inter-Dépôts CDM 2026 — Concours de pronostics" },
      { name: "description", content: "Concours de pronostics de la Coupe du Monde 2026 entre les dépôts Sequedin, Faidherbe, Wattrelos et PC Bus (Keolis / Ilévia)." },
      { name: "author", content: "Inter-Dépôts Keolis Lille" },
      { property: "og:title", content: "Inter-Dépôts CDM 2026 — Concours de pronostics" },
      { property: "og:description", content: "Concours de pronostics de la Coupe du Monde 2026 entre les dépôts Sequedin, Faidherbe, Wattrelos et PC Bus (Keolis / Ilévia)." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Inter-Dépôts CDM 2026 — Concours de pronostics" },
      { name: "twitter:description", content: "Concours de pronostics de la Coupe du Monde 2026 entre les dépôts Sequedin, Faidherbe, Wattrelos et PC Bus (Keolis / Ilévia)." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2cb549cc-be3f-4a90-b4c2-52c309dfc9cf/id-preview-e1c596e4--1fcfbbcb-a9aa-45f6-845c-6fcd62e57ce5.lovable.app-1779966444793.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2cb549cc-be3f-4a90-b4c2-52c309dfc9cf/id-preview-e1c596e4--1fcfbbcb-a9aa-45f6-845c-6fcd62e57ce5.lovable.app-1779966444793.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeBridge />
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1"><Outlet /></main>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            Pronos CDM 2026 · Dépôt de Sequedin (Keolis / Ilévia) · Entre collègues
          </footer>
        </div>
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
