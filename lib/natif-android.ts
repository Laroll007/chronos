// Fonctions natives de l'app Android (android/app/src/main/java/fr/mychronos/app/ChronosNatifPlugin.java).
// À n'appeler que dans l'app Android native (`plateformeNative() === 'android'`).

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface Navigateur {
  paquet: string;
  nom: string;
  defaut: boolean;
}

interface ChronosNatif {
  navigateurs(): Promise<{ navigateurs: Navigateur[] }>;
  ouvrirNavigateur(options: { url: string; paquet?: string }): Promise<void>;
  enregistrerFichier(options: { nom: string; contenu: string }): Promise<{ enregistre: boolean }>;
  addListener(evenement: 'transfert', rappel: (e: { donnees: string }) => void): Promise<PluginListenerHandle>;
}

export const ChronosNatif = registerPlugin<ChronosNatif>('ChronosNatif');
