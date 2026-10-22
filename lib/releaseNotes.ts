// Nouveautés présentées une fois, à la première ouverture après une mise à jour.
//
// N'y inscrire que les versions qui changent vraiment l'usage : une fenêtre à
// chaque correctif finirait par être fermée sans être lue.

import { APP_VERSION } from './constants';

export type ReleaseAction = 'cycle' | 'cet' | 'communaute' | 'sondage' | 'partage';

export interface ReleaseItem {
  emoji: string;
  /** Logo à la place de l'émoji (marque reconnaissable, ex. Discord). */
  logo?: 'discord';
  title: string;
  text: string;
  /** Mise en garde affichée en petit sous le texte. */
  note?: string;
  /** Raccourci vers l'écran concerné. */
  action?: { label: string; target: ReleaseAction };
  /** Message mis en avant (soutien…) : encadré centré, plus grand ; pas une nouveauté. */
  enAvant?: boolean;
}

export interface ReleaseNote {
  version: string; // semver, comparé à APP_VERSION
  items: ReleaseItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.22.0',
    items: [
      {
        emoji: '📤',
        title: 'Partage ton planning',
        text: 'Sous le planning, « Partager mon planning » l’envoie en image ou en lien par WhatsApp, Signal, Telegram, mail… sur 1, 3 ou 6 mois. Par défaut, il affiche « Congé » ou « Absent » sans préciser CA, RTC ou CMO. Tes compteurs ne sont jamais partagés.',
        action: { label: 'Partager mon planning', target: 'partage' },
      },
      {
        emoji: '📍',
        title: 'Outre-mer et Alsace-Moselle',
        text: 'Indique ton lieu d’affectation dans « Mon cycle » : l’app ajoute les jours fériés locaux (abolition de l’esclavage, Vendredi saint, 26 décembre) et ajuste ton crédit férié (CF).',
        action: { label: 'Indiquer mon lieu', target: 'cycle' },
      },
      {
        emoji: '🗓️',
        title: 'Planning plus net',
        text: 'Le planning prend plus de place et affiche toujours le type de chaque jour (CA, RTC, CMO…).',
      },
      {
        emoji: '🛠️',
        title: 'Corrections',
        text: 'Supprimer un congé d’une année déjà terminée ne modifie plus les compteurs de la nouvelle année. Sur iPhone, « Exporter » (Paramètres › Sauvegarde) ouvre maintenant la fenêtre de partage pour enregistrer ou envoyer ta sauvegarde.',
      },
    ],
  },
  {
    version: '1.21.0',
    items: [
      {
        emoji: '🎆',
        title: 'Préparons 2027 ensemble',
        text: 'En 1 minute, vérifie les congés que l’app te créditera au 1er janvier pour ton cycle (CA, RTC, CF…), ou corrige-les avec ton relevé GesTT : tes chiffres seront appliqués pour toi. Tes réponses, anonymes, aident tous les collègues.',
        action: { label: 'Répondre (1 minute)', target: 'sondage' },
      },
      {
        emoji: '👶',
        title: 'Congé maternité et CA reportés (CAM)',
        text: 'Dans « Autre absence » : congé maternité, congé pathologique et congé de paternité, sans effet sur tes CF ni ton ARTT. Les CA que tu n’as pas pu prendre se reportent en CAM (4 semaines au plus, avant le 31 mars de N+2) : nouveau compteur dans « Gérer mes compteurs », et l’app te le propose au 1er janvier.',
      },
      {
        emoji: '🔁',
        title: 'En cycle, tes « ARTT » sont tes RTC',
        text: 'La grille appelle les RTC « ARTT ». Au 1er janvier, l’app ne créditera plus 20 jours d’ARTT en plus de tes RTC, sauf si tu indiques dans le sondage que ce sont deux compteurs différents.',
      },
      {
        emoji: '🌙',
        title: 'Report de RPS',
        text: 'Au 1er janvier, le détail de tes RPS affichera bien ton report de l’année précédente.',
      },
    ],
  },
  {
    version: '1.20.0',
    items: [
      {
        emoji: '💪',
        title: 'Soutien à tous les collègues',
        text: 'Courage en cette période difficile.',
        enAvant: true,
      },
      {
        emoji: '🩹',
        title: 'Blessure en service (BS)',
        text: 'En marquant un arrêt, choisis « Blessure en service (BS) » : contrairement à un arrêt maladie (CMO), elle ne réduit ni ton ARTT ni tes CF.',
      },
      {
        emoji: '🗓️',
        title: 'Tes congés lisibles d’un coup d’œil',
        text: 'Chaque jour du planning affiche son type : CA, RTC, CF + HS, RTC 4h… mais aussi CMO, BS, astreinte ou absence. Une case sous le planning permet de revenir à l’affichage d’avant.',
      },
      {
        emoji: '🏝️',
        title: 'Congés bonifiés',
        text: 'Ils se décomptent en jours calendaires, repos et fériés compris (31 jours au plus), comme dans GesTT.',
      },
      {
        emoji: '🏛️',
        title: 'Tu es élu ?',
        text: 'Conseiller municipal, départemental ou régional : pose tes séances (AME), ton crédit d’heures (CME, en journée ou en heures) et ta formation d’élu. Ton crédit CME du trimestre est suivi dans tes compteurs.',
      },
      {
        emoji: '🎓',
        title: 'Élève ou stagiaire ?',
        text: 'Pas encore de CET ? Coche « Je n’ai pas encore de CET » dans Gérer mes compteurs : l’appli te propose d’abord les congés qui se perdent au 31 décembre.',
      },
      {
        emoji: '🧮',
        title: 'Simulateur de départ à la retraite plus juste',
        text: 'Pour un départ dans plusieurs années, il considère maintenant que tu poses tes congés chaque année : seuls ton CET, tes HS et tes RPS s’accumulent jusqu’au départ.',
      },
      {
        emoji: '➕',
        title: 'CA HP à ajouter',
        text: 'La carte « CA Hors Période » est toujours visible dans tes compteurs : touche-la pour saisir des CA HP déjà obtenus.',
      },
      {
        emoji: '🌙',
        title: 'Avance de RPS',
        text: 'Comme dans GesTT, tu peux poser plus de RPS que ton solde (avance accordée par ton service) : dans « Poser librement mes congés », ton solde passe en négatif au lieu d’être complété par tes HS.',
      },
      {
        emoji: '🎨',
        title: 'Paramètres plus lisibles',
        text: 'Chaque partie a sa couleur, les boutons sont plus clairs. Dans ton profil, « Je choisis ce que j’épargne » ouvre ton plan d’épargne CET.',
      },
    ],
  },
  {
    version: '1.19.0',
    items: [
      {
        emoji: '🔁',
        title: 'Tu changes de cycle en cours d’année ?',
        text: 'Mutation, changement de service : dans « Modifier mon cycle », choisis « Je change de cycle » et indique ton dernier jour et le premier du nouveau. L’ancien cycle reste sur ton planning, tes droits de l’année sont recalculés au prorata et tes RPS suivent le nouveau cycle.',
        action: { label: 'Modifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '📟',
        title: 'Rappel sur un repos : le barème APORTT',
        text: 'Sur un RL : 1 vacation (moins de 4h) ou 2 vacations (plus de 4h). Sur un RC : 150 % des heures. Sans RPS. Tu peux aussi recopier les HS de GesTT.',
      },
      {
        emoji: '⏱️',
        title: 'Une journée en heures : ton RTC libre d’abord',
        text: 'Pour compléter une journée, l’app prend tout ton RTC libre (sans toucher à ta réserve CET), puis complète avec tes HS ou tes RPS.',
      },
      {
        emoji: '🌙',
        title: 'RPS de nuit corrigés',
        text: 'Une nuit de semaine crédite bien 54 min de RPS (le réglage « Service de nuit » en donnait 1h13).',
      },
    ],
  },
  {
    version: '1.18.0',
    items: [
      {
        emoji: '🔒',
        title: 'Tes congés prévisionnels d’un coup d’œil',
        text: 'Quand tu poses des jours, coche « Congé prévisionnel » : ils apparaissent hachurés avec un cadenas sur le planning, et le filtre « Prévisionnels » les liste tous.',
      },
      {
        emoji: '📆',
        title: 'Poser l’année prochaine sur ses droits',
        text: 'Des congés posés pour l’an prochain ne touchent plus tes compteurs actuels : ils sont pris sur tes droits de l’année suivante, déduits automatiquement au 1er janvier.',
      },
      {
        emoji: '⏪',
        title: 'Congés antérieurs sans décompte',
        text: 'Inscrit en cours d’année ? Pose tes congés passés en cochant « ce sont des congés antérieurs » : ils s’affichent sur le planning sans toucher à tes compteurs.',
      },
      {
        emoji: '✅',
        title: 'CA HP : la bonne règle',
        text: 'Le 1er jour de CA HP s’obtient à partir de 5 CA posés hors période (et non 4), le 2e à partir de 8.',
      },
    ],
  },
  {
    version: '1.17.0',
    items: [
      {
        emoji: '📅',
        title: 'Un planning plus grand et plus lisible',
        text: 'Le calendrier prend toute la largeur de l’écran, tous tes événements ont la même barre colorée et tu en vois jusqu’à 3 par jour.',
      },
      {
        emoji: '🏦',
        title: 'Ton épargne CET, compteur par compteur',
        text: 'Choisis combien de RTC, CA, CA HP ou HS tu épargnes, demi-journées comprises. Ou en un geste : « Épargner le max sans me faire payer », ou « en me faisant payer » le surplus.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
      {
        emoji: '✏️',
        title: 'Modifier une période à plusieurs compteurs',
        text: 'Une période posée en CA + CET (ou autre mélange) se modifie maintenant directement, sans la supprimer.',
      },
    ],
  },
  {
    version: '1.16.0',
    items: [
      {
        emoji: '📏',
        title: 'Tes RTC selon la grille officielle',
        text: 'La dotation annuelle de RTC et le conseil pour le CET suivent maintenant ton cycle et la durée de tes vacations : 188h09 en 12h08, 53h27 en 11h08. Vérifie que ton cycle est bien réglé.',
        action: { label: 'Vérifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '🗓️',
        title: 'Cycles 4/2 et 2/2',
        text: 'Ils sont disponibles ! Et si tes horaires changent, chaque jour travaillé du planning affiche sa pastille (S pour soirée, M pour matinée…).',
        action: { label: 'Modifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '🔄',
        title: 'Des horaires qui changent',
        text: 'Deux cycles de soirée puis un de matinée, ou deux soirées puis deux matinées dans le même cycle ? Indique tes deux jeux d’horaires : RPS et journées modifiées suivent les bons horaires chaque jour.',
        action: { label: 'Régler mes horaires', target: 'cycle' },
      },
      {
        emoji: '🏦',
        title: 'ARTT et RTT vers le CET',
        text: 'Tes ARTT et tes RTT peuvent maintenant alimenter ton CET en janvier, en totalité.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
    ],
  },
  {
    version: '1.15.0',
    items: [
      {
        emoji: '💬',
        logo: 'discord',
        title: 'Rejoins la communauté My Chronos !',
        text: 'My Chronos est né d’un agent, pour les agents… et maintenant, il grandit avec toi. Une idée, un bug, une question ? Rejoins la toute nouvelle communauté sur Discord : tes retours orientent directement les prochaines versions. Et Marco, l’assistant qui connaît l’app par cœur, est là pour te répondre.',
        note: 'Reste anonyme : ne partage jamais ton nom, ton matricule, ton grade, ton service, ton lieu de travail ni de photo de document. Le serveur est ouvert à tous, et les messages adressés à Marco sont traités par une IA.',
        action: { label: 'Rejoindre la communauté', target: 'communaute' },
      },
      {
        emoji: '🏦',
        title: 'Garde tes RTC et HS pour le CET',
        text: 'Choisis combien de jours de RTC (10 par défaut) et d’HS mettre de côté : ils ne te sont plus proposés à la pose et passent en premier dans le versement de janvier.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
      {
        emoji: '📋',
        title: 'ASA, Art. 13, CFS, EXN, repos décalé',
        text: 'Marque ces absences sur ton planning, sans toucher à tes compteurs : touche le jour, puis « Autre absence ».',
      },
    ],
  },
  {
    version: '1.14.0',
    items: [
      {
        emoji: '🔁',
        title: 'Le cycle 3/3 est disponible',
        text: '3 jours travaillés, 3 jours de repos : choisissez-le dans votre cycle et indiquez où vous en êtes aujourd’hui. RC, RL et RPS sont calculés comme pour les autres cycles.',
        action: { label: 'Modifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '⏳',
        title: 'Une journée sur plusieurs compteurs',
        text: 'Dans « Choix libre », les RTC, RPS, HS et CF se posent en heures : une nuit en 7h35 de RTC et 4h33 de RPS, ou 7h de RTC complétées par du RPS.',
      },
      {
        emoji: '💰',
        title: 'Épargne CET : les vraies règles',
        text: 'Tous vos RTC restants peuvent aller au CET. Au-delà de 15 jours, le CET ne garde que 10 jours de plus par an : l’app vous conseille le bon versement et estime l’indemnisation du surplus.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
      {
        emoji: '🧮',
        title: 'Gérer mes compteurs',
        text: 'Un compteur oublié à l’inscription (RTC, ARTT…) ? Ajoutez-le depuis Compteurs → « Gérer mes compteurs ».',
      },
    ],
  },
  {
    version: '1.13.0',
    items: [
      {
        emoji: '✏️',
        title: 'Modifiez une journée',
        text: 'Touchez deux fois un jour : horaires réels (heures en plus, prise décalée, travail sur un repos) ou stage. Vos HS et RPS sont crédités automatiquement, nuit, dimanche, RC, RL et jours fériés compris.',
      },
      {
        emoji: '🗓️',
        title: 'Un planning façon agenda',
        text: 'Chaque jour dans sa case, vos événements en couleur avec leur titre, et une barre continue pour ceux qui durent plusieurs jours. Choisissez la couleur de chaque événement.',
      },
    ],
  },
  {
    version: '1.12.0',
    items: [
      {
        emoji: '⏱️',
        title: 'RPS crédités au bon taux',
        text: 'Indiquez vos horaires de prise et de fin de service : vos RPS de nuit (21h–6h) et du dimanche sont crédités automatiquement après chaque vacation, comme dans GesTT. Jour, nuit ou horaires mixtes.',
        action: { label: 'Renseigner mes horaires', target: 'cycle' },
      },
      {
        emoji: '📌',
        title: 'Vos événements sur le planning',
        text: 'RDV, formation, audience… Sélectionnez un jour ou utilisez « Mes événements » sous le calendrier. Sans effet sur vos compteurs.',
      },
      {
        emoji: '💰',
        title: 'Mon épargne CET',
        text: 'Combien vous pouvez verser au CET et quels congés choisir. Dans Compteurs → « Combien puis-je verser au CET ? ».',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
    ],
  },
];

const SEEN_KEY = 'chronos_release_seen';

/** Comparaison semver simple : -1, 0 ou 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Notes à présenter : celles postérieures à la dernière vue, jusqu'à la version
 * installée (une note écrite pour la 1.13 n'apparaît pas dans une 1.12).
 */
export function pendingReleaseNotes(
  seen: string | null = readSeen(),
  current: string = APP_VERSION
): ReleaseNote[] {
  return RELEASE_NOTES.filter(
    (n) => compareVersions(n.version, current) <= 0 && (!seen || compareVersions(n.version, seen) > 0)
  ).sort((a, b) => compareVersions(b.version, a.version));
}

/** Marque tout ce qui est publié comme vu (nouvel inscrit, ou fenêtre fermée). */
export function markReleaseNotesSeen(current: string = APP_VERSION): void {
  try {
    localStorage.setItem(SEEN_KEY, current);
  } catch {
    /* la fenêtre réapparaîtra, sans gravité */
  }
}
