// Image PNG du planning partagé (canvas, dans le navigateur ou la WebView).
// 1 mois : grande grille avec étiquettes et horaires ; 3 ou 6 mois : grilles
// compactes sur deux colonnes.

import { COULEURS_PARTAGE, MOIS_FR, joursDuMois, periodePartage, type NatureJourPartage, type PlanningPartage } from './partage';

const ECHELLE = 2;
const LARGEUR = 540;
const MARGE = 12;
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Bloc { x: number; y: number; largeur: number; compact: boolean }

function hauteurBloc(semaines: number, compact: boolean): number {
  const cellule = compact ? 30 : 62;
  return 26 + 16 + semaines * cellule + 10;
}

function semainesDuMois(annee: number, mois: number): number {
  const premier = (new Date(annee, mois, 1).getDay() + 6) % 7;
  const jours = new Date(annee, mois + 1, 0).getDate();
  return Math.ceil((premier + jours) / 7);
}

function couper(ctx: CanvasRenderingContext2D, texte: string, largeurMax: number): string {
  if (ctx.measureText(texte).width <= largeurMax) return texte;
  let t = texte;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largeurMax) t = t.slice(0, -1);
  return `${t}…`;
}

function dessinerMois(ctx: CanvasRenderingContext2D, p: PlanningPartage, rang: number, b: Bloc, presentes: Set<NatureJourPartage>) {
  const jours = joursDuMois(p, rang);
  const d0 = jours[0]!.date;
  const cellule = b.compact ? 30 : 62;
  const largeurCase = b.largeur / 7;

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 ${b.compact ? 13 : 16}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const nom = `${MOIS_FR[d0.getMonth()]![0]!.toUpperCase()}${MOIS_FR[d0.getMonth()]!.slice(1)} ${d0.getFullYear()}`;
  ctx.fillText(nom, b.x + b.largeur / 2, b.y + 17);

  ctx.font = `600 ${b.compact ? 9 : 10}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = '#64748b';
  JOURS.forEach((j, i) => ctx.fillText(j, b.x + largeurCase * i + largeurCase / 2, b.y + 36));

  const decalage = (d0.getDay() + 6) % 7;
  const haut = b.y + 42;
  jours.forEach((jour, k) => {
    const pos = decalage + k;
    const x = b.x + (pos % 7) * largeurCase;
    const y = haut + Math.floor(pos / 7) * cellule;
    const c = COULEURS_PARTAGE[jour.nature];
    presentes.add(jour.nature);
    ctx.fillStyle = c.fond;
    ctx.fillRect(x, y, largeurCase, cellule);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, largeurCase - 1, cellule - 1);

    ctx.fillStyle = c.texte;
    ctx.font = `${jour.nature === 'R' ? 500 : 700} ${b.compact ? 10 : 12}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(jour.date.getDate()), x + largeurCase / 2, y + (b.compact ? 12 : 16));
    if (jour.etiquette) {
      ctx.font = `700 ${b.compact ? 7.5 : 9}px Inter, system-ui, sans-serif`;
      ctx.fillText(couper(ctx, b.compact ? jour.etiquette.split(' ')[0]! : jour.etiquette, largeurCase - 4), x + largeurCase / 2, y + (b.compact ? 24 : 33));
    }
    if (!b.compact && jour.horaires) {
      ctx.font = '500 8.5px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#1d4ed8';
      ctx.fillText(couper(ctx, jour.horaires, largeurCase - 4), x + largeurCase / 2, y + (jour.etiquette ? 47 : 36));
    }
  });
}

/** Dessine le planning et renvoie l'image PNG. */
export async function imagePlanning(p: PlanningPartage): Promise<Blob> {
  const [a, m] = p.du.split('-').map(Number);
  const compact = p.mois > 1;
  const colonnes = compact ? 2 : 1;
  const largeurBloc = (LARGEUR - MARGE * (colonnes + 1)) / colonnes;
  const rangees: number[] = [];
  for (let r = 0; r < p.mois; r += colonnes) {
    let h = 0;
    for (let c = 0; c < colonnes && r + c < p.mois; c++) {
      const d = new Date(a!, m! - 1 + r + c, 1);
      h = Math.max(h, hauteurBloc(semainesDuMois(d.getFullYear(), d.getMonth()), compact));
    }
    rangees.push(h);
  }
  const ENTETE = 64;
  const PIED = 54;
  const hauteur = ENTETE + MARGE + rangees.reduce((s, h) => s + h + MARGE, 0) + PIED;

  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR * ECHELLE;
  canvas.height = hauteur * ECHELLE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ECHELLE, ECHELLE);
  ctx.fillStyle = '#f8f9fc';
  ctx.fillRect(0, 0, LARGEUR, hauteur);

  // En-tête bleu nuit, comme l'app
  const g = ctx.createLinearGradient(0, 0, LARGEUR, ENTETE);
  g.addColorStop(0, '#0a1628');
  g.addColorStop(0.55, '#0d2347');
  g.addColorStop(1, '#0055A4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LARGEUR, ENTETE);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = '800 19px Inter, system-ui, sans-serif';
  ctx.fillText(couper(ctx, p.titre ?? 'Planning', LARGEUR - 2 * MARGE - 8), MARGE + 4, 28);
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#bfdbfe';
  ctx.fillText(periodePartage(p), MARGE + 4, 48);
  const tri = ctx.createLinearGradient(MARGE, 0, LARGEUR - MARGE, 0);
  tri.addColorStop(0, '#0055A4'); tri.addColorStop(0.33, '#0055A4'); tri.addColorStop(0.33, '#ffffff');
  tri.addColorStop(0.66, '#ffffff'); tri.addColorStop(0.66, '#EF4135'); tri.addColorStop(1, '#EF4135');
  ctx.fillStyle = tri;
  ctx.fillRect(MARGE, ENTETE - 8, LARGEUR - 2 * MARGE, 3);

  const presentes = new Set<NatureJourPartage>();
  let y = ENTETE + MARGE;
  let rang = 0;
  for (const h of rangees) {
    for (let c = 0; c < colonnes && rang < p.mois; c++, rang++) {
      const x = MARGE + c * (largeurBloc + MARGE);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 4, y - 2, largeurBloc + 8, h);
      dessinerMois(ctx, p, rang, { x, y, largeur: largeurBloc, compact }, presentes);
    }
    y += h + MARGE;
  }

  // Légende et pied de page
  const items = (['T', 'R', 'C', 'P', 'A'] as NatureJourPartage[]).filter((n) => presentes.has(n));
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  const largeurs = items.map((n) => 14 + ctx.measureText(COULEURS_PARTAGE[n].nom).width + 12);
  let lx = (LARGEUR - largeurs.reduce((s, w) => s + w, 0)) / 2;
  items.forEach((n, k) => {
    ctx.fillStyle = COULEURS_PARTAGE[n].fond;
    ctx.fillRect(lx, y + 2, 10, 10);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(lx + 0.5, y + 2.5, 9, 9);
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(COULEURS_PARTAGE[n].nom, lx + 14, y + 11);
    lx += largeurs[k]!;
  });
  const le = new Date(p.le);
  ctx.font = '500 9.5px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText(`Partagé le ${le.toLocaleDateString('fr-FR')} · My Chronos — mychronos.fr`, LARGEUR / 2, y + 32);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/png'));
}
