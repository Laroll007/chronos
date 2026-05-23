# CHRONOS - Gestion optimisée des congés policiers

**URL Production** : https://mychronos.fr  
**Dernière mise à jour** : 25 avril 2026 (v1.2 Build 4 uploadée App Store Connect, en attente que v1.1 soit traitée)

---

## v1.2 (Build 4) — 25 avril 2026

**UI/UX**
- Header dashboard responsive (`text-lg sm:text-2xl` titre, boutons compacts mobile)
- Toutes les modales/drawers homogénéisées : header gradient bleu foncé + bande tricolore + X stylisé, animation `Dialog` centrée (NotificationsPanel et CountersDrawer convertis de `Sheet` → `Dialog`)
- Boutons d'aide `(?)` sur 14 cartouches compteurs (dashboard + onboarding) — composant partagé `components/shared/CounterHelpModal.tsx` avec HELP_CONTENT pour : cet, ca, caHP, cf, rtc, rtt, rps, hs, caAnterieur, caHPAnterieur, artt, cet2008, congesBonifies, hsHistorique
- Popup d'aide centrée mobile (au lieu de `items-end`)
- Cycle Hebdomadaire activé : 7h53 jour normal + 7h25 jour court (vendredi), masque les sections inadaptées (date réf, semaines A/B)
- Compteurs vides par défaut dans onboarding (placeholder « 0 »)
- Suppression de l'option pseudo
- Texte calendrier raccourci : « Cliquez sur un jour pour commencer à poser »
- Bandeau CA HP avec statut texte + diode colorée (Actif/Inactif/Obtenu)
- Logo onboarding avec fond opaque (`/icons/icon-512x512.png`)
- Footer dashboard intégré au flux scroll (plus en `position: fixed`)

**Accessibilité**
- `DialogTitle` ajouté à toutes les modales (lecteurs d'écran)
- Contrastes texte renforcés (slate-400 → slate-500 en plusieurs endroits)

**Sécurité / SEO web**
- CSP stricte en prod (`script-src 'self' 'unsafe-inline'`), relaxée en dev (`+ 'unsafe-eval'` requis pour React HMR)
- `Strict-Transport-Security` actif uniquement en prod (casse le dev local HTTP sinon)
- `upgrade-insecure-requests` prod-only pour la même raison
- Routes ajoutées : `/api/health` (monitoring), `/robots.txt`, `/sitemap.xml`
- Endpoint `/api/feedback` durci : honeypot anti-bot, timeout 15s, consentement RGPD obligatoire
- `allowedDevOrigins: ['127.0.0.1', '192.168.1.90']` pour HMR depuis simulateur iOS

**Build Capacitor**
- Nouveau script `npm run build:capacitor` (`scripts/build-capacitor.mjs`) : déplace `app/api`, `app/robots.ts`, `app/sitemap.ts` vers `.capacitor-shelf/` pendant le build statique (sinon `output: 'export'` échoue), puis restaure. Restauration automatique sur SIGINT/SIGTERM/exit.

**Bug fixes critiques**
- **Rules of Hooks violation dans `CalendarYear.tsx`** : `useMonthCalendar` (custom hook) appelé dans une boucle dans un `useMemo` → cassait l'hydratation React → boutons X des popups inertes. Fix : extraction de la logique pure dans `computeMonthCalendar()` (fonction normale dans `hooks/useCycle.ts`).
- **Modal nesting Radix Sheet→Dialog** : remplacé en convertissant `CountersDrawer` et `NotificationsPanel` en `Dialog`. `CounterHelpModal` (custom portal) garde des `pointer-events: auto` explicites pour contourner le blocage Radix sur les body siblings.
- **Suppression de `app/dashboard/layout.tsx`** : le `<script dangerouslySetInnerHTML>` pré-hydration générait un warning React qui marquait la page comme « 1 issue » dans le dev overlay (la redirection se fait toujours via `useEffect` dans `dashboard/page.tsx`, juste 2s plus lent au premier chargement).

**Audit UltraJury** (2026-04-24)
- Score global : **63.2/100** — premier audit
- Stocké dans `audit/history.json` pour tracking Delta
- Rapport : `audit/ultrajury-2026-04-24-1844.md` + backlog : `audit/backlog-2026-04-24-1844.md`
- Faiblesses identifiées : DevOps (pas de CI/CD), Conformité, SEO (corrigé en partie)

---

## Stack technique

| Composant | Version |
|-----------|---------|
| Next.js | 16 (App Router, Turbopack) |
| React | 19 (Client Components) |
| TypeScript | strict mode |
| Tailwind CSS | 4 + shadcn/ui |
| Recharts | Graphiques |
| Vitest | Tests |
| Stockage | localStorage (100% local) |
| Capacitor | iOS packaging (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`) |

---

## Architecture

```
chronos/
├── app/
│   ├── page.tsx                # Redirection
│   ├── layout.tsx              # Layout global + PWA
│   ├── onboarding/page.tsx     # Wizard configuration
│   └── dashboard/page.tsx      # Dashboard principal
├── components/
│   ├── ui/                     # shadcn/ui
│   ├── onboarding/             # Composants onboarding
│   ├── dashboard/              # Calendrier, Optimisation, Compteurs
│   │   ├── SimpleHeader.tsx
│   │   ├── CalendarView.tsx    # Orchestrateur vues
│   │   ├── CalendarMonth.tsx
│   │   ├── CalendarWeek.tsx
│   │   ├── CalendarYear.tsx
│   │   ├── OptimizationModal.tsx  # Inclut section Épargne CET
│   │   ├── CombinationCard.tsx
│   │   ├── CountersDrawer.tsx
│   │   ├── CounterCard.tsx        # Bouton Détails (hover)
│   │   ├── CounterDetailsModal.tsx # Modal glassmorphism détails compteurs
│   │   └── DateRangePicker.tsx
│   └── shared/                 # ErrorBoundary, SW Registration
├── lib/
│   ├── types.ts                # Types TypeScript
│   ├── constants.ts            # Règles APORTT (CA_PAR_CYCLE, RTC, JS)
│   ├── calculations.ts         # Logique de calcul (avec cache)
│   ├── optimization.ts         # Algorithme combinaisons
│   ├── recommendations.ts      # Algorithme recommandations
│   ├── notifications.ts        # Système d'alertes
│   ├── export-pdf.ts           # Génération rapports PDF
│   ├── validation.ts           # Schémas Zod
│   └── storage.ts              # LocalStorage + migration
├── hooks/
│   ├── useCounters.ts
│   ├── useCycle.ts
│   ├── useNotifications.ts
│   └── useRecommendations.ts
├── public/                     # PWA (manifest, SW, icônes)
├── scripts/                    # setup-vps.sh, deploy.sh
└── docs/bmad/                  # Documentation BMAD (6 fichiers)
```

---

## Bugs corrigés (21 avril 2026) — iOS v1.1

- **Logo cassé sur iOS** (`next.config.ts`) : `next/image` génère des URLs `/_next/image?url=...` qui nécessitent un serveur — inexistant dans Capacitor (fichiers locaux). Fix : `images: { unoptimized: true }` dans le bloc Capacitor.
- **Thème sombre visible sur iOS** (`ios/App/App/Info.plist`) : sans `UIUserInterfaceStyle = Light`, iOS applique le dark mode au niveau WKWebView avant que le CSS/JS ne réagisse. Fix : ajout de la clé dans `Info.plist`.
- **Conformité export Apple** (`ios/App/App/Info.plist`) : ajout de `ITSAppUsesNonExemptEncryption = false` — évite la question manuelle à chaque soumission (app n'utilise aucun chiffrement propre, uniquement HTTPS natif iOS).
- **Reset annuel manquant** (`lib/storage.ts`) : `caPosesHorsPeriode`, `caHP`, `cfConsoS1/S2`, `caConsommes` n'étaient jamais remis à zéro en début d'année. Fix : `migrateUserData()` compare `lastResetYear` à l'année courante et remet les compteurs à zéro si nécessaire.
- **Recommandation CA HP mal formulée** (`lib/recommendations.ts`) : le texte suggérait "CA hors période" au lieu de "CA". Corrigé en "Poser X CA avant le 30 avril".

**Version iOS publiée :** `1.1 (Build 3)` — soumise en review le 2026-04-21.  
**`Info.plist` est stable** : `cap sync ios` ne touche pas ce fichier, les fixes sont permanents.

---

## Nouveaux compteurs (21 avril 2026) — Autres fonctionnaires

6 compteurs optionnels ajoutés pour les agents d'autres services :

| Compteur | Clé | Règle principale |
|----------|-----|-----------------|
| ARTT | `artt` | 20j/an, arrêté 3 mai 2002, conditionné par `hasARTT` |
| CA Antérieur | `caAnterieur` | Jours N-1 à consommer avant 30 avril, sinon perdus |
| CA HP Antérieur | `caHPAnterieur` | CA HP de l'année précédente, mêmes périodes HP |
| CET 2008 | `cet2008` | Solde gelé depuis 2010 (décret 2009-1065), conditionné par `hasCET2008` |
| Congés bonifiés | `congesBonifies` | 31j/24 mois (décret 2020-851), conditionné par `hasCongesBonifies` |
| HS Historique | `hsHistorique` | Solde gelé depuis 2020, taux 13,25€/h, en minutes |

**Fichiers modifiés :** `lib/types.ts`, `lib/constants.ts`, `lib/storage.ts` (migration + reset annuel), `lib/calculations.ts` (simulatePose), `lib/optimization.ts`, `lib/recommendations.ts`, `lib/validation.ts`, `components/dashboard/CountersOverview.tsx`, `components/dashboard/CounterDetailsModal.tsx`, `components/dashboard/LeaveList.tsx`, `hooks/useCounters.ts` (deleteHistoryEntry).

**Tests :** `lib/__tests__/simulatePose.test.ts` — 33 tests (pose + annulation round-trip pour les 6 types + isolation).

---

## Bugs corrigés (5 avril 2026) — Audit complet

- **`deleteHistoryEntry()` compteurs secondaires** (`hooks/useCounters.ts`) : la suppression d'un congé ne restaurait que le solde principal. Désormais :
  - Suppression CA → décrémente `caConsommes` + si pose hors période : décrémente `caPosesHorsPeriode` et retire le bonus CA HP si le seuil n'est plus atteint
  - Suppression CF → décrémente `cfConsoS1` ou `cfConsoS2` selon le semestre de la date de pose
- **Annulation épargne CET impossible** (`hooks/useCounters.ts`) : `deleteHistoryEntry()` gérait uniquement `action: 'pose'`. Supporte maintenant `action: 'transfer_cet'` (inverse le transfert : CA +X, CET -X)
- **Liste congés sans confirmation** (`CalendarView.tsx`) : la liste inline (fond vert, suppression directe) remplacée par le composant `LeaveList.tsx` avec dialog de confirmation, badges colorés par type, boutons Modifier/Supprimer — `LeaveList.tsx` affiche aussi les épargnes CET (badge "CET ↑ Épargne")
- **Cache de calculs invalide** (`lib/calculations.ts`) : `getCycleConfigHash()` n'incluait pas `semaineA`/`semaineB` → modification du planning sans invalidation de cache. Résolu.
- **`handleEditLeave()` ignorait les erreurs** (`app/dashboard/page.tsx`) : vérification du retour de `deleteHistoryEntry()` + toast d'erreur si échec
- **Suspense CountersDrawer sans feedback** (`app/dashboard/page.tsx`) : fallback visible (skeleton + spinner) pendant le chargement du drawer

---

## Bugs corrigés (23 mars 2026)

- **CA HP** : `simulatePose` manquait un `case 'caHP'` → pose maintenant correctement les CA HP (décrémente `counters.caHP`)
- **CET épargne vs utiliser** : séparation complète des deux flux dans `OptimizationModal` — "CET (utiliser)" pose les jours sur le calendrier via `poseConge`, la section "Épargner au CET" est désormais une UI dédiée séparée. Ajout de `case 'cet'` dans `simulatePose`.
- **Inputs numériques zéro** : `value={x || ''}` + `placeholder="0"` dans `CountersSetup` et `CounterDetailsModal` — évite le "50" au lieu de "5" lors de la saisie sur mobile.

---

## Optimisations Performance (23 mars 2026)

### Résultats Lighthouse (mobile throttled)

| URL | Score | FCP | LCP | TBT | CLS |
|-----|-------|-----|-----|-----|-----|
| `/onboarding` | **94** | 1.1 s | 2.9 s | 0 ms | 0 |
| `/` (home→dashboard) | **91** | 1.1 s | 3.2 s | 0 ms | 0 |

Scores accessibilité : **96**, bonnes pratiques : **100**, SEO : **100** (vérifié 5 avril 2026)

Score initial avant optimisations : **52** → **94** (+42 pts)

### Ce qui a été fait

1. **Lazy loading dashboard** — `OptimizationModal`, `CountersDrawer`, `NotificationsPanel`, `Settings`, `Projection` passés en `React.lazy()` dans `dashboard/page.tsx`

2. **Suppression Radix UI de l'onboarding** — `CycleSetup`, `CountersSetup`, `ObjectiveSetup` réécrit en HTML natif (`<button>`, `<select>`, `<input>`, `<label>`) — élimine `@radix-ui/react-select`, `@radix-ui/react-label`, `@radix-ui/react-progress` des chunks lazy

3. **Server Component pour `/onboarding/page.tsx`** — shell statique (fond, aurora, logo, h1) rendu en HTML immédiat → FCP 1.1 s. `OnboardingWizard` extrait en composant client séparé.

4. **`next/dynamic` avec SSR pour `CycleSetup`** — remplace `React.lazy()`. Avec SSR activé (défaut), Next.js rend `CycleSetup` dans le HTML initial → les cartes glass-dark sont LCP candidates dès FCP. TBT : 790 ms → **0 ms**. Score : 75 → **94**.

5. **Brotli compression Nginx** — `libnginx-mod-http-brotli-filter` + `libnginx-mod-http-brotli-static` installés sur le VPS, gain marginal sur JS (~7%)

### Architecture onboarding actuelle

```
app/onboarding/page.tsx         ← Server Component (HTML statique)
  └── OnboardingWizard.tsx      ← Client Component ('use client')
        ├── CycleSetup          ← next/dynamic (SSR=true, LCP candidate)
        └── CountersSetup       ← React.lazy() (step 2, pas LCP)
        # ObjectiveSetup supprimé — objectifCET auto-calculé au save
```

---

## Évolutions UI/UX (5 avril 2026)

### Thème bleu-blanc-rouge
- Toutes les couleurs indigo/violet remplacées par bleu (`#0055A4`) et rouge (`#EF4135`)
- `.gradient-primary` : `linear-gradient(135deg, #0055A4, #1a7de8)`
- `.text-gradient` : dégradé bleu → blanc → rouge (utilisé pour "My Chronos")
- Bande tricolore `h-[3px]` dans `SimpleHeader` (bas du header) et `h-1` dans `app/onboarding/page.tsx` (haut de page)
- `COUNTER_COLORS` dans `constants.ts` : indigo → blue, violet → red

### Titre "My Chronos"
- `SimpleHeader.tsx` : `text-2xl font-bold text-gradient` (était `text-xl`, était "Chronos")
- `app/onboarding/page.tsx` : `text-4xl font-bold` avec dégradé inline bleu-blanc-rouge

### Onboarding — thème clair + refonte
- `app/onboarding/page.tsx` : fond clair `#f8f9fc`, textes slate, bande tricolore en haut
- `CycleSetup.tsx` : thème clair complet ; cycles non-223223 et "Hebdomadaire" désactivés avec badge rouge "Prochainement" ; bouton "Continuer" en dégradé bleu-rouge ; ordre : Type → Rythme → Durée → Date réf → Sem A → Sem B
- `CountersSetup.tsx` : thème clair + système d'aide `(?)` par compteur — `HelpModal` avec `HELP_CONTENT` (cet, ca, caHP, cf, rtc, rtt, rps, hs), overlay blanc, bande tricolore, points bleus
- `OnboardingWizard.tsx` : wizard 2 étapes (cycle → compteurs) — étape "Objectif CET" supprimée ; `objectifCET` auto-calculé = `Math.min(CET_PLAFOND, data.cet + getCETApportMaxAnnee(data.cet))`

### Objectif CET automatique
- Plus de saisie manuelle d'objectif par l'utilisateur
- `calculateOptimalCETStrategy` cible toujours le maximum épargnables (`besoin = apportMax`)
- `notifications.ts` : alerte basée sur `Math.min(CET_PLAFOND - counters.cet, CET_APPORT_ANNUEL_MAX)` (plus d'`objectifCET`)

### Projection CET (onglet Profil)
- Redesign complet avec composant `SourceRow` dans `Projection.tsx`
- Prop `counters: Counters` ajouté pour afficher les soldes réels par source
- Double barre : bleu (CET actuel) + vert (apport possible)
- 4 sources toujours affichées : RTC, CA HP, CA classiques, HS — avec solde, jours vers CET, raison si désactivé

### Logo réel + fond transparent
- `public/logo.png` : logo IA personnalisé (calendrier + drapeau français + lauriers diamant) avec **fond transparent** — généré via flood-fill depuis les bords (script Python/Pillow)
- `app/onboarding/page.tsx` : remplace `icon.svg` par `logo.png` (88×88px)
- `CycleSetup.tsx` : icône calendrier bleue (lucide `Calendar`) supprimée — seuls le titre et sous-titre restent
- `CountersSetup.tsx` : icône calculatrice bleue (lucide `Calculator`) supprimée — seuls le titre et sous-titre restent
- `public/sw.js` : cache bumped `chronos-v1` → `chronos-v2` pour forcer le rechargement chez les utilisateurs existants

### Indicateur CA HP dans le calendrier
- `CalendarMonth.tsx` : bande inline dans le header, entre le titre "Calendrier" et les badges "Xj travaillés / X dim"
- Affiche : icône état + libellé période + barre de progression (marqueur au palier 50%) + compteur `X/8` + bulles ① ② (vertes si palier atteint)
- Paliers : 4 CA posés hors période = 1 CA HP, 8 CA = 2 CA HP (`CA_HP_PALIER_1 = 4` dans `constants.ts`)
- 3 états : vert (2 CA HP obtenus), bleu (période jan–avr / nov–déc = valide), ambre (période estivale mai–oct = non comptabilisé)
- `CalendarView.tsx` : passe `counters` à `CalendarMonth` ; plus de composant `CaHPBanner` standalone

---

## Règles métier APORTT

### Quotas annuels (cycle 12h08)

| Compteur | Quota | Deadline | Vers CET |
|----------|-------|----------|----------|
| CA | 18 jours | 31/12 | Max 5j |
| CA HP | 2 jours (bonus) | 31/12 | 2j |
| CF | 109h12 | Lisser sur l'année | Non |
| RTC brut | 285h13 | 31/12 | 10j (83h30) |
| RTC net | 175h01 (brut - JS 12h08 - indemnisables 97h04) | 31/12 | Partie |
| RPS | ~126h06/an | Illimité | Non |
| HS | Max 160h | Illimité | Max 5j |
| CET | Max 60j | - | +15j/an max |

### CA par cycle (ne pas hardcoder 25)

| Cycle | CA |
|-------|----|
| 4/2 | 23 |
| 2/2, 3/3, 2/2/3/2/2/3, VF | 18 |

### Journée de solidarité (JS)
- Déduit 1 journée de travail (12h08) des ARTT bruts
- Cycles 12h08, 11h08 et VF : **pas de compensation en HS**
- ARTT net = 285h13 - 12h08 = 273h05

### Abattement CF pour maladie
- CMO >= 15j consécutifs : déduction de 1/24ème du crédit annuel par période de 15j
- Exemple : 30j maladie = 2 x (109h12/24) = 9h06 déduits

### Priorité de consommation
1. **CF** - Lisser sur l'année (~54h36/semestre)
2. **CA excédentaires** (> 5 pour CET) - Perdus au 31/12
3. **RTC libres** (après 83h30 réservés) - Perdus au 31/12
4. **RPS/HS** - Réserves stratégiques

### CA HP — paliers
- **4 CA posés hors période** → 1 CA HP obtenu
- **8 CA posés hors période** → 2 CA HP obtenus (bonus complet)
- Périodes valides : 1er jan → 30 avr et 1er nov → 31 déc
- Période estivale (1er mai → 31 oct) : CA posés ne comptent PAS pour le bonus HP
- Constantes : `CA_HP_PALIER_1 = 4`, `CA_REQUIS_POUR_HP = 8`, `CA_HP_BONUS = 2`

### Potentiel CET à protéger
- 10j via RTC (83h30, coût réel 8h21/jour, gain 3h47/jour = +37h50/an)
- 5j CA classiques
- 2j CA HP (si 8 CA posés hors période)

### Système d'optimisation (scoring sur 100)
1. **Priorité (40pts)** - CF > CA excéd. > RTC libres > RPS > HS
2. **Éviter pertes (30pts)** - Pénalités si entame RTC réservés ou CA en HP
3. **Simplicité (20pts)** - 1 type = 20pts, 2 types = 15pts
4. **Optimisation CET (10pts)** - Bonus si garde RTC réservés + CA pour CET

---

## Profil utilisateur actuel

- Cycle 2/2/3/3 jour (07h00-19h08, DMJ 12h08)
- 18 CA, 175h01 RTC net
- Un dimanche sur deux
- `dateDebutCycle: '2026-01-06'`, `semaineActuelle: 'B'`

---

## Commandes développement

```bash
cd "/Users/amreen/Documents/1 - Projets IA/chronos"
npm run dev            # Dev (http://localhost:3000)
npm run build          # Build production
npm start              # Lancer production
npm test               # Tests
npm run test:coverage  # Tests avec couverture
```

---

## Déploiement VPS OVH

### Accès

| Info | Valeur |
|------|--------|
| IP | 51.254.203.30 |
| Domaine | mychronos.fr |
| OS | Ubuntu 25.04 |
| SSH | `ssh chronos-vps` ou `ssh root@51.254.203.30` |
| Auth | Clé SSH (`~/.ssh/id_ed25519`) |
| App path | `/var/www/chronos` |
| SSL | Let's Encrypt (auto-renew, expire ~juillet 2026) |

### Stack serveur
Node.js v22.22.0, PM2 (process manager), Nginx (reverse proxy + SSL)

### Déployer une mise à jour

```bash
# Depuis le Mac
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  -e ssh . root@51.254.203.30:/var/www/chronos/

# Build + restart sur le VPS
ssh chronos-vps "cd /var/www/chronos && npm install && npm run build && pm2 restart chronos"
```

### Commandes VPS utiles

```bash
ssh chronos-vps "pm2 status"              # Status app
ssh chronos-vps "pm2 logs chronos"        # Logs temps réel
ssh chronos-vps "pm2 restart chronos"     # Redémarrer
ssh chronos-vps "nginx -t"               # Tester config Nginx
ssh chronos-vps "systemctl restart nginx" # Redémarrer Nginx
ssh chronos-vps "certbot renew"          # Renouveler SSL
```

### Chemins serveur

| Chemin | Description |
|--------|-------------|
| `/var/www/chronos` | Code source |
| `/etc/nginx/sites-available/chronos` | Config Nginx |
| `/etc/letsencrypt/live/mychronos.fr/` | Certificat SSL |

---

## Publication iOS (App Store)

### Infos

| Info | Valeur |
|------|--------|
| Bundle ID | `fr.mychronos.app` |
| App Store Connect App ID | `6762043430` |
| Certificat | `Apple Distribution: Yoan Rolin (MTBUU2T4WW)` (expire 2027-04-11) |
| Profil | `MyChronos AppStore` (UUID `6a73668b-8e19-4dff-b83e-469c8844793a`) |
| Version actuelle | `1.1 (Build 3)` — en review Apple depuis 2026-04-21 |

### ⚠️ Bug critique résolu : accent dans PRODUCT_NAME

Le binaire ne doit **pas** contenir d'accents dans son nom (problème NFC/NFD HFS+). `codesign` hashait un nom, retrouvait l'autre → sealed resource mismatch → erreur Apple 90034.

**Fix permanent dans `ios/App/App.xcodeproj/project.pbxproj`** (configs Debug ET Release) :
```
PRODUCT_NAME = "MyChronos";   ← PAS "MyChronos - Gestion des congés"
```
`CFBundleDisplayName = "Chronos"` dans `Info.plist` reste inchangé → nom affiché sur iOS correct.

### ⚠️ `npx cap sync ios` réinitialise le pbxproj

Chaque `cap sync` régénère `project.pbxproj` et efface le signing. **Après chaque sync**, réappliquer dans la config Release (`504EC3181FED79650016851F`) :

```
PRODUCT_NAME = "MyChronos";
"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";
CODE_SIGN_STYLE = Manual;
DEVELOPMENT_TEAM = MTBUU2T4WW;
PROVISIONING_PROFILE_SPECIFIER = "MyChronos AppStore";
```
Et idem pour le `PRODUCT_NAME` dans la config Debug.

### Workflow complet (CLI)

```bash
cd "/Users/amreen/Documents/1 - Projets IA/chronos"

# 1. Build statique + sync Capacitor
BUILD_TARGET=capacitor npm run build
npx cap sync ios

# 2. Corriger le pbxproj (voir ci-dessus)

# 3. Archive
xcodebuild archive \
  -scheme App -configuration Release \
  -archivePath /tmp/chronos.xcarchive \
  -destination "generic/platform=iOS"

# 4. Vérifier la signature
codesign --verify --deep --strict /tmp/chronos.xcarchive/Products/Applications/MyChronos.app

# 5. Upload App Store Connect
xcodebuild -exportArchive \
  -archivePath /tmp/chronos.xcarchive \
  -exportPath /tmp/chronos-upload \
  -exportOptionsPlist /tmp/ExportOptionsUpload.plist
```

Contenu de `/tmp/ExportOptionsUpload.plist` :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>app-store-connect</string>
    <key>teamID</key><string>MTBUU2T4WW</string>
    <key>signingStyle</key><string>manual</string>
    <key>signingCertificate</key><string>Apple Distribution</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>fr.mychronos.app</key><string>MyChronos AppStore</string>
    </dict>
    <key>uploadBitcode</key><false/>
    <key>uploadSymbols</key><true/>
    <key>destination</key><string>upload</string>
</dict>
</plist>
```

### Modifications Capacitor dans le projet Next.js

- `next.config.ts` : export statique conditionnel via `BUILD_TARGET=capacitor`
- `app/page.tsx` : redirect client-side `/` → `/dashboard` (remplace le rewrite Next.js)
- `capacitor.config.ts` : `webDir: 'out'`, `ios.contentInset: 'always'`
- `Info.plist` : `CFBundleDisplayName = "Chronos"`
