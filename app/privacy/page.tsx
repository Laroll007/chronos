import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité — My Chronos",
  description:
    "Politique de confidentialité de My Chronos : données stockées localement, statistiques d'usage anonymes sans identifiant, formulaire de retour via Resend (sous-traitant), droits RGPD complets.",
  alternates: { canonical: "https://mychronos.fr/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Bande tricolore */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(to right, #0055A4 33%, #fff 33%, #fff 66%, #EF4135 66%)",
        }}
      />

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 hover:underline mb-6 inline-block"
          >
            ← Retour à l&apos;application
          </Link>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Politique de confidentialité
          </h1>
          <p className="text-slate-500 text-sm">
            Dernière mise à jour : 24 septembre 2026
          </p>
        </div>

        <div className="space-y-8 text-slate-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              1. Responsable du traitement
            </h2>
            <p>
              <strong>Lex Digita</strong>, SIRET 999 555 584 00013, 94000
              Créteil, France. Directeur de la publication :
              Amreen Rolin. Contact RGPD :{" "}
              <a href="mailto:contact@lexdigita.fr" className="text-blue-600 underline">
                contact@lexdigita.fr
              </a>
              .
            </p>
            <p className="mt-2">
              <strong>My Chronos</strong>{" "}est une application de gestion des congés
              pour les personnels de la fonction publique soumis aux règles
              APORTT. Elle n&apos;est affiliée à aucune institution officielle.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              2. Données traitées et finalités
            </h2>
            <p>
              My Chronos minimise la collecte de données. Trois traitements
              distincts coexistent&nbsp;:
            </p>
            <div className="mt-3 space-y-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="font-semibold text-blue-900 mb-1">
                  A) Fonctionnement de l&apos;application (stockage local)
                </p>
                <p className="text-blue-900/90">
                  Cycle de travail, soldes de compteurs (CA, CA HP, RTC, CET,
                  CF, HS, RPS), historique des congés posés. Ces données sont
                  stockées <strong>exclusivement</strong> dans le stockage local
                  (<em>localStorage</em>) de votre navigateur ou de votre
                  appareil. Elles <strong>ne sont pas transmises</strong> à nos
                  serveurs. <em>Base légale : intérêt légitime (art. 6.1.f
                  RGPD) — fournir le service demandé.</em>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-900 mb-1">
                  B) Formulaire de retour (optionnel)
                </p>
                <p className="text-amber-900/90">
                  Si vous utilisez le formulaire « Donner mon avis », les
                  données suivantes sont transmises à notre sous-traitant
                  Resend : <strong>type de retour, message libre, et
                  éventuellement votre adresse email</strong> si vous choisissez
                  d&apos;en fournir une. Le message nous est ensuite envoyé par
                  email à <code>contact@lexdigita.fr</code>.{" "}
                  <em>
                    Base légale : consentement (art. 6.1.a RGPD) — case à cocher
                    obligatoire avant envoi.
                  </em>
                </p>
              </div>
              <div
                id="statistiques"
                className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 scroll-mt-4"
              >
                <p className="font-semibold text-emerald-900 mb-1">
                  C) Statistiques d&apos;utilisation anonymes (désactivables)
                </p>
                <p className="text-emerald-900/90">
                  Pour savoir combien de personnes utilisent l&apos;application
                  et quelles fonctionnalités servent, l&apos;application envoie
                  à notre serveur (OVHcloud, France) des{" "}
                  <strong>compteurs agrégés par jour</strong>&nbsp;: nombre
                  d&apos;ouvertures, fonctionnalités utilisées (ex.
                  «&nbsp;congés posés&nbsp;», «&nbsp;vue année&nbsp;»), erreurs
                  techniques (type d&apos;erreur, sans contenu), plateforme
                  (iOS, Android, web), version de l&apos;application et type de
                  cycle (ex. «&nbsp;2/2&nbsp;», «&nbsp;hebdomadaire&nbsp;»).
                </p>
                <p className="text-emerald-900/90 mt-2">
                  <strong>Aucun identifiant</strong> n&apos;est créé ni transmis
                  (ni cookie, ni identifiant d&apos;appareil, ni empreinte),
                  l&apos;adresse IP n&apos;est pas enregistrée, et{" "}
                  <strong>aucune donnée de planning</strong> (dates, soldes,
                  congés) ne quitte votre appareil. Les envois ne peuvent pas
                  être reliés entre eux ni à une personne. Vous pouvez les
                  désactiver à tout moment dans{" "}
                  <strong>Paramètres → Confidentialité</strong>&nbsp;; les
                  compteurs non encore envoyés sont alors effacés.{" "}
                  <em>
                    Base légale : intérêt légitime (art. 6.1.f RGPD) —
                    mesure d&apos;audience strictement anonyme, exemptée de
                    consentement (art. 82 loi Informatique et Libertés,
                    lignes directrices CNIL n°2020-091).
                  </em>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              3. Sous-traitants et transferts hors UE
            </h2>
            <ul className="list-disc ml-5 space-y-2">
              <li>
                <strong>OVHcloud</strong> (hébergeur,{" "}
                <a
                  href="https://www.ovhcloud.com"
                  className="text-blue-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ovhcloud.com
                </a>
                ) — serveurs situés en France. Aucun transfert hors UE.
              </li>
              <li>
                <strong>Resend, Inc.</strong> (envoi de l&apos;email de
                feedback,{" "}
                <a
                  href="https://resend.com"
                  className="text-blue-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  resend.com
                </a>
                ) — société États-Unis. Transfert de données hors UE encadré
                par les <strong>clauses contractuelles types</strong> de la
                Commission européenne (art. 46 RGPD). Uniquement concerné si
                vous utilisez le formulaire de retour.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              4. Durée de conservation
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <strong>Données locales</strong> : conservées tant que vous ne
                les supprimez pas (aucune durée imposée). Un export/import
                manuel est disponible dans les Paramètres.
              </li>
              <li>
                <strong>Messages de retour</strong> : conservés{" "}
                <strong>12 mois maximum</strong> dans la boîte mail{" "}
                <code>contact@lexdigita.fr</code>, puis supprimés.
              </li>
              <li>
                <strong>Statistiques anonymes</strong> : conservées{" "}
                <strong>25 mois maximum</strong>, puis supprimées
                automatiquement.
              </li>
              <li>
                <strong>Logs serveur</strong> : conservés 30 jours (hash SHA-256
                de l&apos;IP uniquement, à des fins anti-abus), puis purgés.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              5. Vos droits RGPD (art. 15 à 22)
            </h2>
            <p>
              Conformément au Règlement (UE) 2016/679, vous disposez des droits
              suivants sur les données vous concernant :
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>
                <strong>Accès</strong> (art. 15) — obtenir copie de vos données
              </li>
              <li>
                <strong>Rectification</strong> (art. 16) — corriger une donnée
                inexacte
              </li>
              <li>
                <strong>Effacement</strong> (art. 17) — suppression immédiate
                possible via Paramètres → Réinitialiser (données locales) ou par
                email (messages feedback)
              </li>
              <li>
                <strong>Limitation</strong> (art. 18)
              </li>
              <li>
                <strong>Portabilité</strong> (art. 20) — export JSON disponible
                dans Paramètres
              </li>
              <li>
                <strong>Opposition</strong> (art. 21) — retrait du consentement
                à tout moment
              </li>
              <li>
                Introduire une <strong>réclamation auprès de la CNIL</strong>{" "}
                :{" "}
                <a
                  href="https://www.cnil.fr/fr/plaintes"
                  className="text-blue-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  cnil.fr/plaintes
                </a>
              </li>
            </ul>
            <p className="mt-2">
              Pour exercer ces droits&nbsp;:{" "}
              <a href="mailto:contact@lexdigita.fr" className="text-blue-600 underline">
                contact@lexdigita.fr
              </a>
              . Réponse sous 30 jours maximum.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              6. Cookies et traceurs
            </h2>
            <p>
              My Chronos n&apos;utilise <strong>aucun cookie de suivi</strong>,
              aucun outil d&apos;analyse tiers (Google Analytics ou autre),
              aucun pixel publicitaire. Seul le <em>stockage local</em> du
              navigateur est utilisé : pour le fonctionnement du service, et
              pour préparer les statistiques anonymes décrites au 2.C, qui ne
              contiennent aucun identifiant. Ces deux usages sont exemptés du
              bandeau de consentement (délibération CNIL n°2020-091) ; les
              statistiques restent désactivables dans les Paramètres.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              7. Sécurité
            </h2>
            <p>
              Toutes les communications sont chiffrées via HTTPS (TLS 1.2+). Les
              mots de passe et jetons ne sont pas applicables (pas de compte
              utilisateur). Les données locales ne sont pas chiffrées au repos :
              nous recommandons d&apos;activer le verrouillage de votre
              appareil.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              8. Mineurs
            </h2>
            <p>
              My Chronos est destinée aux personnels de la fonction publique en
              activité et ne cible pas les personnes de moins de 18 ans.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              9. Modifications
            </h2>
            <p>
              Cette politique peut être mise à jour. La date de dernière
              modification est indiquée en haut de cette page. Les modifications
              substantielles seront annoncées par une notification in-app.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
          © 2026 My Chronos — édité par Lex Digita
        </div>
      </div>
    </div>
  );
}
