# My Chronos — gestion des congés des policiers (règles APORTT)

PWA Next.js 100 % locale (aucun compte, aucune base : tout est dans le
`localStorage` de l'appareil), publiée en trois formats :

| Format | Technique | Mise à jour |
|---|---|---|
| Web | https://mychronos.fr (VPS OVH, pm2 `chronos`) | `bash deploy.sh` |
| Android | Capacitor : WebView qui charge mychronos.fr (depuis la v4 / 2.0.0 ; avant : TWA) | suit le déploiement web |
| iOS | Capacitor (export statique embarqué) | build + envoi App Store Connect |

**Dernière mise à jour de ce fichier : 7 octobre 2026.** L'historique détaillé
des versions est dans `git log` et dans `lib/releaseNotes.ts` (« Quoi de neuf ? »).

## État des versions

- **1.15** : en production web/Android (SW v52), iOS validée par Apple le 7/10/2026.
- **1.16** : en préparation, **ne rien déployer sans le feu vert explicite du
  développeur**. Contenu : ARTT/RTT versables au CET, dotations RTC de la grille
  officielle, horaires qui changent selon les cycles, lot « rangement »
  (compteurs proposés selon le régime, conseils RTC → CET calculés selon le
  cycle, Capacitor 8.5.3, code mort retiré).

## Règles de travail

- **Déploiements groupés** : environ un par jour au plus. Chaque déploiement
  bumpe le service worker → bannière de mise à jour chez tous les utilisateurs.
- **Toujours confirmer avant** un déploiement, un `rsync` ou un redémarrage sur
  le VPS. `git push` vers GitHub est libre (sauvegarde) ; **ne jamais pousser
  de tag `v*`** : il déclenche `.github/workflows/deploy.yml` (déploiement prod).
- Avant de livrer : `npx tsc --noEmit --incremental false` et `npm run test:tz`
  (toute la suite dans 5 fuseaux : Paris, Martinique, Cayenne, Réunion, Nouméa).
- **Règle anti-bazar** : toute nouvelle fonction est soit visible seulement
  par les profils concernés (régime, cycle, compteurs actifs), soit placée
  derrière une entrée existante. Pas de nouveau bouton ou bandeau pour tous.
- Textes : l'app vouvoie ; « Quoi de neuf ? » et la communauté Discord tutoient.
- Ne jamais écrire en dur un chiffre qui dépend du cycle (CA, dotation RTC,
  réserve CET, durée de vacation) : passer par `getCATotalForCycle`,
  `getRTCAnnuel`, `reserveRTCConseillee`, `conseilRTCCET`, `horairesDuJour`.

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4 + composants
shadcn/Radix, Vitest + Testing Library, Capacitor 8 (iOS). Node 22 sur le VPS.

## Carte du code

```
app/dashboard/page.tsx      Planning (écran principal) et orchestration des fenêtres
app/onboarding/             Inscription : cycle puis compteurs
app/stats/, app/api/stats   Statistiques d'usage anonymes (sans identifiant)
app/api/feedback            Formulaire « Donner mon avis »
components/dashboard/       Calendrier (mois/semaine/année), fenêtre de pose
                            (OptimizationModal), compteurs, CET, paramètres…
components/onboarding/      CycleSetup, CountersSetup (aussi « Gérer mes compteurs »)
components/shared/          Aide des compteurs (CounterHelpModal), bannière MAJ…
lib/constants.ts            Chiffres réglementaires (grille officielle)
lib/calculations.ts         Moteur : jours travaillés, dotations, poses, RTC
lib/cet.ts, lib/yearEnd.ts  Épargne CET et bilan de fin d'année
lib/horaires.ts             Horaires du jour (rotation de jeux d'horaires)
lib/rps.ts                  Barème RPS (nuit, dimanche) à la minute
lib/optimization.ts         Meilleures options de pose
lib/storage.ts              Lecture/écriture locale, migrations, bascule annuelle
lib/absences.ts             Absences sans compteur (ASA, Art. 13/15, CFS, EXN…)
lib/releaseNotes.ts         Notes « Quoi de neuf ? » par version
hooks/useCounters.ts        Toutes les actions sur les données (poser, supprimer…)
```

## Règles métier (guide DNPAF / APORTT)

Régimes : cycles alternés **2/2/3/2/2/3**, **3/3**, **4/2** et **2/2** proposés à
l'inscription (les trois derniers en rotation continue, `ROTATIONS`), plus le
**régime hebdomadaire**. La vacation forte reste « Prochainement ».
Horaires qui changent (`horairesRotation`) : d'un cycle à l'autre, ou d'un jour
à l'autre dans le cycle (rotation d'un jour, `periodeJours = 1`) ; le planning
affiche une pastille par jour travaillé (`HorairesBadge`).

| Cycle | CA | Dotation RTC | Réserve CET conseillée |
|---|---|---|---|
| 2/2, 3/3, 2/2/3 en 12h08 | 18 | 188h09 | 10 j (83h30) |
| mêmes cycles en 11h08 | 18 | 53h27 | 6 j (50h06) |
| 4/2 | 23 | 41h45 | 5 j |
| Vacation forte | 20 | 19h02 | 2 j |
| Hebdomadaire | 25 | — (RTT/ARTT en jours) | — |

- **Plus de journée de solidarité** déduite des RTC (retirée en 1.15).
- Vacation ≤ 11h38 → dotation 11h08 (`SEUIL_VACATION_12H08`). Les colonnes
  PA-PTS de la grille ne sont pas gérées.
- **CET** : versement en janvier au titre de l'année écoulée. Garde 15 jours,
  puis +10 jours par an au maximum, plafond 60 (jusqu'à 80 gelés après les
  relèvements COVID/JOP). Au-delà : indemnisation (A 150 €, B 100 €, C 83 € le
  jour) ou RAFP. Sources : tous les RTC (8h21 le jour), tous les ARTT/RTT,
  5 CA (si 15 CA pris, 20 en hebdo) + CA HP, 5 jours d'HS.
- **CA HP** : 1 jour dès 5 CA posés hors période (« +1 CAS pour 5 à 7 CA ») (1/01–30/04, 1/11–31/12),
  2 jours dès 8.
- **CF** : 109h12 par an, à lisser ; abattement de 1/24 par tranche de 15 jours
  de CMO consécutifs.
- **RPS** : 0,1 par heure de nuit (21h–6h), 0,4 pour toutes les heures du
  dimanche ; taux le plus haut par minute, arrondi à la minute.
- **HS** : temps pour temps (pas de majoration de 50 %), stock plafonné à 160h.

## Commandes

```bash
npm run dev                 # http://localhost:3000
npm run test:tz             # suite complète dans 5 fuseaux
npx tsc --noEmit --incremental false
npm run build               # build web
npm run build:capacitor     # export statique pour iOS (met app/api de côté)
bash deploy.sh              # déploiement web (après accord) : bump SW, rsync --delete, build, pm2
```

Test sur téléphone en réseau local : build de prod avec `CHRONOS_LOCAL_HTTP=1`
(sinon HTTPS forcé), et donner l'IP du Mac à Android (il ne résout pas `.local`).

## iOS (App Store)

- Bundle `fr.mychronos.app`, équipe `MTBUU2T4WW`, profil manuel « MyChronos
  AppStore ». `PRODUCT_NAME = "MyChronos"` sans accent (sinon erreur 90034).
- Version : `package.json` + `APP_VERSION` (`lib/constants.ts`) +
  `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` dans
  `ios/App/App.xcodeproj/project.pbxproj` (configurations Debug et Release).
  Un train de version fermé par Apple (erreur 90186) impose une nouvelle
  `MARKETING_VERSION`.
- Étapes : `npm run build:capacitor` → `npx cap sync ios` → vérifier que le
  signing du pbxproj est intact → `xcodebuild archive` (scheme App, Release,
  `generic/platform=iOS`) → `xcodebuild -exportArchive -exportOptionsPlist
  ../ExportOptionsUpload.plist` (fichier versionné dans `ios/` : method
  app-store-connect, signing manuel, destination upload). Xcode n'est pas nécessaire à l'ouverture.
- `Info.plist` porte `UIUserInterfaceStyle = Light` et
  `ITSAppUsesNonExemptEncryption = false` ; `cap sync` n'y touche pas.

## Android (app native Capacitor)

Dossier `android/` (Capacitor 8, JDK 21 obligatoire, pas le 25). L'app charge
`https://mychronos.fr/dashboard` dans sa propre WebView (`server.url`, choisi
par `capacitor.config.ts` quand la commande contient « android ») : tout
déploiement web la met à jour, mais les données vivent dans l'app et plus dans
le navigateur du téléphone (cause des pertes de données de l'ancienne TWA).
Copie native `files/chronos-backup.json` (même code que l'iPhone, incluse
dans la sauvegarde automatique Android), restaurée si le stockage web est vidé.

- Build Play Store : `npm run build:android` → `android/app/build/outputs/bundle/release/app-release.aab`.
  Le script vérifie la signature (clé d'envoi de `chronos-android/keystore.properties`,
  gitignoré) et que l'app pointe sur mychronos.fr.
- Version : `versionCode` / `versionName` dans `android/app/build.gradle`
  (3 = dernière TWA, 4 = première version Capacitor, 5 = nouvelle tentative auto de la page « Pas de connexion »). Ne change que si le code
  natif change ; le contenu suit le site.
- Module natif `ChronosNatifPlugin.java` (`lib/natif-android.ts`) : liste et
  ouverture des navigateurs, réception du lien `fr.mychronos.app://transfert`,
  « Enregistrer sous » pour la sauvegarde (la WebView ne télécharge pas).
- Passage TWA → app native (`lib/transfert.ts`) : à l'inscription, l'encart
  « Vous utilisiez déjà My Chronos ? » ouvre `mychronos.fr/transfert` dans le
  navigateur, qui renvoie les données brutes (gzip, base64url) par le lien ;
  l'app vérifie et demande confirmation. Rien n'est effacé du navigateur.
- Test sur émulateur : `CHRONOS_ANDROID_URL=http://localhost:3012/dashboard npx cap sync android`
  + `adb reverse tcp:3012 tcp:3012` (localhost = contexte sécurisé, sinon pas de
  service worker). **Toujours refaire `npm run build:android` ensuite.**
- `chronos-android/` : ancien projet TWA, gardé pour la clé d'envoi.
  `assetlinks.json` peut rester en place.

## Communauté Discord et Marco

Lien permanent `https://discord.gg/bhDaJRqEHx` (`lib/communaute.ts`). Le bot
**Marco** est un projet séparé (`../chronos-discord-bot`, service systemd
cloisonné sur le VPS). Ses connaissances (`connaissances/guide-app.md`,
`feuille-de-route.md`) **sont à mettre à jour à chaque version publiée**.

## Pièges connus

- `output: 'export'` (iOS) : `trailingSlash: true` et images non optimisées,
  sinon boucle de rechargement ou logo cassé dans l'app.
- Service worker : pas de `clients.claim()` ; rechargement uniquement après
  clic sur « Mettre à jour ».
- `deploy.sh` conserve 14 jours les fichiers JS des builds précédents
  (évite les ChunkLoadError des apps restées ouvertes).
- Les dates sans heure (`YYYY-MM-DD`) se lisent en heure locale (`jourLocal`),
  jamais en UTC : l'app est utilisée en Outre-mer.
