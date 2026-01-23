# Backlog Priorisé - Chronos

**Version:** 2.0
**Date:** 22 janvier 2026
**Méthode:** BMAD (Business Model Architecture Design)

---

## 1. Vue d'Ensemble du Backlog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKLOG CHRONOS v2.0                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   🔴 CRITIQUE (Sprint 1-2)      │   🟡 HAUTE (Sprint 3-4)                   │
│   ─────────────────────────────  │   ─────────────────────────────           │
│   • Accessibilité base           │   • Tests unitaires                       │
│   • Validation import            │   • Performance React                     │
│   • Error handling               │   • Notifications deadline                │
│                                  │   • Export PDF                            │
│                                  │                                           │
│   🟢 MOYENNE (Sprint 5-6)       │   🔵 BASSE (Backlog)                      │
│   ─────────────────────────────  │   ─────────────────────────────           │
│   • Historique graphique         │   • Multi-utilisateurs                    │
│   • Cache performance            │   • App mobile                            │
│   • PWA manifest                 │   • Import SIRH                           │
│                                  │   • Partage anonyme                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Total: 42 items | Done: 28 | In Progress: 0 | Backlog: 14
```

---

## 2. Sprint Backlog Détaillé

### 🔴 Sprint 1 : Accessibilité Critique (Semaine 1-2)

**Objectif:** Conformité WCAG AA minimale

| ID | Tâche | Type | Fichier(s) | Effort | Status |
|----|-------|------|------------|--------|--------|
| A11Y-001 | Remplacer `alert()` par Toast accessible | Bug | `CalendarView.tsx:32` | XS | 📋 TODO |
| A11Y-002 | Ajouter aria-labels sur boutons calendrier | Feature | `CalendarMonth.tsx`, `CalendarWeek.tsx`, `CalendarYear.tsx` | S | 📋 TODO |
| A11Y-003 | Ajouter aria-label sur DateRangePicker | Feature | `DateRangePicker.tsx` | XS | 📋 TODO |
| A11Y-004 | Ajouter aria-label sur ViewSelector tabs | Feature | `CalendarView.tsx` | XS | 📋 TODO |
| A11Y-005 | Focus management dans OptimizationModal | Feature | `OptimizationModal.tsx` | S | 📋 TODO |
| A11Y-006 | Indicateurs textuels pour scores (pas que couleur) | Feature | `CombinationCard.tsx` | S | 📋 TODO |
| A11Y-007 | Keyboard navigation calendrier (arrows) | Feature | `CalendarMonth.tsx` | M | 📋 TODO |

**Définition of Done:**
- [ ] Lighthouse a11y score > 80
- [ ] Navigation clavier testée
- [ ] Pas d'alert() dans le code

---

### 🔴 Sprint 2 : Validation & Error Handling (Semaine 3-4)

**Objectif:** Robustesse et sécurité des données

| ID | Tâche | Type | Fichier(s) | Effort | Status |
|----|-------|------|------------|--------|--------|
| VAL-001 | Installer et configurer Zod | Setup | `package.json`, `lib/validation.ts` | XS | 📋 TODO |
| VAL-002 | Créer schémas Zod pour UserData | Feature | `lib/validation.ts` | M | 📋 TODO |
| VAL-003 | Remplacer validateUserData par Zod | Refactor | `lib/storage.ts:326` | S | 📋 TODO |
| VAL-004 | Validation stricte import JSON | Feature | `lib/storage.ts:279-316` | S | 📋 TODO |
| VAL-005 | Validation dates onboarding | Feature | `CycleSetup.tsx` | S | 📋 TODO |
| ERR-001 | Créer classe ChronosError | Feature | `lib/errors.ts` | S | 📋 TODO |
| ERR-002 | Implémenter Error Boundary global | Feature | `app/layout.tsx` | M | 📋 TODO |
| ERR-003 | Centraliser logging erreurs | Feature | `lib/logger.ts` | S | 📋 TODO |
| ERR-004 | Remplacer console.error par logger | Refactor | `lib/storage.ts` (9 occurrences) | S | 📋 TODO |

**Définition of Done:**
- [ ] Import invalide = message d'erreur clair (pas crash)
- [ ] Zéro console.error en production
- [ ] Error boundary attrape toutes les erreurs React

---

### 🟡 Sprint 3 : Tests Unitaires (Semaine 5-6)

**Objectif:** 80% coverage sur lib/

| ID | Tâche | Type | Fichier(s) | Effort | Status |
|----|-------|------|------------|--------|--------|
| TEST-001 | Setup Vitest + Testing Library | Setup | `package.json`, `vitest.config.ts` | S | 📋 TODO |
| TEST-002 | Tests calculations.ts (RTC, CA, CET) | Test | `lib/__tests__/calculations.test.ts` | L | 📋 TODO |
| TEST-003 | Tests optimization.ts (scoring) | Test | `lib/__tests__/optimization.test.ts` | L | 📋 TODO |
| TEST-004 | Tests storage.ts (migrations) | Test | `lib/__tests__/storage.test.ts` | M | 📋 TODO |
| TEST-005 | Tests recommendations.ts | Test | `lib/__tests__/recommendations.test.ts` | M | 📋 TODO |
| TEST-006 | Tests constants.ts (valeurs APORTT) | Test | `lib/__tests__/constants.test.ts` | S | 📋 TODO |
| TEST-007 | Setup CI GitHub Actions | Setup | `.github/workflows/test.yml` | S | 📋 TODO |

**Définition of Done:**
- [ ] Coverage lib/ > 80%
- [ ] CI passe sur chaque PR
- [ ] Tous les calculs APORTT testés

---

### 🟡 Sprint 4 : Performance React (Semaine 7-8)

**Objectif:** Éliminer re-renders inutiles

| ID | Tâche | Type | Fichier(s) | Effort | Status |
|----|-------|------|------------|--------|--------|
| PERF-001 | useCallback sur handleApplyCombination | Refactor | `app/dashboard/page.tsx:62-89` | XS | 📋 TODO |
| PERF-002 | React.memo sur CalendarMonth | Refactor | `components/dashboard/CalendarMonth.tsx` | S | 📋 TODO |
| PERF-003 | React.memo sur CalendarWeek | Refactor | `components/dashboard/CalendarWeek.tsx` | S | 📋 TODO |
| PERF-004 | React.memo sur CalendarYear | Refactor | `components/dashboard/CalendarYear.tsx` | S | 📋 TODO |
| PERF-005 | React.memo sur CombinationCard | Refactor | `components/dashboard/CombinationCard.tsx` | XS | 📋 TODO |
| PERF-006 | Cache WeekType avec Map | Feature | `lib/calculations.ts` | M | 📋 TODO |
| PERF-007 | Cache isWorkingDay | Feature | `lib/calculations.ts` | S | 📋 TODO |
| PERF-008 | Lazy load OptimizationModal | Refactor | `app/dashboard/page.tsx` | S | 📋 TODO |
| PERF-009 | Réduire dépendances useEffect optimization | Refactor | `OptimizationModal.tsx:42-56` | M | 📋 TODO |

**Définition of Done:**
- [ ] React DevTools Profiler : pas de re-render inutile
- [ ] Génération combinaisons < 200ms (30 jours)
- [ ] Lighthouse Performance > 90

---

### 🟢 Sprint 5 : Nouvelles Features (Semaine 9-10)

**Objectif:** Notifications et export

| ID | Tâche | Type | Fichier(s) | Effort | Status |
|----|-------|------|------------|--------|--------|
| FEAT-001 | Système de notifications deadline | Feature | `lib/notifications.ts`, `hooks/useNotifications.ts` | L | 📋 TODO |
| FEAT-002 | Permission API Notification | Feature | `lib/notifications.ts` | S | 📋 TODO |
| FEAT-003 | Alertes 30j/7j/1j avant deadline | Feature | `lib/notifications.ts` | M | 📋 TODO |
| FEAT-004 | Export PDF rapport annuel | Feature | `lib/export-pdf.ts` | L | 📋 TODO |
| FEAT-005 | Template PDF CET | Feature | `lib/export-pdf.ts` | M | 📋 TODO |
| FEAT-006 | Bouton export PDF dans settings | Feature | `components/settings/ExportSection.tsx` | S | 📋 TODO |

**Définition of Done:**
- [ ] Notification affichée 30j avant deadline CA
- [ ] PDF généré avec soldes + historique année
- [ ] PDF lisible et imprimable

---

### 🟢 Sprint 6 : Polish & PWA (Semaine 11-12)

**Objectif:** Finalisation v2.0

| ID | Tâche | Type | Fichier(s) | Effort | Status |
|----|-------|------|------------|--------|--------|
| PWA-001 | Créer manifest.json | Feature | `public/manifest.json` | S | 📋 TODO |
| PWA-002 | Service Worker basique | Feature | `public/sw.js` | M | 📋 TODO |
| PWA-003 | Icons PWA (192x192, 512x512) | Asset | `public/icons/` | S | 📋 TODO |
| PWA-004 | Splash screen | Feature | `public/` | S | 📋 TODO |
| HIST-001 | Graphique évolution compteurs 12 mois | Feature | `components/dashboard/HistoryChart.tsx` | L | 📋 TODO |
| HIST-002 | Intégration chart library (Recharts) | Setup | `package.json` | S | 📋 TODO |
| CLEAN-001 | Supprimer formatMinutes dupliqué | Refactor | `lib/optimization.ts:108` | XS | 📋 TODO |
| CLEAN-002 | Unifier null handling (| null partout) | Refactor | Multiple files | M | 📋 TODO |
| DOC-001 | Mise à jour README avec nouvelles features | Doc | `README.md` | S | 📋 TODO |

**Définition of Done:**
- [ ] Installable comme PWA sur mobile
- [ ] Graphique historique fonctionnel
- [ ] README à jour

---

## 3. Backlog Futur (Non Planifié)

### 🔵 Évolutions Long Terme

| ID | Tâche | Type | Effort | Priorité |
|----|-------|------|--------|----------|
| FUTURE-001 | Import automatique SIRH | Feature | XL | Basse |
| FUTURE-002 | Multi-utilisateurs (cloud sync) | Feature | XL | Basse |
| FUTURE-003 | App mobile React Native | Feature | XL | Basse |
| FUTURE-004 | Partage anonyme statistiques | Feature | L | Basse |
| FUTURE-005 | Web Worker pour optimisation | Performance | M | Basse |
| FUTURE-006 | IndexedDB pour gros historique | Performance | M | Basse |
| FUTURE-007 | Virtual scrolling combinaisons | Performance | M | Basse |
| FUTURE-008 | Archivage automatique historique | Feature | M | Basse |
| FUTURE-009 | Mode hors ligne complet | Feature | L | Basse |
| FUTURE-010 | Thèmes personnalisés | Feature | S | Basse |

---

## 4. Refactoring Recommandé

### 4.1 Code Quality

| Fichier | Ligne | Problème | Action | Effort |
|---------|-------|----------|--------|--------|
| `lib/optimization.ts` | 108 | `formatMinutes` dupliqué | Supprimer, importer de calculations | XS |
| `lib/storage.ts` | 78-103 | Migration fragile | Ajouter versioning explicite | S |
| `app/dashboard/page.tsx` | 66-72 | Logique type check fragile | Créer `getCombinationValue()` | S |
| Multiple | - | `| null` vs `| undefined` | Standardiser sur `| null` | M |
| `lib/storage.ts` | - | history illimité | Implémenter rotation/archivage | M |

### 4.2 Architecture

| Amélioration | Fichiers | Impact | Effort |
|--------------|----------|--------|--------|
| Extraire logique scoring | `optimization.ts` | Testabilité | M |
| Créer facade storage | `storage.ts` | Maintenance | S |
| Séparer validation | Nouveau `validation.ts` | Sécurité | S |
| Centraliser errors | Nouveau `errors.ts` | Debug | S |

---

## 5. Estimation Effort

### Légende

| Code | Description | Heures |
|------|-------------|--------|
| XS | Très petit | 1-2h |
| S | Petit | 2-4h |
| M | Moyen | 4-8h |
| L | Large | 8-16h |
| XL | Très large | 16-40h |

### Récapitulatif par Sprint

| Sprint | Items | Effort Total | Durée |
|--------|-------|--------------|-------|
| Sprint 1 (A11y) | 7 | ~20h | 2 sem |
| Sprint 2 (Validation) | 9 | ~25h | 2 sem |
| Sprint 3 (Tests) | 7 | ~35h | 2 sem |
| Sprint 4 (Perf) | 9 | ~20h | 2 sem |
| Sprint 5 (Features) | 6 | ~30h | 2 sem |
| Sprint 6 (Polish) | 9 | ~25h | 2 sem |
| **Total v2.0** | **47** | **~155h** | **12 sem** |

---

## 6. Dépendances

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GRAPHE DE DÉPENDANCES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Sprint 1 (A11y)
         │
         ▼
    Sprint 2 (Validation) ──────┐
         │                      │
         ▼                      │
    Sprint 3 (Tests) ◄──────────┘
         │
         ▼
    Sprint 4 (Perf)
         │
         ├────────────────┐
         ▼                ▼
    Sprint 5 (Features)   Sprint 6 (Polish)
         │                │
         └────────┬───────┘
                  ▼
              Release v2.0

Dépendances critiques:
• VAL-001 (Zod) bloque VAL-002, VAL-003, VAL-004
• TEST-001 (Vitest setup) bloque tous les tests
• A11Y-001 (alert) doit être fait avant release
```

---

## 7. Critères de Priorisation

### Matrice Impact/Effort

```
         IMPACT
    Haut │  A11Y-001    │  TEST-002   │
         │  VAL-004     │  PERF-006   │
         │              │             │
    ─────┼──────────────┼─────────────┼─────
         │  A11Y-003    │  FEAT-001   │
   Moyen │  CLEAN-001   │  HIST-001   │
         │              │             │
    ─────┼──────────────┼─────────────┼─────
         │  A11Y-004    │  PWA-003    │
    Bas  │              │  FUTURE-*   │
         │              │             │
         └──────────────┴─────────────┴─────
              Faible       Élevé
                    EFFORT
```

### Critères utilisés

1. **Impact sécurité** (poids 3) : Validation, error handling
2. **Impact utilisateur** (poids 3) : Accessibilité, features
3. **Impact maintenance** (poids 2) : Tests, refactoring
4. **Impact performance** (poids 1) : Optimisations

---

## 8. Definition of Done (Global)

### Pour chaque item

- [ ] Code implémenté et fonctionnel
- [ ] Tests écrits (si applicable)
- [ ] Pas de régression
- [ ] Documentation à jour (si API publique)
- [ ] Code review passée
- [ ] Build production réussi
- [ ] Lighthouse scores maintenus

### Pour chaque sprint

- [ ] Tous les items "Done"
- [ ] Démo utilisateur validée
- [ ] Notes de version rédigées
- [ ] Backlog mis à jour
