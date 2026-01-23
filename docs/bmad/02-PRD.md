# Product Requirements Document (PRD)

**Produit:** Chronos
**Version:** 2.0
**Date:** 22 janvier 2026
**Statut:** Actif

---

## 1. Vision Produit

### 1.1 Énoncé de Vision

> **Chronos** permet aux policiers français de maximiser leur épargne temps (CET) en optimisant intelligemment l'utilisation de leurs congés selon les règles APORTT complexes, le tout dans une interface simple et 100% confidentielle.

### 1.2 Proposition de Valeur

| Pour | Qui | Chronos est |
|------|-----|-------------|
| Policiers français | Ont des règles de congés complexes (APORTT) | Une application qui optimise automatiquement leurs congés |
| | Risquent de perdre des jours | Pour maximiser leur CET |
| | N'ont pas d'outil dédié | Sans jamais compromettre leurs données personnelles |

### 1.3 Objectifs Business

| Objectif | Métrique | Cible |
|----------|----------|-------|
| Adoption | Utilisateurs actifs | 1000+ policiers |
| Rétention | Usage mensuel | >80% reviennent |
| Satisfaction | NPS | >50 |
| Impact | Jours CET gagnés/an | +5 jours/utilisateur |

---

## 2. Contexte et Problématique

### 2.1 Problème Actuel

Les policiers français gèrent **8 types de congés différents** avec des règles complexes:

```
┌─────────────────────────────────────────────────────────────┐
│  COMPLEXITÉ DES RÈGLES APORTT                               │
├─────────────────────────────────────────────────────────────┤
│  • CA : 18-23 jours selon cycle, deadline 31/12            │
│  • CA HP : 2 jours bonus si 8 CA hors période              │
│  • CF : 109h12/an, lisser par semestre                     │
│  • RTC : 175h01 net, 10j convertibles CET à 8h21/jour      │
│  • RTT : Variable selon cycle                               │
│  • RPS : ~126h06/an, cumul illimité                        │
│  • HS : Max 160h, surplus payé                             │
│  • CET : Max 60j, +15j/an max                              │
└─────────────────────────────────────────────────────────────┘
```

**Conséquences actuelles:**
- 📉 Perte de jours non utilisés (deadline dépassée)
- 🤯 Calculs manuels chronophages et error-prone
- 💰 Opportunités CET manquées
- 😓 Stress administratif

### 2.2 Solution Chronos

```
┌─────────────────────────────────────────────────────────────┐
│  CHRONOS - OPTIMISATION INTELLIGENTE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   📅 Calendrier      →    🧮 Algorithme    →    💡 Reco    │
│   interactif              scoring               optimale    │
│                                                             │
│   Sélection               Génère toutes        Affiche      │
│   2 clics                 combinaisons         top 100      │
│   (début/fin)             possibles            triées       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Périmètre Fonctionnel

### 3.1 Fonctionnalités Existantes (v1.0)

#### Core Features ✅

| Feature | Description | Statut |
|---------|-------------|--------|
| **Calendrier interactif** | 3 vues (mois/semaine/année), sélection 2 clics | ✅ Livré |
| **Moteur d'optimisation** | Génère combinaisons, score 0-100 | ✅ Livré |
| **Compteurs temps réel** | 8 types avec soldes/deadlines | ✅ Livré |
| **Recommandations** | Alertes prioritaires automatiques | ✅ Livré |
| **Onboarding** | Wizard 3 étapes personnalisé | ✅ Livré |
| **Export/Import** | Sauvegarde JSON locale | ✅ Livré |
| **Mode sombre** | Thème clair/sombre | ✅ Livré |

#### Règles APORTT Implémentées ✅

| Règle | Formule | Validé |
|-------|---------|--------|
| CA par cycle | 18j (12h08) / 23j (4/2) | ✅ |
| RTC net | 187h09 - 12h08 = 175h01 | ✅ |
| RTC → CET | 8h21 = 1 jour CET | ✅ |
| CA HP bonus | +2j si 8 CA hors juillet-août | ✅ |
| CF semestriel | 109h12/2 = 54h36 | ✅ |

### 3.2 Fonctionnalités Futures (v2.0+)

#### Haute Priorité 🔴

| Feature | Description | Effort |
|---------|-------------|--------|
| **Accessibilité WCAG** | aria-labels, keyboard nav, contraste | M |
| **Tests automatisés** | Vitest, 80% coverage sur lib/ | M |
| **Notifications deadline** | Alertes 30j/7j/1j avant expiration | S |

#### Moyenne Priorité 🟡

| Feature | Description | Effort |
|---------|-------------|--------|
| **Export PDF** | Rapport CET annuel imprimable | M |
| **Import SIRH** | Intégration données RH automatique | L |
| **Historique graphique** | Visualisation évolution sur 12 mois | M |

#### Basse Priorité 🟢

| Feature | Description | Effort |
|---------|-------------|--------|
| **Multi-utilisateurs** | Cloud sync (optionnel) | XL |
| **App mobile** | React Native iOS/Android | XL |
| **Partage anonyme** | Comparer stats sans données perso | L |

---

## 4. Exigences Non-Fonctionnelles

### 4.1 Confidentialité (CRITIQUE)

```
┌─────────────────────────────────────────────────────────────┐
│  ARCHITECTURE ZERO-TRUST                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ✅ 100% localStorage (aucun serveur)                      │
│   ✅ Aucune transmission réseau                             │
│   ✅ Offline-first                                          │
│   ✅ RGPD compliant by design                               │
│   ✅ Données jamais partagées                               │
│                                                             │
│   Pourquoi: Données sensibles (planning travail police)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Performance

| Métrique | Cible | Actuel |
|----------|-------|--------|
| First Contentful Paint | <1.5s | ~1.2s ✅ |
| Time to Interactive | <3s | ~2.5s ✅ |
| Génération combinaisons | <500ms | ~300ms ✅ |
| Taille bundle (gzip) | <400KB | ~300KB ✅ |

### 4.3 Accessibilité

| Critère | Cible | Actuel |
|---------|-------|--------|
| WCAG Level | AA | ❌ Non conforme |
| Keyboard navigation | 100% | ~60% |
| Screen reader | Compatible | ❌ Partiel |
| Contraste | 4.5:1 | Non vérifié |

### 4.4 Compatibilité

| Plateforme | Support |
|------------|---------|
| Chrome 90+ | ✅ |
| Firefox 90+ | ✅ |
| Safari 15+ | ✅ |
| Edge 90+ | ✅ |
| Mobile browsers | ✅ Responsive |

---

## 5. Contraintes Techniques

### 5.1 Stack Imposée

```
Frontend:     Next.js 16 + React 19 + TypeScript 5
UI:           shadcn/ui + Tailwind CSS 4
Stockage:     localStorage uniquement
Backend:      AUCUN (architecture client-only)
```

### 5.2 Contraintes Métier

- **Règles APORTT** : Source de vérité, non négociable
- **Cycle de travail** : Support 2/2/3/2/2/3, 4/2, hebdomadaire
- **Journée solidarité** : -12h08 sur RTC obligatoire
- **Plafond CET** : 60 jours maximum légal

---

## 6. Métriques de Succès

### 6.1 KPIs Produit

| KPI | Définition | Cible v2.0 |
|-----|------------|------------|
| **Combinaisons générées/session** | Utilisation optimisation | >5 |
| **Jours posés via Chronos** | Congés appliqués | >50/an/user |
| **Taux complétion onboarding** | Funnel conversion | >90% |
| **Erreurs runtime** | Stabilité | 0 |

### 6.2 KPIs Techniques

| KPI | Définition | Cible |
|-----|------------|-------|
| **Test coverage** | % code testé | >80% lib/ |
| **Lighthouse a11y** | Score accessibilité | >90 |
| **Bundle size** | Taille gzip | <400KB |
| **Build time** | CI/CD | <60s |

---

## 7. Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Changement règles APORTT | Haut | Moyenne | Architecture modulaire, constants.ts isolé |
| Saturation localStorage | Moyen | Basse | Archivage historique, quota monitoring |
| Incompatibilité navigateur | Moyen | Basse | Polyfills, feature detection |
| Perte données utilisateur | Haut | Basse | Export JSON, rappels backup |

---

## 8. Roadmap Indicative

```
Q1 2026
├── v2.0 - Accessibilité & Tests
│   ├── WCAG AA compliance
│   ├── Test suite Vitest
│   └── Refactoring performance
│
Q2 2026
├── v2.1 - Notifications
│   ├── Alertes deadline
│   ├── Export PDF
│   └── Historique graphique
│
Q3-Q4 2026
├── v3.0 - Expansion (optionnel)
│   ├── Import SIRH
│   ├── Multi-utilisateurs cloud
│   └── App mobile
```

---

## 9. Glossaire

| Terme | Définition |
|-------|------------|
| **APORTT** | Accords relatifs à la Programmation du Travail |
| **CA** | Congés Annuels |
| **CA HP** | Congés Annuels Hors Période (bonus) |
| **CF** | Congés Forfaitaires |
| **RTC** | Récupération Temps Compensateur |
| **RTT** | Réduction Temps de Travail |
| **RPS** | Repos de Pénibilité Spécifique |
| **HS** | Heures Supplémentaires |
| **CET** | Compte Épargne Temps |
| **Cycle A/B** | Alternance semaines de travail |

---

## Historique des Versions

| Version | Date | Changements |
|---------|------|-------------|
| 1.0 | 09/01/2026 | Version initiale production |
| 2.0 | 22/01/2026 | PRD BMAD - Planification évolutions |
