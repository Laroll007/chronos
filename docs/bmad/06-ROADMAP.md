# Roadmap & Synthèse BMAD - Chronos

**Version:** 2.0
**Date:** 22 janvier 2026
**Méthode:** BMAD (Business Model Architecture Design)

---

## 1. Synthèse Exécutive

### 1.1 État Actuel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHRONOS - ÉTAT JANVIER 2026                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ✅ FORCES                          │   ⚠️ FAIBLESSES                       │
│   ────────────────────────────────   │   ────────────────────────────────    │
│   • Logique métier APORTT complète   │   • Accessibilité (2,5/5)             │
│   • Architecture 100% locale         │   • Zéro tests automatisés            │
│   • TypeScript strict                │   • Re-renders non optimisés          │
│   • UX calendrier intuitive          │   • Validation import faible          │
│   • Algorithme scoring efficace      │   • Error handling basique            │
│                                      │                                       │
│   Score global : 3,5/5               │   Statut : Production avec réserves   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Objectifs v2.0

| Objectif | Métrique | Cible |
|----------|----------|-------|
| Accessibilité | Lighthouse a11y | >90 |
| Qualité | Test coverage lib/ | >80% |
| Performance | Lighthouse perf | >90 |
| Robustesse | Erreurs runtime | 0 |

---

## 2. Roadmap Visuelle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ROADMAP 2026                                      │
└─────────────────────────────────────────────────────────────────────────────┘

    Q1 2026                      Q2 2026                      Q3-Q4 2026
    ═══════════════════════════════════════════════════════════════════════

    JANVIER         FÉVRIER         MARS            AVRIL-JUIN      JUILLET+
    ┌─────┐        ┌─────┐        ┌─────┐          ┌─────┐          ┌─────┐
    │  1  │───────▶│  2  │───────▶│  3  │─────────▶│  4  │─────────▶│  5  │
    └─────┘        └─────┘        └─────┘          └─────┘          └─────┘
       │              │              │                │                │
       ▼              ▼              ▼                ▼                ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐      ┌─────────┐      ┌─────────┐
    │  BMAD   │  │  A11y   │  │  Tests  │      │ Features│      │  v3.0   │
    │ Analyse │  │  + Val  │  │  + Perf │      │ + Polish│      │ (cloud) │
    └─────────┘  └─────────┘  └─────────┘      └─────────┘      └─────────┘

    Milestones:
    ────────────────────────────────────────────────────────────────────────
    📍 22 Jan    📍 15 Fév     📍 15 Mars      📍 30 Juin       📍 TBD
    BMAD Done    v2.0-alpha    v2.0-beta       v2.0 Release     v3.0 Start


    Légende:
    ═══════
    🔴 Critique    🟡 Haute    🟢 Moyenne    🔵 Basse/Future
```

---

## 3. Planning Détaillé

### 3.1 Phase 1 : Fondations (Janvier-Février 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1 : FONDATIONS                                                        │
│  Durée : 4 semaines | Effort : ~45h                                         │
├─────────────────────────────────────────────────────────────────────────────┤

    Semaine 1-2 (Sprint 1)          Semaine 3-4 (Sprint 2)
    ─────────────────────────────   ─────────────────────────────
    🔴 Accessibilité Critique       🔴 Validation & Errors

    □ Remplacer alert() → Toast     □ Setup Zod
    □ aria-labels calendrier        □ Schémas validation
    □ aria-labels DateRangePicker   □ Import JSON strict
    □ Focus management modal        □ ChronosError class
    □ Texte alternatif scores       □ Error Boundary
    □ Keyboard navigation           □ Logger centralisé

    Livrable : v2.0-alpha           Livrable : v2.0-alpha.2
    ────────────────────────────────────────────────────────────────────────
    Critères de succès :
    ✓ Lighthouse a11y > 80
    ✓ Import invalide = message clair
    ✓ Zéro crash non géré

└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Phase 2 : Qualité (Mars 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2 : QUALITÉ                                                           │
│  Durée : 4 semaines | Effort : ~55h                                         │
├─────────────────────────────────────────────────────────────────────────────┤

    Semaine 5-6 (Sprint 3)          Semaine 7-8 (Sprint 4)
    ─────────────────────────────   ─────────────────────────────
    🟡 Tests Unitaires              🟡 Performance React

    □ Setup Vitest                  □ useCallback handlers
    □ Tests calculations.ts         □ React.memo Calendar*
    □ Tests optimization.ts         □ React.memo CombinationCard
    □ Tests storage.ts              □ Cache WeekType
    □ Tests recommendations.ts      □ Cache isWorkingDay
    □ CI GitHub Actions             □ Lazy load modales
                                    □ Optimiser useEffect

    Livrable : v2.0-beta            Livrable : v2.0-rc1
    ────────────────────────────────────────────────────────────────────────
    Critères de succès :
    ✓ Coverage lib/ > 80%
    ✓ CI passe sur chaque PR
    ✓ Lighthouse perf > 90

└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Phase 3 : Features & Polish (Avril-Juin 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3 : FEATURES & POLISH                                                 │
│  Durée : 4 semaines | Effort : ~55h                                         │
├─────────────────────────────────────────────────────────────────────────────┤

    Semaine 9-10 (Sprint 5)         Semaine 11-12 (Sprint 6)
    ─────────────────────────────   ─────────────────────────────
    🟢 Nouvelles Features           🟢 PWA & Polish

    □ Notifications deadline        □ manifest.json
    □ Permission Notification API   □ Service Worker
    □ Alertes 30j/7j/1j            □ Icons PWA
    □ Export PDF rapport            □ Graphique historique
    □ Template PDF CET              □ Cleanup code dupliqué
    □ Bouton export settings        □ README mise à jour

    Livrable : v2.0-rc2             Livrable : v2.0 🎉
    ────────────────────────────────────────────────────────────────────────
    Critères de succès :
    ✓ Notifications fonctionnelles
    ✓ PDF générable
    ✓ Installable comme PWA

└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Phase 4 : Évolutions Futures (Q3-Q4 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4 : ÉVOLUTIONS FUTURES (OPTIONNEL)                                    │
│  Durée : Variable | Effort : TBD                                            │
├─────────────────────────────────────────────────────────────────────────────┤

    🔵 Backlog Long Terme
    ─────────────────────────────────────────────────────────────────────────

    Q3 2026 (si décidé)             Q4 2026 (si décidé)
    ─────────────────────────────   ─────────────────────────────

    □ Import SIRH automatique       □ App mobile React Native
    □ Web Worker optimisation       □ Multi-utilisateurs cloud
    □ IndexedDB gros historique     □ Sync cross-device
    □ Virtual scrolling             □ Partage anonyme stats

    ────────────────────────────────────────────────────────────────────────
    Note : Ces features nécessitent une décision business avant planification

└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Artefacts BMAD Générés

### 4.1 Index des Documents

| # | Document | Fichier | Description |
|---|----------|---------|-------------|
| 1 | Audit Technique | `01-AUDIT-TECHNIQUE.md` | Analyse complète du code existant |
| 2 | PRD | `02-PRD.md` | Exigences produit et vision |
| 3 | Architecture | `03-ARCHITECTURE.md` | Diagrammes et décisions techniques |
| 4 | Personas & Stories | `04-PERSONAS-USER-STORIES.md` | Utilisateurs cibles et parcours |
| 5 | Backlog | `05-BACKLOG.md` | Liste priorisée des tâches |
| 6 | Roadmap | `06-ROADMAP.md` | Ce document - Synthèse et planning |

### 4.2 Structure du Dossier

```
chronos/
└── docs/
    └── bmad/
        ├── 01-AUDIT-TECHNIQUE.md
        ├── 02-PRD.md
        ├── 03-ARCHITECTURE.md
        ├── 04-PERSONAS-USER-STORIES.md
        ├── 05-BACKLOG.md
        └── 06-ROADMAP.md
```

---

## 5. Métriques de Succès v2.0

### 5.1 Tableau de Bord Cible

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MÉTRIQUES v2.0 - OBJECTIFS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   QUALITÉ CODE              PERFORMANCE              UTILISABILITÉ          │
│   ──────────────────        ──────────────────       ──────────────────     │
│                                                                              │
│   Coverage: ████████░░ 80%  Lighthouse: █████████░ 90  A11y: █████████░ 90  │
│   Erreurs:  ██████████ 0    FCP: █████████░ <1.5s      SUS:  ████████░░ 75  │
│   Types:    ██████████ 100% TTI: █████████░ <3s        Taux: █████████░ 95% │
│                                                                              │
│   ──────────────────────────────────────────────────────────────────────    │
│                                                                              │
│   BUSINESS                  TECHNIQUE                SATISFACTION           │
│   ──────────────────        ──────────────────       ──────────────────     │
│                                                                              │
│   Users:    Target 1000+    Bundle: <400KB gzip      NPS: Target >50        │
│   Retention: Target 80%     Build: <60s CI           Bugs: <1/mois          │
│   CET gain: +5j/user/an     Zero crash               Support: <1h réponse   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Critères Go/No-Go Release

| Critère | Seuil Minimum | Idéal |
|---------|---------------|-------|
| Lighthouse Performance | >85 | >95 |
| Lighthouse Accessibility | >85 | >95 |
| Test Coverage lib/ | >70% | >90% |
| Erreurs console prod | 0 | 0 |
| Build time | <90s | <60s |
| Bundle size gzip | <500KB | <350KB |

---

## 6. Risques et Mitigations

### 6.1 Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Changement règles APORTT | Moyenne | Haut | constants.ts isolé, tests, versioning |
| Retard tests (complexité) | Moyenne | Moyen | Focus sur lib/ d'abord, TDD |
| Régression a11y | Basse | Haut | CI avec Lighthouse, tests a11y |
| Performance dégradée | Basse | Moyen | Profiling régulier, benchmarks |
| Saturation localStorage | Basse | Moyen | Monitoring, archivage automatique |

### 6.2 Plan de Contingence

```
SI régression a11y détectée:
  → Rollback immédiat
  → Fix dans sprint suivant
  → Renforcer CI checks

SI tests bloquent release:
  → Release sans feature concernée
  → Hotfix post-release
  → Revoir estimation effort

SI performance < 85 Lighthouse:
  → Audit React DevTools
  → Lazy loading agressif
  → Différer features lourdes
```

---

## 7. Prochaines Étapes Immédiates

### 7.1 Actions Semaine 1

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TODO IMMÉDIAT - SEMAINE DU 22 JANVIER 2026                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Jour 1-2                                                                   │
│   ────────────────────────────────────────────────────────                  │
│   □ Lire et valider documents BMAD                                          │
│   □ Identifier questions/clarifications                                      │
│   □ Setup branche feature/v2.0-a11y                                         │
│                                                                              │
│   Jour 3-4                                                                   │
│   ────────────────────────────────────────────────────────                  │
│   □ A11Y-001: Remplacer alert() par Toast                                   │
│   □ A11Y-002: aria-labels CalendarMonth                                     │
│   □ A11Y-003: aria-labels DateRangePicker                                   │
│                                                                              │
│   Jour 5                                                                     │
│   ────────────────────────────────────────────────────────                  │
│   □ Tests manuels navigation clavier                                        │
│   □ Lighthouse audit baseline                                               │
│   □ PR review + merge                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Commandes de Démarrage

```bash
# Cloner et installer
cd "/Users/amreen/Documents/1 - Projets IA/chronos"
npm install

# Démarrer le développement
npm run dev

# Créer branche v2.0
git checkout -b feature/v2.0-accessibility

# Lancer Lighthouse (après build)
npm run build && npx lighthouse http://localhost:3000 --view
```

---

## 8. Conclusion

### 8.1 Résumé BMAD

La méthode BMAD appliquée à Chronos a permis de :

1. **Auditer** l'existant de manière exhaustive (score 3,5/5)
2. **Documenter** la vision produit et l'architecture
3. **Prioriser** les évolutions (a11y > tests > perf > features)
4. **Planifier** une roadmap réaliste (12 semaines vers v2.0)

### 8.2 Prêt pour l'Implémentation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   ✅ Artefacts BMAD complets                                                │
│   ✅ Backlog priorisé avec 47 items                                         │
│   ✅ Roadmap 12 semaines définie                                            │
│   ✅ Critères de succès mesurables                                          │
│   ✅ Risques identifiés avec mitigations                                    │
│                                                                              │
│   🚀 PRÊT POUR DÉMARRER SPRINT 1                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**Document généré le 22 janvier 2026**
**Méthode BMAD - Business Model Architecture Design**
**Projet Chronos v2.0**
