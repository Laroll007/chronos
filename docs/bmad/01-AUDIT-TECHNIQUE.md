# Audit Technique - Chronos

**Date:** 22 janvier 2026
**Version:** 1.0
**Statut:** Complet

---

## Résumé Exécutif

Chronos est une application **production-ready** avec une base solide, nécessitant des itérations ciblées avant déploiement à grande échelle.

### Score Global : 3,5/5

| Catégorie | Score | Priorité |
|-----------|-------|----------|
| Code Quality | 4/5 | - |
| Architecture | 4/5 | - |
| Performance | 3,5/5 | Moyenne |
| React/Next.js | 4/5 | - |
| **Accessibilité** | **2,5/5** | **Critique** |
| **Testing** | **1/5** | **Critique** |
| Sécurité | 4/5 | Basse |
| Dette technique | 3/5 | Moyenne |

---

## 1. Qualité du Code

### TypeScript & Type Safety - 4,5/5

**Points forts:**
- Configuration `strict: true` activée
- Aucun `any` détecté dans les fichiers critiques
- Types discriminés bien utilisés (`CycleType`, `CounterType`, `AlertPriority`)
- Interfaces cohérentes et bien structurées

**Problèmes identifiés:**

| Fichier | Ligne | Problème | Impact |
|---------|-------|----------|--------|
| `lib/storage.ts` | 326 | Type guard `validateUserData` limité | Moyen |
| - | - | Pas de validation des valeurs numériques | Faible |
| - | - | Pas de vérification limites (parseInt → NaN) | Faible |

**Recommandation:** Implémenter validation avec `zod` ou `valibot`.

### Duplication & DRY - 4/5

**Problème:** `formatMinutes()` définie 2 fois
- `lib/calculations.ts:520`
- `lib/optimization.ts:108`

**Action:** Exporter depuis `calculations.ts` uniquement.

### Gestion des Erreurs - 3,5/5

**9 console.error() trouvées** (storage.ts) sans gestionnaire global.

**Problèmes critiques:**
- `CalendarView.tsx:32` - `alert()` non accessible
- Erreurs d'import/export silencieuses
- Pas de rethrow dans les catch blocks

---

## 2. Architecture

### Structure - 4/5

```
chronos/
├── app/           # Pages Next.js (App Router)
├── components/    # 38 composants React
│   ├── ui/        # 16 shadcn/ui
│   ├── dashboard/ # 18 spécialisés
│   ├── onboarding/# 3 wizard
│   └── shared/    # 1 partagé
├── lib/           # 9 fichiers logique métier
├── hooks/         # 4 React hooks
└── public/        # 6 assets
```

**Points positifs:**
- Séparation claire UI/logique
- Hooks personnalisés pour état
- Client components explicitement marqués

**Couplage problématique:**
- `DateRangePicker` fortement couplé aux composants Calendar
- `optimization.ts` dépend lourdement de `calculations.ts`

### State Management - 4,5/5

- 100% localStorage (offline-first, RGPD compliant)
- `useCounters` hook bien construit
- `useMemo` pour calculs coûteux

**Risque:** `history` non limité → saturation localStorage après ~10 ans.

---

## 3. Performance

### Re-renders - 3,5/5

**Problèmes détectés:**

1. **DashboardPage.tsx:62-89**
   - `handleApplyCombination` recréée à chaque render
   - Manque `useCallback`

2. **OptimizationModal.tsx:42-56**
   - Dépend de `counters` entier → re-calcul fréquent
   - `setTimeout(300)` arbitraire

3. **CalendarMonth/Week/Year**
   - Pas de `React.memo()`

### Calculs Coûteux - 3,5/5

`generateAllCombinations()` - Complexité O(n² × m)
- 6 types × 5 types × workingDays
- 30 jours = ~900 combinaisons, filtrées à 100
- **Acceptable mais à monitorer**

### Caching Absent

- `getWeekType()` recalculée 365× par affichage
- `isWorkingDay()` non cachée

**Solution:** `Map<dateString, WeekType>` cache.

---

## 4. Accessibilité (A11y) - CRITIQUE

### Score: 2,5/5

**Problèmes majeurs:**

1. **`alert()` utilisé** (`CalendarView.tsx:32`)
   - Screen readers ne lisent pas les alerts navigateur
   - Doit utiliser Toast avec aria-live

2. **Aucun aria-label** sur:
   - Boutons calendrier
   - Sélecteurs de vue
   - DateRangePicker

3. **Couleurs sans alternative texte**
   - Score vert/rouge/orange sans indication textuelle

4. **Contraste non vérifié**
   - Glassmorphism peut causer problèmes WCAG

5. **Navigation clavier non testée**

**Impact légal:** Problématique pour déploiement service public français.

---

## 5. Testing - CRITIQUE

### Score: 1/5

- **Zéro tests détectés**
- Pas de dossier `__tests__`
- Aucune dépendance de test

**Tests critiques requis:**

```typescript
// Calculs APORTT
describe('RTC calculations', () => {
  test('RTC net après journée solidarité');
  test('Conversion RTC → CET (8h21 = 1 jour)');
});

// Optimisation
describe('Score calculation', () => {
  test('CF prioritaire = score élevé');
  test('Éviter perte CA = bonus score');
});

// Storage
describe('Migrations', () => {
  test('Migration APORTT v1');
  test('Import données valides');
});
```

---

## 6. Sécurité

### Score: 4/5

**Points forts:**
- Aucun XSS possible (pas de dangerouslySetInnerHTML)
- 100% local (aucune transmission réseau)
- RGPD compliant

**À améliorer:**
- Validation stricte à l'import JSON
- Format check sur dates

---

## 7. Dette Technique

### TODO trouvé

`UPDATE_APORTT.md:115`
```
# TODO: Demander la formule exacte du quotient de réduction
```

### Incohérences

| Type | Exemple |
|------|---------|
| Nommage | `caConsommes` vs `cfConsoS1` |
| Null handling | `\| null` vs `\| undefined` vs `??` |
| Duplication | `formatMinutes()` × 2 |

---

## 8. Recommandations Prioritaires

### 🔴 Critique (Semaine 1)

1. **Remplacer `alert()` par Toast accessible**
   ```typescript
   // ❌ Avant
   alert('Aucun jour travaillé...');

   // ✅ Après
   toast.error('Aucun jour travaillé dans cette période');
   ```

2. **Ajouter aria-labels minimaux**
   ```tsx
   <button aria-label={`Sélectionner le ${day} janvier`}>
     {day}
   </button>
   ```

3. **Validation stricte import avec zod**

### 🟡 Haute (Mois 1)

4. Implémenter tests unitaires (Vitest)
5. Optimiser re-renders (useCallback, React.memo)
6. Système d'erreurs centralisé
7. Limiter historique (archivage 1 an)

### 🟢 Moyenne (Mois 2-3)

8. Audit a11y complet (WAVE/Axe)
9. Caching calculs (WeekType)
10. Lazy loading modales
11. Documentation règles APORTT

---

## Fichiers Analysés

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `lib/types.ts` | 198 | Définitions TypeScript |
| `lib/calculations.ts` | 588 | Logique calculs APORTT |
| `lib/optimization.ts` | 498 | Algorithme optimisation |
| `lib/storage.ts` | 349 | Persistance localStorage |
| `lib/constants.ts` | 228 | Constantes métier |
| `lib/recommendations.ts` | 361 | Génération recommandations |
| `app/dashboard/page.tsx` | 223 | Page principale |
| `hooks/useCounters.ts` | 172 | État compteurs |

**Total:** 51 fichiers source TypeScript/TSX

---

## Conclusion

Chronos est une application **bien structurée** avec une **logique métier complexe correctement implémentée**. Les priorités immédiates sont:

1. **Accessibilité** - Bloquant pour déploiement public
2. **Tests** - Risque de régression sur règles APORTT
3. **Performance** - Optimisations React mineures

**Statut:** Production-ready avec itérations Q1 2026.
