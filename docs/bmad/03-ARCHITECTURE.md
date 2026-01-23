# Architecture Technique - Chronos

**Version:** 2.0
**Date:** 22 janvier 2026
**Statut:** Documenté

---

## 1. Vue d'Ensemble

### 1.1 Diagramme Système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHRONOS                                         │
│                         (100% Client-Side)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│   │   NEXT.JS   │    │   REACT     │    │  TAILWIND   │    │  SHADCN/UI  │  │
│   │   16.1.1    │    │   19.2.3    │    │   CSS 4     │    │   (Radix)   │  │
│   │             │    │             │    │             │    │             │  │
│   │  App Router │    │  Hooks      │    │  Styling    │    │  Components │  │
│   │  SSG/ISR    │    │  State      │    │  Theming    │    │  Primitives │  │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                        APPLICATION LAYER                              │  │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │  │
│   │  │    app/    │  │ components/│  │   hooks/   │  │    lib/    │      │  │
│   │  │            │  │            │  │            │  │            │      │  │
│   │  │ • page.tsx │  │ • ui/      │  │ useCounters│  │ types.ts   │      │  │
│   │  │ • layout   │  │ • dashboard│  │ useCycle   │  │ constants  │      │  │
│   │  │ • dashboard│  │ • onboard  │  │ useReco    │  │ calculations│     │  │
│   │  │ • onboard  │  │ • shared   │  │ useStorage │  │ optimization│     │  │
│   │  └────────────┘  └────────────┘  └────────────┘  │ storage    │      │  │
│   │                                                   │ recommend  │      │  │
│   │                                                   └────────────┘      │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                        PERSISTENCE LAYER                              │  │
│   │                                                                        │  │
│   │                     ┌─────────────────────┐                           │  │
│   │                     │    localStorage     │                           │  │
│   │                     │                     │                           │  │
│   │                     │  • UserData         │                           │  │
│   │                     │  • CycleConfig      │                           │  │
│   │                     │  • Counters         │                           │  │
│   │                     │  • History          │                           │  │
│   │                     └─────────────────────┘                           │  │
│   │                                                                        │  │
│   │                        🔒 ZERO NETWORK                                 │  │
│   │                        🔒 100% LOCAL                                   │  │
│   │                        🔒 RGPD COMPLIANT                               │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Principes Architecturaux

| Principe | Implémentation |
|----------|----------------|
| **Privacy-First** | localStorage uniquement, zéro serveur |
| **Offline-First** | Fonctionne sans connexion |
| **Type-Safe** | TypeScript strict, pas de `any` |
| **Modular** | Séparation claire UI/logique/état |
| **Stateless** | Pas de session, tout dans localStorage |

---

## 2. Structure des Dossiers

```
chronos/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Layout racine (metadata, providers)
│   ├── page.tsx                  # Redirection vers dashboard
│   ├── dashboard/
│   │   └── page.tsx              # Page principale (223 lignes)
│   └── onboarding/
│       └── page.tsx              # Wizard configuration
│
├── components/                   # Composants React
│   ├── ui/                       # 16 shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── tabs.tsx
│   │   ├── progress.tsx
│   │   └── ...
│   │
│   ├── dashboard/                # 18 composants métier
│   │   ├── CalendarView.tsx      # Orchestrateur calendrier
│   │   ├── CalendarMonth.tsx     # Vue mois
│   │   ├── CalendarWeek.tsx      # Vue semaine
│   │   ├── CalendarYear.tsx      # Vue année
│   │   ├── DateRangePicker.tsx   # Sélection période
│   │   ├── OptimizationModal.tsx # Modal combinaisons
│   │   ├── CombinationCard.tsx   # Carte combinaison
│   │   ├── CountersDrawer.tsx    # Drawer compteurs
│   │   ├── CountersModal.tsx     # Modal détail
│   │   └── ...
│   │
│   ├── onboarding/               # 3 composants wizard
│   │   ├── CycleSetup.tsx
│   │   ├── CountersSetup.tsx
│   │   └── GoalSetup.tsx
│   │
│   └── shared/                   # Composants partagés
│       └── ThemeToggle.tsx
│
├── hooks/                        # React Hooks personnalisés
│   ├── useCounters.ts            # État principal (172 lignes)
│   ├── useCycle.ts               # Calculs cycle A/B
│   ├── useRecommendations.ts     # Génération recommandations
│   └── useLocalStorage.ts        # Abstraction localStorage
│
├── lib/                          # Logique métier pure
│   ├── types.ts                  # Définitions TypeScript (198 lignes)
│   ├── constants.ts              # Constantes APORTT (228 lignes)
│   ├── calculations.ts           # Calculs métier (588 lignes)
│   ├── optimization.ts           # Algorithme scoring (498 lignes)
│   ├── recommendations.ts        # Stratégies reco (361 lignes)
│   ├── storage.ts                # Persistance (349 lignes)
│   └── utils.ts                  # Utilitaires
│
├── public/                       # Assets statiques
│   └── favicon.ico
│
├── docs/                         # Documentation BMAD
│   └── bmad/
│
└── Configuration
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.ts
    └── components.json           # shadcn/ui config
```

---

## 3. Flux de Données

### 3.1 Flux Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUX DE DONNÉES                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │  User Click │
                    │  (Calendar) │
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   DateRangePicker      │
              │   • startDate          │
              │   • endDate            │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   CalendarView         │
              │   • countWorkingDays() │
              │   • validate period    │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   OptimizationModal    │
              │   • isOpen = true      │
              └───────────┬────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────┐
    │           generateAllCombinations()              │
    │                                                  │
    │   for each counterType:                         │
    │     for each amount (1 to available):           │
    │       combination = createCombination()         │
    │       score = calculateScore()                  │
    │       if valid: add to results                  │
    │                                                  │
    │   return results.sort(by: score).slice(0, 100) │
    └─────────────────────┬───────────────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   CombinationCard[]    │
              │   • display score      │
              │   • show breakdown     │
              │   • action: Apply      │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   handleApplyCombination│
              │   • poseConge() × N    │
              │   • updateCounters()   │
              │   • save to localStorage│
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   useCounters          │
              │   • state updated      │
              │   • re-render UI       │
              └────────────────────────┘
```

### 3.2 Flux Persistance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUX PERSISTANCE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │   LECTURE    │         │   ÉCRITURE   │         │  MIGRATION   │
    └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
           │                        │                        │
           ▼                        ▼                        ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │ getUserData()│         │saveUserData()│         │migrateData() │
    │              │         │              │         │              │
    │ localStorage │         │ localStorage │         │ check version│
    │ .getItem()   │         │ .setItem()   │         │ apply fixes  │
    │              │         │              │         │ save updated │
    │ JSON.parse() │         │ JSON.stringify│        │              │
    │              │         │              │         │              │
    │ validate()   │         │              │         │              │
    └──────────────┘         └──────────────┘         └──────────────┘

    Clé: "chronos-user-data"
    Format: JSON
    Quota: ~5-10MB (navigateur)
```

---

## 4. Modèle de Données

### 4.1 Schéma Principal

```typescript
// lib/types.ts

interface UserData {
  cycleConfig: CycleConfig;
  counters: Counters;
  history: HistoryEntry[];
  isOnboarded: boolean;
}

interface CycleConfig {
  pattern: CycleType;           // '2/2/3/2/2/3' | '4/2' | 'hebdomadaire'
  startDate: string;            // ISO date du cycle A
  workdayDuration: number;      // Minutes (728 = 12h08)
  sundayFrequency: 'every' | 'alternate';
}

interface Counters {
  // Soldes actuels (minutes sauf CA/CET en jours)
  ca: number;                   // Congés Annuels (jours)
  caHP: number;                 // CA Hors Période (jours)
  cf: number;                   // Congés Forfaitaires (minutes)
  rtc: number;                  // Récup Temps Compensateur (minutes)
  rtt: number;                  // RTT (minutes)
  rps: number;                  // Repos Pénibilité (minutes)
  hs: number;                   // Heures Sup (minutes)
  cet: number;                  // Compte Épargne Temps (jours)

  // Consommations tracking
  caConsoSemestre1: number;     // CA posés S1
  caConsoHorsPeriode: number;   // CA posés hors juil-août
  cfConsoSemestre1: number;     // CF posés S1
}

interface HistoryEntry {
  date: string;                 // ISO date
  type: CounterType;
  amount: number;
  description: string;
  periodStart?: string;
  periodEnd?: string;
}

type CounterType = 'ca' | 'caHP' | 'cf' | 'rtc' | 'rtt' | 'rps' | 'hs' | 'cet';
type CycleType = '2/2/3/2/2/3' | '4/2' | 'hebdomadaire' | 'personnalisé';
```

### 4.2 Schéma Combinaison

```typescript
// lib/types.ts

interface Combination {
  id: string;
  items: CombinationItem[];
  totalDays: number;
  score: number;                // 0-100
  breakdown: ScoreBreakdown;
}

interface CombinationItem {
  type: CounterType;
  amount: number;               // Jours ou heures selon type
  amountMinutes?: number;       // Valeur en minutes
}

interface ScoreBreakdown {
  priority: number;             // 0-40 pts
  avoidLoss: number;            // 0-30 pts
  simplicity: number;           // 0-20 pts
  cetOptimization: number;      // 0-10 pts
}
```

### 4.3 Constantes APORTT

```typescript
// lib/constants.ts

// Quotas annuels
export const CA_ANNUEL_12H = 18;           // jours (cycle 12h08)
export const CA_ANNUEL_4_2 = 23;           // jours (cycle 4/2)
export const CF_ANNUEL = 6552;             // minutes (109h12)
export const RTC_BRUT_ANNUEL = 11229;      // minutes (187h09)
export const RTC_NET_ANNUEL = 10501;       // minutes (175h01)
export const JOURNEE_SOLIDARITE = 728;     // minutes (12h08)

// Conversions CET
export const RTC_PAR_JOUR_CET = 501;       // minutes (8h21)
export const RTC_RESERVES_CET = 5010;      // minutes pour 10 jours
export const CET_MAX = 60;                 // jours maximum
export const CET_GAIN_MAX_ANNUEL = 15;     // jours/an

// Deadlines
export const DEADLINE_CA = '12-31';        // 31 décembre
export const DEADLINE_CF_S1 = '06-30';     // 30 juin
export const DEADLINE_CF_S2 = '12-31';     // 31 décembre

// Priorités optimisation
export const PRIORITIES = ['cf', 'ca', 'caHP', 'rtc', 'rtt', 'rps', 'hs'];
```

---

## 5. Algorithme d'Optimisation

### 5.1 Score Multi-Critères

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CALCUL DU SCORE (0-100)                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    SCORE = PRIORITY (40) + AVOID_LOSS (30) + SIMPLICITY (20) + CET (10)

    ┌──────────────────────────────────────────────────────────────────────┐
    │  PRIORITY (40 points max)                                            │
    │                                                                       │
    │  Ordre de priorité:                                                  │
    │  1. CF  → 40 pts (deadline proche, non convertible CET)             │
    │  2. CA  → 35 pts (deadline 31/12)                                   │
    │  3. CAHP → 30 pts (bonus, deadline 31/12)                           │
    │  4. RTC → 25 pts (convertible CET)                                  │
    │  5. RTT → 20 pts (selon cycle)                                      │
    │  6. RPS → 15 pts (cumul illimité)                                   │
    │  7. HS  → 10 pts (paiement alternatif)                              │
    └──────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────────┐
    │  AVOID_LOSS (30 points max)                                          │
    │                                                                       │
    │  Si congé serait perdu sans utilisation:                            │
    │  • CA proche deadline + solde élevé → +30 pts                       │
    │  • CF fin semestre → +25 pts                                        │
    │  • RTC réserves CET entamées → +20 pts                              │
    └──────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────────┐
    │  SIMPLICITY (20 points max)                                          │
    │                                                                       │
    │  • 1 seul type de congé → 20 pts                                    │
    │  • 2 types → 15 pts                                                 │
    │  • 3+ types → 10 pts                                                │
    │  • Bonus: arrondi journée complète → +5 pts                         │
    └──────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────────┐
    │  CET_OPTIMIZATION (10 points max)                                    │
    │                                                                       │
    │  • Préserve jours convertibles CET → +10 pts                        │
    │  • Utilise RPS/HS avant RTC → +5 pts                                │
    │  • Maximise épargne future → +3 pts                                 │
    └──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Génération des Combinaisons

```typescript
// lib/optimization.ts (simplifié)

function generateAllCombinations(
  workingDays: number,
  counters: Counters,
  cycleConfig: CycleConfig
): Combination[] {
  const results: Combination[] = [];

  // 1. Combinaisons pures (un seul type)
  for (const type of PRIORITIES) {
    const available = getAvailable(type, counters);
    for (let amount = 1; amount <= Math.min(available, workingDays); amount++) {
      if (amount === workingDays) {
        const combo = createCombination(type, amount, counters);
        results.push(combo);
      }
    }
  }

  // 2. Combinaisons mixtes (deux types)
  for (let i = 0; i < PRIORITIES.length; i++) {
    for (let j = i + 1; j < PRIORITIES.length; j++) {
      const type1 = PRIORITIES[i];
      const type2 = PRIORITIES[j];
      const avail1 = getAvailable(type1, counters);
      const avail2 = getAvailable(type2, counters);

      for (let a1 = 1; a1 < Math.min(avail1, workingDays); a1++) {
        const a2 = workingDays - a1;
        if (a2 > 0 && a2 <= avail2) {
          const combo = createMixedCombination(type1, a1, type2, a2, counters);
          results.push(combo);
        }
      }
    }
  }

  // 3. Tri par score décroissant
  results.sort((a, b) => b.score - a.score);

  // 4. Limite à 100 résultats
  return results.slice(0, 100);
}
```

---

## 6. Composants Clés

### 6.1 Hiérarchie des Composants

```
app/dashboard/page.tsx (DashboardPage)
│
├── CalendarView
│   ├── DateRangePicker
│   │   ├── CalendarMonth
│   │   ├── CalendarWeek
│   │   └── CalendarYear
│   │
│   └── ViewSelector (tabs)
│
├── OptimizationModal
│   ├── CombinationCard[]
│   │   └── ScoreBreakdown
│   └── ApplyButton
│
├── CountersDrawer
│   ├── CounterSummary[]
│   └── AlertList
│
└── Header
    ├── ThemeToggle
    └── CountersButton
```

### 6.2 État et Props Flow

```
                    ┌─────────────────────────────────┐
                    │         DashboardPage           │
                    │                                 │
                    │  const { counters, updateCounter,│
                    │          poseConge } = useCounters()│
                    │                                 │
                    │  const { recommendations } =     │
                    │          useRecommendations()   │
                    │                                 │
                    │  const [selectedRange, setRange]│
                    │  const [isModalOpen, setModal]  │
                    └───────────────┬─────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  CalendarView │          │ Optimization  │          │  Counters     │
│               │          │    Modal      │          │   Drawer      │
│ Props:        │          │               │          │               │
│ • cycleConfig │          │ Props:        │          │ Props:        │
│ • onSelect    │          │ • isOpen      │          │ • counters    │
│   (range)     │          │ • period      │          │ • alerts      │
│               │          │ • counters    │          │               │
│ Emits:        │          │ • onApply     │          │               │
│ • dateRange   │          │               │          │               │
└───────────────┘          │ Emits:        │          └───────────────┘
                           │ • combination │
                           └───────────────┘
```

---

## 7. Décisions Architecturales (ADR)

### ADR-001: 100% Client-Side

**Contexte:** Données sensibles (planning travail police)

**Décision:** Aucun serveur, 100% localStorage

**Conséquences:**
- ✅ RGPD compliant by design
- ✅ Offline-first
- ✅ Pas d'infrastructure à maintenir
- ❌ Pas de sync multi-appareils
- ❌ Limite 5-10MB localStorage

### ADR-002: TypeScript Strict

**Contexte:** Règles APORTT complexes, calculs financiers

**Décision:** `strict: true`, zéro `any`

**Conséquences:**
- ✅ Erreurs détectées à la compilation
- ✅ Refactoring sûr
- ✅ Documentation implicite
- ❌ Plus de code de typage

### ADR-003: Pas de State Manager Externe

**Contexte:** App de taille moyenne, état prévisible

**Décision:** React hooks (useState, useContext) + localStorage

**Conséquences:**
- ✅ Moins de dépendances
- ✅ Courbe d'apprentissage faible
- ✅ Bundle size réduit
- ❌ Pas de time-travel debugging
- ❌ Props drilling possible

### ADR-004: shadcn/ui

**Contexte:** Besoin de composants accessibles et personnalisables

**Décision:** shadcn/ui (copy-paste components)

**Conséquences:**
- ✅ Contrôle total du code
- ✅ Basé sur Radix (accessible)
- ✅ Personnalisation facile
- ❌ Mises à jour manuelles

---

## 8. Évolutions Techniques Recommandées

### 8.1 Court Terme (Q1 2026)

| Amélioration | Fichiers concernés | Impact |
|--------------|-------------------|--------|
| useCallback sur handlers | `dashboard/page.tsx` | Performance |
| React.memo sur calendriers | `Calendar*.tsx` | Performance |
| Validation zod | `storage.ts` | Sécurité |
| Cache WeekType | `calculations.ts` | Performance |

### 8.2 Moyen Terme (Q2 2026)

| Amélioration | Fichiers concernés | Impact |
|--------------|-------------------|--------|
| Tests Vitest | `lib/__tests__/` | Qualité |
| Error Boundary | `app/layout.tsx` | Stabilité |
| Lazy loading modales | `components/dashboard/` | Bundle |
| Service Worker | `public/sw.js` | Offline |

### 8.3 Long Terme (Q3+ 2026)

| Amélioration | Fichiers concernés | Impact |
|--------------|-------------------|--------|
| Web Worker optimisation | `lib/optimization.ts` | Performance |
| IndexedDB (gros historique) | `lib/storage.ts` | Scalabilité |
| PWA manifest | `public/manifest.json` | Mobile |
