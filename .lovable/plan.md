# Admins d'unité (accès séparé)

Objectif : permettre à chaque dépôt d'avoir un (ou plusieurs) admin d'unité avec un **code d'unité + mot de passe**, totalement distinct de la connexion participants (email/mot de passe Supabase). Le super-admin Sequedin garde tous ses droits actuels + peut créer/supprimer les admins d'unité.

## Architecture

### 1. Nouvelle table `unit_admins` (migration)
- `depot` (enum existant), `login_code` (unique, ex: `FAID-ADM`), `password_hash` (PBKDF2 + salt), `active`, timestamps
- RLS : aucune lecture/écriture côté client (`USING (false)`). Tout passe par des server functions admin (clé service role).

### 2. Authentification dédiée (sans Supabase Auth)
- Server fn `loginUnitAdmin({ login_code, password })` : vérifie hash, émet un **cookie signé HMAC** `unit_admin_session` (httpOnly, 8h), payload `{ depot, login_code, exp }`.
- Server fn `logoutUnitAdmin()` : efface le cookie.
- Middleware `requireUnitAdmin` : lit + vérifie le cookie, injecte `{ depot, login_code }` dans le contexte.
- Hash & HMAC via **Web Crypto** (PBKDF2-SHA256, 100k iter) — compatible runtime Cloudflare Workers.
- Nouveau secret : `UNIT_ADMIN_COOKIE_SECRET` (clé de signature du cookie).

### 3. Nouvelles routes
- `/unite/login` — page publique : formulaire code + mot de passe.
- `/unite` — espace admin d'unité (gating via le cookie, pas via `_authenticated` Supabase) :
  - Liste des participants de **son dépôt uniquement**
  - Actions : activer/désactiver, réinitialiser mot de passe, supprimer
  - Bouton déconnexion
  - Lecture seule sur les matchs/résultats (pas d'édition — réservé super-admin)

### 4. Panneau super-admin (Sequedin) — onglet "Admins d'unité" dans `/admin`
- Liste de tous les `unit_admins`
- Créer : choisir dépôt + code + mot de passe initial
- Réinitialiser mot de passe
- Activer/désactiver / supprimer
- Visible uniquement si `has_role(uid, 'admin')` **ET** `profiles.depot = 'sequedin'`

### 5. Server functions
Nouveau fichier `src/lib/unit-admin.functions.ts` :
- `loginUnitAdmin`, `logoutUnitAdmin`, `getUnitAdminSession` (lecture cookie)
- `listUnitParticipantsFn` (protégée par `requireUnitAdmin`, filtrée sur `context.depot`)
- `toggleUnitParticipantFn`, `resetUnitParticipantPasswordFn`, `deleteUnitParticipantFn`

Nouveau fichier `src/lib/super-admin.functions.ts` (utilise `requireSupabaseAuth` + check Sequedin admin) :
- `listUnitAdminsFn`, `createUnitAdminFn`, `resetUnitAdminPasswordFn`, `toggleUnitAdminFn`, `deleteUnitAdminFn`

## Détails techniques

```text
Cookie unit_admin_session
  = base64url(JSON{depot,login_code,exp}) + "." + base64url(HMAC-SHA256(payload, SECRET))
  Set-Cookie: unit_admin_session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800
```

Hash mot de passe :
```text
salt = 16 bytes random
key  = PBKDF2-SHA256(password, salt, 100000, 32 bytes)
stored = "pbkdf2$100000$" + base64(salt) + "$" + base64(key)
```

## Question avant migration

Le **code d'unité** : sensible à la casse ou non ? Je propose **insensible à la casse** (stocké en majuscules, ex: `FAID-ADM`, `WATT-ADM`, `PCBUS-ADM`, `TRAM-ADM`). Codes initiaux suggérés — vous pourrez les changer ensuite.

Je vais aussi demander le secret `UNIT_ADMIN_COOKIE_SECRET` (généré aléatoire si vous préférez que je propose une valeur).

Si OK, je lance la migration puis j'implémente les server fns + pages.
