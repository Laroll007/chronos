# Chronos - Gestion optimisee des conges policiers

Application web moderne pour aider les policiers francais a optimiser la gestion de leurs conges et repos selon les regles APORTT. L'objectif est de maximiser l'epargne au CET (Compte Epargne Temps) et d'eviter la perte de jours.

## Fonctionnalites

### Dashboard Interactif
- **Calendrier central** : 3 vues (mois, semaine, annee) avec selection intuitive
- **Optimisation intelligente** : Toutes les combinaisons possibles triees par score
- **Notifications** : Alertes deadline avec rappels navigateur
- **Graphique evolution** : Visualisation historique des compteurs (Recharts)
- **Export PDF** : Rapports annuels et recapitulatifs CET imprimables

### Systeme d'Optimisation
- Selection de periode en 2 clics sur le calendrier
- Generation automatique de toutes les combinaisons valides
- Score sur 100 points : priorite (40pts) + pertes evitees (30pts) + simplicite (20pts) + CET (10pts)
- Avantages et inconvenients explicites pour chaque option

### Regles metier APORTT

| Compteur | Quota annuel | Deadline | Vers CET |
|----------|--------------|----------|----------|
| CA | 18 jours | 31/12 | Max 5j |
| CA HP | 2 jours (bonus) | 31/12 | 2j |
| CF | 109h12 (54h36/sem) | Lisser | Non |
| RTC | 175h01 (net) | 31/12 | 10j (83h30) |
| RPS | ~126h06/an | Illimite | Non |
| HS | Max 160h | Illimite | Max 5j |
| CET | Max 60j | - | +15j/an max |

### Particularite RTC -> CET
- **Cout reel** : 8h21 pour 1 jour CET
- **Valeur normale** : 12h08 par jour
- **Gain** : 3h47 par jour converti
- **83h30 a reserver = 10 jours CET = 37h50 de gain annuel**

## Installation

```bash
# Cloner le projet
cd chronos

# Installer les dependances
npm install

# Lancer en developpement
npm run dev

# Build production
npm run build
npm start

# Tests
npm test
npm run test:coverage
```

## PWA (Progressive Web App)

Chronos est une PWA complete :
- Installation sur l'ecran d'accueil (mobile/desktop)
- Fonctionnement hors-ligne grace au Service Worker
- Notifications push pour les alertes deadline
- Mise en cache automatique des ressources

## Stack technique

- **Framework** : Next.js 16 (App Router, Turbopack)
- **UI** : shadcn/ui + Tailwind CSS 4
- **Graphiques** : Recharts
- **Validation** : Zod
- **Tests** : Vitest + Testing Library
- **Stockage** : localStorage (100% local, aucune donnee transmise)
- **Design** : Light mode, Glassmorphism, Mobile-first

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
│   └── shared/                 # ErrorBoundary, SW Registration
├── lib/
│   ├── types.ts                # Types TypeScript
│   ├── constants.ts            # Regles APORTT
│   ├── calculations.ts         # Logique de calcul (avec cache)
│   ├── optimization.ts         # Algorithme combinaisons
│   ├── recommendations.ts      # Algorithme recommandations
│   ├── notifications.ts        # Systeme d'alertes
│   ├── export-pdf.ts           # Generation rapports PDF
│   ├── validation.ts           # Schemas Zod
│   └── storage.ts              # LocalStorage
├── hooks/
│   ├── useCounters.ts          # Gestion etat
│   ├── useCycle.ts             # Calculs cycle
│   ├── useNotifications.ts     # Alertes et permissions
│   └── useRecommendations.ts   # Recommandations
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   └── icons/                  # Icones PWA (72-512px)
└── scripts/
    └── generate-icons.js       # Generation icones depuis SVG
```

## Performance

Optimisations React implementees :
- `React.memo` sur les composants calendrier
- `useCallback` pour eviter les re-renders
- `lazy` + `Suspense` pour le chargement different
- Cache Map pour les calculs de cycle (getWeekType, isWorkingDay)

## Securite & Confidentialite

- 100% local : Toutes les donnees restent sur votre appareil
- Aucun compte : Pas de login, pas de serveur
- RGPD-proof : Aucune donnee transmise
- Offline-first : Fonctionne sans internet
- Export/Import : Sauvegardez vos donnees en JSON

## Utilisation

1. **Configuration initiale** : Definissez votre cycle de travail (alterne A/B ou hebdo)
2. **Saisie des compteurs** : Entrez vos soldes actuels
3. **Objectif CET** : Fixez votre objectif de fin d'annee
4. **Selection** : Cliquez sur 2 dates dans le calendrier
5. **Optimisation** : Choisissez la meilleure combinaison proposee

## Algorithme de recommandation

Priorite de consommation pour eviter les pertes :
1. **CF** (lisser sur l'annee) - pas de deadline stricte
2. **CA excedentaires** (au-dela des 5 pour CET)
3. **RTC libres** (apres reserve 83h30 pour CET)
4. **RPS/HS** - reserves strategiques (dernier recours)

## Tests

```bash
# Tous les tests
npm test

# Avec couverture
npm run test:coverage

# Tests unitaires inclus :
# - validation.test.ts : Schemas Zod (58 tests)
# - constants.test.ts : Valeurs APORTT (64 tests)
# - calculations.test.ts : Logique metier
```

## Deploiement

```bash
# Build
npm run build

# Deployer sur Vercel
npx vercel
```

---

Developpe avec Next.js 16, React 19, shadcn/ui et Tailwind CSS 4.
