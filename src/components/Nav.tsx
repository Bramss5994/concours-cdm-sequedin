import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Trophy, Calendar, BarChart3, User as UserIcon, Shield, LogOut, LogIn, Menu, X, Target } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import logoIlevia from "@/assets/logo-keolis-ilevia.png.asset.json";

export function Nav() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // The /unite admin panel has its own session and navigation.
  // Hide the participant nav there to avoid accidentally leaving the panel.
  if (pathname.startsWith("/unite")) return null;


  const links = [
    { to: "/", label: "Accueil", icon: Trophy },
    { to: "/matches", label: "Matchs", icon: Calendar },
    { to: "/leaderboard", label: "Classement", icon: BarChart3 },
    ...(user ? [{ to: "/profile", label: "Mon profil", icon: UserIcon }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <img src={logoIlevia.url} alt="Keolis Lille Ilévia" className="h-8 w-auto" />
          <span className="hidden sm:inline">Pronostics CDM 2026</span>
        </Link>

        <nav className="hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
              activeOptions={{ exact: l.to === "/" }}
            >
              <l.icon className="h-4 w-4" /> {l.label}
            </Link>
          ))}
          {user ? (
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); router.navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" /> Déconnexion
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button asChild size="sm">
                <Link to="/auth"><LogIn className="h-4 w-4" /> Se connecter</Link>
              </Button>
            </div>
          )}
        </nav>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t md:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent [&.active]:bg-primary [&.active]:text-primary-foreground"
                activeOptions={{ exact: l.to === "/" }}
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </Link>
            ))}
            {user ? (
              <Button variant="outline" onClick={async () => { setOpen(false); await signOut(); router.navigate({ to: "/" }); }}>
                <LogOut className="h-4 w-4" /> Déconnexion
              </Button>
            ) : (
              <div className="flex flex-col gap-1">
                <Button asChild>
                  <Link to="/auth" onClick={() => setOpen(false)}><LogIn className="h-4 w-4" /> Se connecter</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
