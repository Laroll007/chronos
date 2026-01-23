# 🔄 MISE À JOUR CHRONOS - Nouvelles informations APORTT

**Date** : 5 janvier 2026
**Source** : Documentation APORTT actualisée + Arrêté du 5 septembre 2019

---

## 🎯 Objectif de cette mise à jour

Intégrer les **informations précises et actualisées** sur l'APORTT dans le code existant de CHRONOS.

---

## ✅ CORRECTIONS IMPORTANTES À APPLIQUER

### 1. **Congés Annuels (CA) - CORRECTION MAJEURE**

**❌ ANCIEN (incorrect)** :
```python
ca_total = 25  # Pour tous les agents
```

**✅ NOUVEAU (correct)** :
```python
# CA varie selon le CYCLE, pas selon le corps !
CA_PAR_CYCLE = {
    '4/2': 23,
    '3/3': 18,
    '2/2': 18,
    '2/2/3/2/2/3': 18,
    'vacation_forte': 18
}
```

**Pour moi (cycle 12h08) : 18 CA, pas 25 !**

---

### 2. **Journée de Solidarité - NOUVELLE RÈGLE**

**Nouvelle information** :
> "La journée de solidarité réduit la dotation des droits ARTT d'une journée d'une valeur de 7 heures. La différence de temps entre la journée de solidarité (JS) et celle de l'ARTT déduite est abondée en heures supplémentaires."

**MAIS ATTENTION** :
> "Les régimes cycliques binaires à 12h08 et 11h08 ainsi que le régime de la vacation forte (VF) sont exclus de l'abondement issu de la journée de solidarité en HS."

**Impact pour cycle 12h08** :
- ❌ Perte d'une journée d'ARTT (12h08)
- ❌ Pas de compensation en HS
- ✅ ARTT effectifs = 285h13 - 12h08 = 273h05

**Code à appliquer** :
```python
def calculer_artt_net(cycle, dmj, artt_brut):
    """Calcule les ARTT nets après journée de solidarité"""
    
    # Journée de solidarité = perte d'une journée d'ARTT
    js_deduction = dmj  # 12h08 pour cycle 12h08
    
    # Cycles exclus de l'abondement HS
    cycles_exclus = ['2/2', '3/3', '2/2/3/2/2/3', 'vacation_forte']
    
    artt_net = artt_brut - js_deduction
    
    # Si cycle non exclu, ajouter la compensation HS (rare)
    if cycle not in cycles_exclus and dmj > timedelta(hours=7):
        diff = dmj - timedelta(hours=7)
        # Cette différence est abondée en HS (non en ARTT)
        # Donc on ne la compte pas ici
    
    return artt_net
```

---

### 3. **Crédit Férié - Règle d'abattement maladie**

**Nouvelle précision** :
> "L'indisponibilité motivée par des congés maladie (CMO), non imputable au service, entraîne une déduction de 1/24ème du crédit annuel par période d'absence égale ou supérieure à 15 jours consécutifs."

**Calcul** :
```python
def deduire_credit_ferie_maladie(credit_initial, jours_maladie_consecutifs):
    """
    Déduit 1/24ème du crédit férié tous les 15 jours de maladie
    Uniquement pour CMO (Congé Maladie Ordinaire)
    """
    if jours_maladie_consecutifs < 15:
        return timedelta(0)
    
    periodes_15j = jours_maladie_consecutifs // 15
    deduction_par_periode = credit_initial / 24  # 109h12 / 24 = 4h33
    
    return deduction_par_periode * periodes_15j

# Exemple : 30 jours de maladie consécutifs
# = 2 périodes de 15j
# = 2 × 4h33 = 9h06 de CF déduits
```

---

### 4. **ARTT et Absences - Nouvelle règle**

**Nouvelle information** :
> "Retrait selon quotient de réduction (exprimé en jours d'absences cumulés, peut entraîner la perte d'un ARTT ou un ARTC."

**À implémenter** :
```python
def calculer_abattement_artt_absences(jours_absences_cumules, artt_initial):
    """
    Calcule l'abattement ARTT selon le quotient de réduction
    Règle à préciser avec la RH (formule exacte non détaillée)
    """
    # TODO: Demander la formule exacte du quotient de réduction
    # Pour l'instant, on peut estimer proportionnellement
    
    if jours_absences_cumules == 0:
        return timedelta(0)
    
    # Estimation : réduction proportionnelle sur 365 jours
    ratio_absence = jours_absences_cumules / 365
    abattement = artt_initial * ratio_absence
    
    return abattement
```

---

### 5. **RPS - Coefficients confirmés**

**Confirmés** (pas de changement) :
```python
RPS_COEFFICIENTS = {
    'nuit': 0.1,        # Travail 21h-6h du lundi au samedi
    'dimanche': 0.4,    # Travail le dimanche
    'decalee_rc': 0.25, # Prise décalée sur RC
    'decalee_rl_jf': 0.60,  # Prise décalée sur RL ou JF
    'repos_manque': 0.15    # Par heure de repos journalier manqué
}
```

---

### 6. **Tableau récapitulatif COMPLET pour cycle 12h08**

| Type | Initial | Déductions | Net | CET ? | Reportable ? | Perdu si non pris ? |
|------|---------|------------|-----|-------|--------------|---------------------|
| **Crédit férié** | 109h12 | -1/24 si maladie 15j+ | Variable | ❌ | ❌ | ✅ OUI |
| **CA** | **18 jours** | Aucune | 18j | ✅ | ✅ si maladie | ❌ (→CET) |
| **ARTT brut** | 285h13 | -12h08 (JS) - absences | 273h05 | ✅ (partie) | ❌ | Partie OUI |
| **ARTT indemnisables** | 97h04 | Aucune | 97h04 | ❌ | ❌ | ❌ (indemnisés) |
| **ARTT non indemn.** | 176h01 | Variable | Variable | ❌ | ❌ | ✅ OUI |
| **RPS** | Variable | Aucune | Variable | ❌ | ✅ | ❌ (dus) |
| **RCSS actif** | Variable | Aucune | Variable | ❌ | Limité | ❌ (dus) |

---

## 📊 DONNÉES DE RÉFÉRENCE PAR CYCLE

### Durées moyennes hebdomadaires et journalières

```python
CYCLES_DATA = {
    '4/2': {
        'dmh': timedelta(hours=38, minutes=7),
        'dmj': timedelta(hours=8, minutes=10),
        'ca': 23,
        'artt_cea': timedelta(hours=108, minutes=33),
        'artt_indem_cea': timedelta(hours=66, minutes=48)
    },
    '2/2': {
        '11h08': {
            'dmh': timedelta(hours=38, minutes=58),
            'dmj': timedelta(hours=11, minutes=8),
            'ca': 18,
            'artt_cea': timedelta(hours=120, minutes=15),
            'artt_indem_cea': timedelta(hours=66, minutes=48)
        },
        '12h08': {
            'dmh': timedelta(hours=42, minutes=28),
            'dmj': timedelta(hours=12, minutes=8),
            'ca': 18,
            'artt_cea': timedelta(hours=285, minutes=13),
            'artt_indem_cea': timedelta(hours=97, minutes=4)
        }
    },
    '3/3': {
        # Même structure que 2/2
        '11h08': { /* identique 2/2 11h08 */ },
        '12h08': { /* identique 2/2 12h08 */ }
    },
    '2/2/3/2/2/3': {
        # Même structure que 2/2
        '11h08': { /* identique 2/2 11h08 */ },
        '12h08': { /* identique 2/2 12h08 */ }
    },
    'vacation_forte': {
        'dmh': timedelta(hours=38, minutes=4),
        'dmj': timedelta(hours=9, minutes=31),
        'ca': 18,
        'artt_cea': timedelta(hours=95, minutes=10),
        'artt_indem_cea': timedelta(hours=76, minutes=8)
    }
}
```

---

## 🔧 MODIFICATIONS À APPORTER AU CODE

### Dans `models.py`

#### 1. Modifier `CompteursAnnuels.__init__()`
```python
def __post_init__(self):
    """Calculs automatiques après initialisation"""
    self._set_ca_selon_cycle()  # NOUVEAU
    self._calculer_credit_ferie_initial()
    self._appliquer_journee_solidarite()  # NOUVEAU
    self._calculer_artt_net()
    self._calculer_rps_total()

def _set_ca_selon_cycle(self):
    """Définit le nombre de CA selon le cycle"""
    CA_PAR_CYCLE = {
        Cycle.CYCLE_4_2: 23,
        Cycle.CYCLE_2_2: 18,
        Cycle.CYCLE_3_3: 18,
        Cycle.CYCLE_2_2_3_2_2_3: 18,
        Cycle.VACATION_FORTE: 18
    }
    
    if self.agent.cycle:
        self.ca_total = CA_PAR_CYCLE.get(self.agent.cycle, 18)

def _appliquer_journee_solidarite(self):
    """Applique la déduction journée de solidarité"""
    # Cycles binaires exclus de l'abondement HS
    cycles_exclus = [
        Cycle.CYCLE_2_2,
        Cycle.CYCLE_3_3,
        Cycle.CYCLE_2_2_3_2_2_3,
        Cycle.VACATION_FORTE
    ]
    
    # Déduction = 1 journée de travail
    self.artt_journee_solidarite = self.agent.duree_moyenne_journaliere
```

#### 2. Améliorer `deduire_credit_ferie_maladie()`
```python
def deduire_credit_ferie_maladie(self, jours_maladie_consecutifs: int):
    """
    Déduit 1/24ème du crédit férié pour chaque période de 15 jours
    de maladie consécutifs (CMO uniquement, pas CLM/CLD)
    
    Formule: 24 périodes × 15j = 360 jours max
    """
    if jours_maladie_consecutifs < 15:
        return
    
    periodes_15j = jours_maladie_consecutifs // 15
    deduction_par_periode = self.credit_ferie_initial / 24
    deduction_totale = deduction_par_periode * periodes_15j
    
    self.credit_ferie_deductions_maladie += deduction_totale
    self.credit_ferie_disponible = max(
        timedelta(0),
        self.credit_ferie_initial - 
        self.credit_ferie_deductions_maladie - 
        self.credit_ferie_pris
    )
```

---

### Dans `optimizer.py`

#### Mettre à jour les stratégies avec les bonnes valeurs

```python
def strategie_maximiser_cet(self) -> Dict:
    """Stratégie mise à jour avec calculs corrects"""
    
    # Utiliser les ARTT nets (déjà déduit JS)
    artt_ni_jours = self._heures_vers_jours(
        self.compteurs.artt_non_indemnisables - self.compteurs.artt_pris
    )
    
    # CA correct selon le cycle
    ca_disponibles = self.compteurs.ca_disponible  # 18 pour cycle 12h08
    
    # ... reste du code
```

---

## 📝 CHECKLIST DE MISE À JOUR

```markdown
- [ ] Corriger CA par cycle (18 au lieu de 25)
- [ ] Appliquer journée de solidarité (-12h08 sur ARTT)
- [ ] Implémenter abattement CF pour maladie (1/24ème / 15j)
- [ ] Implémenter abattement ARTT pour absences
- [ ] Vérifier tous les calculs avec les nouvelles valeurs
- [ ] Mettre à jour les tests unitaires
- [ ] Mettre à jour la documentation (README.md)
- [ ] Vérifier l'affichage dans l'interface
```

---

## 🎯 EXEMPLE DE RÉSULTAT ATTENDU

### Pour mon profil (cycle 12h08, CEA, métropole)

**Avant correction** :
```
CA: 25 jours
ARTT net: 285h13
```

**Après correction** :
```
CA: 18 jours  ✅
ARTT brut: 285h13
Journée solidarité: -12h08
ARTT net: 273h05  ✅
Dont indemnisables: 97h04
Dont non indemnisables: 176h01  ⚠️ Perdu si non pris
```

---

## 🚀 COMMANDES POUR CLAUDE CODE

```bash
# 1. Lire ce fichier
"Lis UPDATE_APORTT.md et identifie toutes les corrections à faire"

# 2. Appliquer les corrections
"Corrige models.py selon UPDATE_APORTT.md : CA par cycle et journée solidarité"

# 3. Vérifier
"Vérifie que pour un cycle 12h08, on a bien 18 CA et 273h05 d'ARTT net"

# 4. Mettre à jour les tests
"Crée des tests unitaires pour vérifier ces calculs"

# 5. Mettre à jour l'interface
"Mets à jour l'interface pour afficher les bonnes valeurs"
```

---

## 💡 POINTS D'ATTENTION

### 1. **CA variable selon cycle**
Ne JAMAIS hardcoder 25 CA. Toujours utiliser la table `CA_PAR_CYCLE`.

### 2. **Journée de solidarité**
- Toujours déduire 1 DMJ des ARTT bruts
- Ne PAS ajouter de compensation HS pour cycles 12h08/11h08/VF

### 3. **Abattements**
- CF : uniquement CMO ≥ 15j consécutifs
- ARTT : selon quotient (formule à préciser avec RH)

### 4. **Interface utilisateur**
Afficher clairement :
```
ARTT brut:     285h13
- JS:          -12h08
- Absences:    -Xh
= ARTT net:    273h05

Dont:
- Indemnisables:     97h04
- Non indemnisables: 176h01  ⚠️ Perdu si non pris
```

---

## ✅ VALIDATION FINALE

Après les modifications, vérifier que :

```python
# Test pour cycle 12h08, CEA, métropole
agent = AgentPolice(cycle=Cycle.CYCLE_2_2_3_2_2_3)
compteurs = CompteursAnnuels(annee=2026, agent=agent)

assert compteurs.ca_total == 18  # Pas 25 !
assert compteurs.artt_brut == timedelta(hours=285, minutes=13)
assert compteurs.artt_journee_solidarite == timedelta(hours=12, minutes=8)
assert compteurs.artt_net == timedelta(hours=273, minutes=5)
assert compteurs.artt_indemnisables == timedelta(hours=97, minutes=4)
```

---

**Voilà Claude Code, tu as toutes les corrections précises à appliquer ! 🎯**
