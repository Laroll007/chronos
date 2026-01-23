# CHRONOS - État du projet

**Dernière mise à jour** : 8 janvier 2026

---

## Ce qui a été fait

### 1. Mise à jour APORTT (TERMINÉ - 7 janvier)

**Fichiers modifiés** :
- `lib/types.ts` : `CyclePattern`, `journeeSolidariteAppliquee`
- `lib/constants.ts` : `CA_PAR_CYCLE`, `JOURNEE_SOLIDARITE`, `RTC_BRUT/NET_ANNUEL`
- `lib/calculations.ts` : `getCAParCycle()`, `calculerRTCNet()`
- `lib/storage.ts` : Migration auto, RTC = 175h01 (net)

**Valeurs** : CA 18j (cycle 12h08), RTC net 175h01 (brut 187h09 - JS 12h08)

---

### 2. Refonte UX Minimaliste (TERMINÉ - 8 janvier) ✅

**Objectif** : Interface ultrathink centrée sur un calendrier interactif avec système d'optimisation intelligent.

#### Architecture finale

```
┌─────────────────────────────────────────────────┐
│  [Profil]                      [Réglages]       │
├─────────────────────────────────────────────────┤
│                                                 │
│           CALENDRIER CENTRAL                    │
│         Mois / Semaine / Année                  │
│                                                 │
│   → Clic date début + Clic date fin             │
│   → Modal avec TOUTES les combinaisons          │
│   → Triées par score (0-100)                    │
│                                                 │
├─────────────────────────────────────────────────┤
│              [📊 Compteurs]                     │
└─────────────────────────────────────────────────┘
```

#### Nouveaux composants créés (10 fichiers)

1. **`lib/optimization.ts`** - Moteur d'optimisation
   - Génère toutes les combinaisons possibles de congés
   - Score sur 100 points (priorité 40pts + pertes 30pts + simplicité 20pts + CET 10pts)
   - Trie de la meilleure à la pire option

2. **`lib/types.ts`** - Nouveaux types
   - `Combination` : combinaison avec score, avantages, inconvénients
   - `CombinationItem` : item de combinaison
   - `ScoreLabel` : étoiles de notation

3. **`components/dashboard/DateRangePicker.tsx`** - Hook sélection
   - Logique 2 clics pour sélectionner une plage
   - Preview visuel pendant survol
   - Calcul automatique jours travaillés

4. **`components/dashboard/SimpleHeader.tsx`** - Header minimaliste
   - Boutons Profil (gauche) + Réglages (droite)
   - Badges cycle (semaine A/B) et statut (travail/repos)

5. **`components/dashboard/CalendarMonth.tsx`** - Vue mensuelle
   - Adapté de l'ancien Calendar.tsx
   - Sélection visuelle interactive (vert pour sélection)
   - États : travail (violet), dimanche (rose), aujourd'hui (ring violet)

6. **`components/dashboard/CalendarWeek.tsx`** - Vue hebdomadaire
   - 7 jours affichés en grandes cartes
   - Navigation semaine par semaine
   - Même système de sélection

7. **`components/dashboard/CalendarYear.tsx`** - Vue annuelle
   - 12 mini-calendriers (grid 4x3)
   - Sélection multi-mois possible
   - Statistiques annuelles

8. **`components/dashboard/CalendarView.tsx`** - Orchestrateur
   - Switcher Mois/Semaine/Année
   - Gère la sélection et déclenche modal
   - Animations de transition entre vues

9. **`components/dashboard/CombinationCard.tsx`** - Carte option
   - Score avec étoiles et code couleur
   - Avantages (✓ vert) et inconvénients (⚠️ orange)
   - Impact sur compteurs (avant → après)
   - Bouton validation

10. **`components/dashboard/OptimizationModal.tsx`** - Modal combinaisons
    - Génère et affiche toutes les options
    - Stagger animation (apparition décalée)
    - Grid 2 colonnes sur desktop

11. **`components/dashboard/CountersDrawer.tsx`** - Drawer compteurs
    - Sheet depuis le bas (85vh)
    - Tous les compteurs détaillés
    - Alertes prioritaires (urgent/à faire)

#### Dashboard restructuré

**`app/dashboard/page.tsx`** - Refonte complète :
- Layout simplifié : Header + Calendrier + Bouton
- Système d'onglets supprimé
- 4 modales : Optimisation, Compteurs, Profil, Réglages
- Gestion validation combinaisons avec toast

#### Composants supprimés (obsolètes)

- ❌ `ActionButtons.tsx` → Remplacé par OptimizationModal
- ❌ `SmartAdvice.tsx` → Remplacé par OptimizationModal
- ❌ `Simulator.tsx` → Remplacé par sélection calendrier
- ❌ `Navigation.tsx` → Plus de navigation par onglets
- ❌ `Calendar.tsx` → Remplacé par CalendarMonth
- ❌ `Header.tsx` → Remplacé par SimpleHeader

#### Animations ajoutées

- Transitions entre vues calendrier (fade + slide)
- Stagger des cartes combinaisons (délai 50ms)
- Message sélection en cours (pulse)
- Hover states sur jours calendrier

---

## Fonctionnalités principales

### Sélection de congés intelligente

1. **Calendrier central** (3 vues : mois, semaine, année)
2. **Sélection 2 clics** : date début + date fin
3. **Preview visuel** : plage en vert translucide pendant survol
4. **Calcul automatique** : jours travaillés dans la plage

### Système d'optimisation

**Algorithme de génération** :
- Combinaisons pures (1 type) : CF, CA, CA HP, RTC, RPS, HS
- Combinaisons mixtes (2 types) : toutes les répartitions possibles
- Limite à 100 combinaisons max

**Formule de scoring (sur 100)** :
1. **Priorité (40pts)** - CF > CA excéd. > RTC libres > RPS > HS
2. **Éviter pertes (30pts)** - Pénalités si entame RTC réservés ou CA pendant période HP
3. **Simplicité (20pts)** - 1 type = 20pts, 2 types = 15pts, 3+ = 10pts
4. **Optimisation CET (10pts)** - Bonus si garde RTC réservés + CA pour CET

**Affichage des options** :
- Toutes les combinaisons triées par score
- Score + étoiles + code couleur (vert 90+, jaune 75-89, orange 60-74, rouge <60)
- Avantages et inconvénients explicites
- Impact détaillé sur chaque compteur

### Navigation

- **Profil** : Infos cycle, pattern, objectif CET
- **Réglages** : Paramètres, export/import, réinitialisation
- **Compteurs** : Drawer avec tous les compteurs + alertes prioritaires

---

## Règles métier importantes

### Priorité de consommation
1. **CF** - Lisser sur l'année (~54h36/semestre), PAS de perte au 30/06
2. **CA excédentaires** (> 5 pour CET) - Perdus au 31/12
3. **RTC libres** (après 83h30 réservés) - Perdus au 31/12
4. **RPS/HS** - Réserves stratégiques (gardés)

### CF - Règle corrigée
Les CF ne sont PAS perdus au 30/06. Ils sont attribués en avance pour l'année. Conseil : lisser moitié avant juin, moitié après.

### Potentiel CET à protéger
- 10j via RTC (83h30 = gain +37h50)
- 5j CA classiques
- 2j CA HP (si 8 CA posés hors période)

---

## Profil utilisateur

- Cycle 2/2/3/3 jour (07h00-19h08)
- 18 CA, 175h01 RTC net
- Un dimanche sur deux

---

## Technologies

- **Next.js 16** (Turbopack)
- **React 18** (Client Components)
- **TypeScript** (strict mode)
- **Tailwind CSS** + **Shadcn/UI**
- **LocalStorage** (persistance)
- **Sonner** (toasts)

---

## Commandes

```bash
cd "/Users/amreen/Documents/1 - Projets IA/chronos"
npm run dev   # Développement (http://localhost:3000)
npm run build # Production
npm start     # Lancer production
```

---

## Tests de vérification

### Scénario complet

1. ✅ Ouvrir app → Calendrier mois en grand
2. ✅ Cliquer jour 10 → Surligné vert
3. ✅ Survol jour 15 → Preview plage verte
4. ✅ Cliquer jour 15 → Modal optimisation s'ouvre
5. ✅ Modal affiche toutes les combinaisons triées par score
6. ✅ Cliquer "Valider" sur une option → Toast succès + compteurs MAJ
7. ✅ Cliquer "Compteurs" → Drawer depuis bas avec détails
8. ✅ Switcher Semaine → Vue hebdomadaire
9. ✅ Switcher Année → Vue annuelle 12 mois
10. ✅ Build production réussi

---

## Plan de refonte (référence)

Fichier : `/Users/amreen/.claude/plans/partitioned-finding-tower.md`

**7 phases réalisées** :
1. ✅ Fondations (types, algorithme, hook)
2. ✅ Composants calendrier (header, month, view)
3. ✅ Modal optimisation (cards, modal)
4. ✅ Drawer compteurs
5. ✅ Intégration dashboard + nettoyage
6. ✅ Vues supplémentaires (semaine, année)
7. ✅ Animations et polissage

**Durée estimée** : 18-24h
**Durée réelle** : ~20h

---

---

## Corrections post-refonte (9 janvier 2026) ✅

**3 ajustements appliqués** :

### 1. Bouton Compteurs repositionné ✅
- **Avant** : Bouton centré en bas de page
- **Après** : Bouton dans le header à côté de Réglages
- **Fichiers modifiés** :
  - `components/dashboard/SimpleHeader.tsx` : Ajout prop onCountersClick + bouton
  - `app/dashboard/page.tsx` : Passage callback + suppression div bas

### 2. Cycle de travail corrigé ✅
- **Problème** : Date de début cycle incorrecte
- **Solution** : `dateDebutCycle: '2026-01-06'` + `semaineActuelle: 'B'`
- **Résultat** : 8 janvier 2026 (jeudi) = repos = semaine B ✓
- **Fichier modifié** : `lib/storage.ts` (DEFAULT_CYCLE_CONFIG)

### 3. Code couleur vert pour jours posés ✅
- **Fonctionnalité** : Affichage émeraude des jours avec congés posés
- **Hiérarchie visuelle** :
  1. Sélection (ring vert)
  2. Plage (fond vert translucide)
  3. Jour posé (fond émeraude + ring)
  4. Dimanche/Travail/Repos
- **Fichiers modifiés** (6) :
  - `lib/calculations.ts` : Fonction `hasPostedLeaveOnDate()`
  - `components/dashboard/CalendarMonth.tsx` : Props + isPosted + légende
  - `components/dashboard/CalendarWeek.tsx` : Props + isPosted + légende
  - `components/dashboard/CalendarYear.tsx` : Props + isPosted (MiniMonth) + légende
  - `components/dashboard/CalendarView.tsx` : Props history passé aux vues
  - `app/dashboard/page.tsx` : Extraction history du hook + passage à CalendarView

**Total** : 9 fichiers modifiés, 0 erreurs, build réussi ✅

---

## Statut final

🎉 **REFONTE MINIMALISTE TERMINÉE ET OPÉRATIONNELLE**

- Interface ultra-léger centrée sur le calendrier ✅
- Système d'optimisation intelligent ✅
- 3 vues calendrier (mois, semaine, année) ✅
- Animations fluides ✅
- Bouton Compteurs dans header ✅
- Cycle de travail correct (8 jan = repos = semaine B) ✅
- Jours posés en vert émeraude ✅
- Build production réussi ✅
- Tous les tests passés ✅

**Prêt à utiliser !**
