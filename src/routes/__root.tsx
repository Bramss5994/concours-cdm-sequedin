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
      { title: "Pronos CDM 2026 - Dépôt de Sequedin" },
      { name: "description", content: "Concours de pronostics de la Coupe du Monde 2026 pour le personnel du dépôt de Sequedin (Keolis / Ilévia)." },
      { name: "author", content: "Dépôt de Sequedin" },
      { property: "og:title", content: "Pronos CDM 2026 - Dépôt de Sequedin" },
      { property: "og:description", content: "Pronostiquez tous les matchs de la Coupe du Monde 2026 entre collègues." },
      { property: "og:type", content: "website" },
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
