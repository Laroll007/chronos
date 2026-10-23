// Envoi du planning partagé par la fenêtre de partage du téléphone
// (WhatsApp, Signal, Telegram, Mail…). L'app ne sait pas à qui il est envoyé.

import { plateformeNative } from './api';

export type ResultatPartage = 'ok' | 'annule' | 'copie' | 'telecharge';

async function blobEnBase64(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/** Image PNG : iPhone/Android via Capacitor, navigateur via le partage web (sinon téléchargement). */
export async function partagerImage(image: Blob, nomFichier: string, titre: string): Promise<ResultatPartage> {
  if (plateformeNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    await Filesystem.writeFile({ path: nomFichier, data: await blobEnBase64(image), directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: nomFichier, directory: Directory.Cache });
    try {
      await Share.share({ title: titre, files: [uri], dialogTitle: 'Partager mon planning' });
      return 'ok';
    } catch {
      return 'annule';
    }
  }
  const fichier = new File([image], nomFichier, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: titre });
      return 'ok';
    } catch {
      return 'annule';
    }
  }
  const url = URL.createObjectURL(image);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'telecharge';
}

/**
 * Contenu du partage natif d'un lien. Sur iPhone, un texte et un lien séparés
 * restent bloqués dans WhatsApp (envoi en attente plusieurs minutes) : le lien
 * part donc DANS le texte, comme un message tapé à la main. Android réunit déjà
 * texte et lien en un seul message.
 */
export function contenuPartageNatif(
  plateforme: 'ios' | 'android',
  contenu: { title: string; text: string; url: string }
): { title: string; text: string; url?: string } {
  if (plateforme === 'ios') return { title: contenu.title, text: `${contenu.text}\n${contenu.url}` };
  return contenu;
}

/** Lien : partage natif ou web ; à défaut, copié dans le presse-papiers. */
export async function partagerLien(url: string, titre: string): Promise<ResultatPartage> {
  const texte = `${titre} (My Chronos)`;
  const natif = plateformeNative();
  if (natif) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ ...contenuPartageNatif(natif, { title: titre, text: texte, url }), dialogTitle: 'Partager mon planning' });
      return 'ok';
    } catch {
      return 'annule';
    }
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titre, text: texte, url });
      return 'ok';
    } catch {
      return 'annule';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copie';
}
