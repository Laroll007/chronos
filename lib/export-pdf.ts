// Export PDF pour Chronos - Rapport annuel et récapitulatif CET

import { Counters, CycleConfig, HistoryEntry } from './types';
import { formatMinutes, getRTCLibres, calculateOptimalCETStrategy } from './calculations';
import {
  CA_MAX_VERS_CET,
  RTC_RESERVES_CET,
  RTC_MAX_JOURS_CET,
  CF_TOTAL_ANNUEL,
  CET_PLAFOND,
} from './constants';

// ============================================
// TYPES
// ============================================

export interface PDFReportData {
  counters: Counters;
  cycleConfig: CycleConfig;
  history: HistoryEntry[];
  generatedAt: Date;
  year: number;
}

// ============================================
// GÉNÉRATION HTML POUR IMPRESSION PDF
// ============================================

/**
 * Génère le HTML du rapport annuel pour impression PDF
 */
export function generateAnnualReportHTML(data: PDFReportData): string {
  const { counters, cycleConfig, history, generatedAt, year } = data;
  const cetProjection = calculateOptimalCETStrategy(counters);
  const rtcLibres = getRTCLibres(counters.rtc);

  // Filtrer l'historique de l'année
  const yearHistory = history.filter((entry) => {
    const entryYear = new Date(entry.date).getFullYear();
    return entryYear === year;
  });

  // Grouper par type
  const historyByType = yearHistory.reduce((acc, entry) => {
    if (!acc[entry.type]) acc[entry.type] = [];
    acc[entry.type].push(entry);
    return acc;
  }, {} as Record<string, HistoryEntry[]>);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>My Chronos - Rapport Annuel ${year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1e293b;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3b82f6;
    }
    .header h1 { color: #1e40af; font-size: 28px; margin-bottom: 8px; }
    .header .subtitle { color: #64748b; font-size: 14px; }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .card-title { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .card-value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .card-detail { font-size: 12px; color: #64748b; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .table th, .table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .table th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; color: #64748b; }
    .table td { font-size: 14px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .alert-success { background: #dcfce7; border-left: 4px solid #22c55e; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    .print-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimer / Sauvegarder PDF</button>

  <div class="header">
    <h1>Rapport Annuel My Chronos</h1>
    <div class="subtitle">Année ${year} - Généré le ${generatedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Soldes des Compteurs</h2>
    <div class="grid">
      <div class="card">
        <div class="card-title">Congés Annuels (CA)</div>
        <div class="card-value">${counters.ca} jours</div>
        <div class="card-detail">${counters.caConsommes} posés cette année | Max CET: ${CA_MAX_VERS_CET}j</div>
      </div>
      <div class="card">
        <div class="card-title">CA Hors Période</div>
        <div class="card-value">${counters.caHP} jours</div>
        <div class="card-detail">${counters.caPosesHorsPeriode}/8 CA posés HP${counters.caHP > 0 ? ' - Bonus obtenu !' : ''}</div>
      </div>
      <div class="card">
        <div class="card-title">Crédits Fériés (CF)</div>
        <div class="card-value">${formatMinutes(counters.cf)}</div>
        <div class="card-detail">S1: ${formatMinutes(counters.cfConsoS1)} | S2: ${formatMinutes(counters.cfConsoS2)} consommés</div>
      </div>
      <div class="card">
        <div class="card-title">RTC</div>
        <div class="card-value">${formatMinutes(counters.rtc)}</div>
        <div class="card-detail">Libres: ${formatMinutes(rtcLibres)} | Réservés CET: ${formatMinutes(RTC_RESERVES_CET)}</div>
      </div>
      <div class="card">
        <div class="card-title">RPS</div>
        <div class="card-value">${formatMinutes(counters.rps)}</div>
        <div class="card-detail">Année préc.: ${formatMinutes(counters.rpsAnneePrec)}</div>
      </div>
      <div class="card">
        <div class="card-title">Heures Sup (HS)</div>
        <div class="card-value">${formatMinutes(counters.hs)}</div>
        <div class="card-detail">Max stockable: 160h</div>
      </div>
      <div class="card">
        <div class="card-title">CET</div>
        <div class="card-value">${counters.cet} jours</div>
        <div class="card-detail">Objectif: ${counters.objectifCET}j | Plafond: ${CET_PLAFOND}j</div>
      </div>
      ${counters.hasRTT && counters.rtt !== undefined ? `
      <div class="card">
        <div class="card-title">RTT</div>
        <div class="card-value">${formatMinutes(counters.rtt)}</div>
      </div>
      ` : ''}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Projection CET</h2>
    ${cetProjection.isOptimal ? `
    <div class="alert alert-success">
      <strong>Objectif atteignable !</strong> Vous pouvez atteindre ${counters.objectifCET} jours CET cette année.
    </div>
    ` : `
    <div class="alert alert-warning">
      <strong>Attention :</strong> Objectif CET non atteint avec les compteurs actuels.
    </div>
    `}
    <div class="grid">
      <div class="card">
        <div class="card-title">Apport RTC vers CET</div>
        <div class="card-value">${cetProjection.apportCET.rtc} jours</div>
        <div class="card-detail">Gain net: ${formatMinutes(cetProjection.gainNetRTC)}</div>
      </div>
      <div class="card">
        <div class="card-title">Apport CA vers CET</div>
        <div class="card-value">${cetProjection.apportCET.ca + cetProjection.apportCET.caHP} jours</div>
        <div class="card-detail">CA: ${cetProjection.apportCET.ca}j + HP: ${cetProjection.apportCET.caHP}j</div>
      </div>
      <div class="card">
        <div class="card-title">CET Final Projeté</div>
        <div class="card-value">${cetProjection.cetFinal} jours</div>
      </div>
      <div class="card">
        <div class="card-title">Jours Économisés</div>
        <div class="card-value">${cetProjection.joursEconomises} jours</div>
        <div class="card-detail">Via conversion RTC avantageuse</div>
      </div>
    </div>
  </div>

  ${yearHistory.length > 0 ? `
  <div class="section page-break">
    <h2 class="section-title">Historique ${year}</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Action</th>
          <th>Montant</th>
        </tr>
      </thead>
      <tbody>
        ${yearHistory.slice(0, 50).map((entry) => `
        <tr>
          <td>${new Date(entry.date).toLocaleDateString('fr-FR')}</td>
          <td><span class="badge badge-info">${entry.type.toUpperCase()}</span></td>
          <td>${getActionLabel(entry.action)}</td>
          <td>${formatEntryAmount(entry)}</td>
        </tr>
        `).join('')}
        ${yearHistory.length > 50 ? `
        <tr>
          <td colspan="4" style="text-align: center; color: #64748b;">
            ... et ${yearHistory.length - 50} autres entrées
          </td>
        </tr>
        ` : ''}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Configuration du Cycle</h2>
    <div class="grid">
      <div class="card">
        <div class="card-title">Type de cycle</div>
        <div class="card-value">${cycleConfig.type === 'alterne' ? 'Alterné A/B' : 'Hebdomadaire'}</div>
        <div class="card-detail">Pattern: ${cycleConfig.pattern || 'Personnalisé'}</div>
      </div>
      <div class="card">
        <div class="card-title">Durée journée</div>
        <div class="card-value">${formatMinutes(cycleConfig.heuresParJour)}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Document généré par My Chronos - Gestion des congés policiers</p>
    <p>Ce document est un récapitulatif personnel et n'a pas de valeur administrative.</p>
  </div>
</body>
</html>
`;
}

/**
 * Génère le HTML du récapitulatif CET
 */
export function generateCETReportHTML(data: PDFReportData): string {
  const { counters, generatedAt, year } = data;
  const cetProjection = calculateOptimalCETStrategy(counters);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>My Chronos - Récapitulatif CET ${year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      padding: 40px;
      max-width: 700px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 { color: #1e40af; font-size: 24px; }
    .header .date { color: #64748b; font-size: 13px; margin-top: 8px; }
    .summary-box {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 32px;
    }
    .summary-box .value { font-size: 48px; font-weight: 700; }
    .summary-box .label { font-size: 14px; opacity: 0.9; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #374151; }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .row:last-child { border-bottom: none; }
    .row .label { color: #6b7280; }
    .row .value { font-weight: 600; }
    .highlight { color: #059669; }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimer</button>

  <div class="header">
    <h1>Récapitulatif CET</h1>
    <div class="date">${generatedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>

  <div class="summary-box">
    <div class="value">${counters.cet} → ${cetProjection.cetFinal}</div>
    <div class="label">Jours CET (actuel → projeté)</div>
  </div>

  <div class="section">
    <div class="section-title">Apports vers CET</div>
    <div class="row">
      <span class="label">RTC (10j max)</span>
      <span class="value">${cetProjection.apportCET.rtc} jours</span>
    </div>
    <div class="row">
      <span class="label">CA classiques (5j max)</span>
      <span class="value">${cetProjection.apportCET.ca} jours</span>
    </div>
    <div class="row">
      <span class="label">CA Hors Période</span>
      <span class="value">${cetProjection.apportCET.caHP} jours</span>
    </div>
    <div class="row">
      <span class="label">Heures Sup (5j max)</span>
      <span class="value">${cetProjection.apportCET.hs} jours</span>
    </div>
    <div class="row" style="font-weight: 600; border-top: 2px solid #e5e7eb; padding-top: 12px;">
      <span class="label">Total apport annuel</span>
      <span class="value">${cetProjection.totalApport} jours</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Économies réalisées</div>
    <div class="row">
      <span class="label">Gain net RTC</span>
      <span class="value highlight">${formatMinutes(cetProjection.gainNetRTC)}</span>
    </div>
    <div class="row">
      <span class="label">Équivalent jours économisés</span>
      <span class="value highlight">${cetProjection.joursEconomises} jours</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">État final</div>
    <div class="row">
      <span class="label">CET actuel</span>
      <span class="value">${counters.cet} jours</span>
    </div>
    <div class="row">
      <span class="label">Objectif</span>
      <span class="value">${counters.objectifCET} jours</span>
    </div>
    <div class="row">
      <span class="label">CET projeté fin d'année</span>
      <span class="value highlight">${cetProjection.cetFinal} jours</span>
    </div>
    <div class="row">
      <span class="label">Marge jusqu'au plafond</span>
      <span class="value">${CET_PLAFOND - cetProjection.cetFinal} jours</span>
    </div>
  </div>

  <div class="footer">
    <p>My Chronos - Optimisation des congés policiers</p>
  </div>
</body>
</html>
`;
}

// ============================================
// UTILITAIRES
// ============================================

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    pose: 'Congé posé',
    credit: 'Crédit',
    transfer_cet: 'Transfert CET',
    correction: 'Correction',
  };
  return labels[action] || action;
}

function formatEntryAmount(entry: HistoryEntry): string {
  const sign = entry.amount < 0 ? '' : '+';
  if (['ca', 'caHP', 'cet'].includes(entry.type)) {
    return `${sign}${entry.amount}j`;
  }
  return `${sign}${formatMinutes(Math.abs(entry.amount))}`;
}

/**
 * Ouvre une nouvelle fenêtre avec le rapport PDF pour impression
 */
export function openPDFReport(
  type: 'annual' | 'cet',
  data: PDFReportData
): void {
  const html = type === 'annual'
    ? generateAnnualReportHTML(data)
    : generateCETReportHTML(data);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
