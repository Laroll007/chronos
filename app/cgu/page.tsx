import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CGU & Mentions légales — My Chronos",
  description: "Conditions Générales d'Utilisation et mentions légales de l'application My Chronos",
};

export default function CguPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Bande tricolore */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #0055A4 33%, #fff 33%, #fff 66%, #EF4135 66%)" }} />

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
            ← Retour à l&apos;application
          </Link>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Conditions Générales d&apos;Utilisation</h1>
          <p className="text-slate-500 text-sm">Dernière mise à jour : 24 avril 2026</p>
        </div>

        <div className="space-y-10 text-slate-700 text-sm leading-relaxed">

          {/* Article 1 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 1 — Présentation et objet</h2>
            <p>
              L&apos;application <strong>My Chronos</strong> (ci-après &quot;l&apos;Application&quot;) est un outil de gestion
              et d&apos;optimisation des congés destiné aux personnels de la fonction publique.
              Elle est accessible à l&apos;adresse <strong>https://mychronos.fr</strong> et disponible
              en téléchargement sur l&apos;App Store (iOS) et Google Play Store (Android).
            </p>
            <p className="mt-2">
              Les présentes Conditions Générales d&apos;Utilisation (ci-après &quot;CGU&quot;) ont pour objet
              de définir les modalités et conditions dans lesquelles l&apos;utilisateur accède
              et utilise l&apos;Application. Toute utilisation de l&apos;Application implique l&apos;acceptation
              pleine et entière des présentes CGU.
            </p>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 2 — Accès et inscription</h2>
            <p>
              L&apos;Application est accessible gratuitement à toute personne disposant d&apos;un accès
              à Internet. Aucun compte utilisateur n&apos;est requis. Aucune inscription ni
              communication de données personnelles n&apos;est nécessaire pour utiliser l&apos;Application.
            </p>
            <p className="mt-2">
              L&apos;éditeur se réserve le droit de modifier, suspendre ou interrompre l&apos;accès
              à l&apos;Application à tout moment, sans préavis ni indemnité.
            </p>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 3 — Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble des éléments constituant l&apos;Application — notamment le code source,
              la conception graphique, les textes, les algorithmes de calcul, les logos, les icônes,
              et la dénomination &quot;<strong>My Chronos</strong>&quot; —
              sont la propriété exclusive de leur auteur et sont protégés par les lois françaises
              et internationales relatives à la propriété intellectuelle.
            </p>
            <p className="mt-2">
              Le logo de l&apos;Application est une création originale protégée au titre du droit
              d&apos;auteur. Toute reproduction, représentation, modification, publication ou adaptation,
              totale ou partielle, de ces éléments, par quelque procédé que ce soit, est strictement
              interdite sans l&apos;autorisation écrite préalable de l&apos;éditeur, sous peine de poursuites
              judiciaires.
            </p>
            <p className="mt-2">
              La dénomination &quot;My Chronos&quot; constitue un élément d&apos;identification
              de l&apos;Application. Toute utilisation non autorisée de ces dénominations, notamment à
              des fins commerciales ou pour créer une confusion dans l&apos;esprit du public, est
              interdite et susceptible d&apos;engager la responsabilité de son auteur.
            </p>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 4 — Interdiction de scraping et d&apos;exploitation automatisée</h2>
            <p>
              Il est strictement interdit d&apos;utiliser tout système automatisé — notamment les robots,
              crawlers, agents d&apos;intelligence artificielle, scrapers ou tout autre outil d&apos;extraction
              de données — pour accéder à l&apos;Application, en extraire le contenu, les données,
              le code ou tout autre élément, sans autorisation écrite préalable de l&apos;éditeur.
            </p>
            <p className="mt-2">
              Cette interdiction s&apos;applique expressément à toute entité développant, entraînant
              ou exploitant des systèmes d&apos;intelligence artificielle ou d&apos;apprentissage automatique.
              L&apos;Application, son contenu et son code ne peuvent en aucun cas être utilisés comme
              données d&apos;entraînement pour un modèle d&apos;IA, quel qu&apos;il soit.
            </p>
            <p className="mt-2">
              Tout contournement des mesures techniques de protection, tout accès massif ou
              automatisé aux serveurs de l&apos;Application est susceptible de constituer une
              infraction pénale au titre de l&apos;article 323-1 du Code pénal (accès frauduleux
              à un système de traitement automatisé de données).
            </p>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 5 — Responsabilité</h2>
            <p>
              L&apos;Application est fournie &quot;en l&apos;état&quot;, à titre informatif et de facilitation,
              sans aucune garantie d&apos;exactitude, d&apos;exhaustivité ou d&apos;adéquation à un usage
              particulier. Les calculs, recommandations et projections produits par l&apos;Application
              sont basés sur les données saisies par l&apos;utilisateur et sur des règles métier
              interprétées de bonne foi, mais ne constituent en aucun cas un avis juridique,
              administratif ou professionnel officiel.
            </p>
            <p className="mt-2">
              <strong>L&apos;utilisateur est seul responsable de l&apos;usage qu&apos;il fait de l&apos;Application</strong>,
              des données qu&apos;il y saisit et des décisions qu&apos;il prend sur la base des informations
              fournies. L&apos;éditeur décline toute responsabilité en cas d&apos;erreur de calcul,
              d&apos;interprétation des règles APORTT ou de toute autre réglementation, de perte de
              données, ou de préjudice de quelque nature que ce soit résultant de l&apos;utilisation
              de l&apos;Application.
            </p>
            <p className="mt-2">
              En particulier, l&apos;éditeur ne saurait être tenu responsable de tout litige entre
              l&apos;utilisateur et son employeur ou administration concernant la pose de congés.
              L&apos;utilisateur doit toujours vérifier ses droits auprès des services compétents
              de son administration.
            </p>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 6 — Absence de lien officiel</h2>
            <p>
              <strong>My Chronos est une application indépendante, développée à titre personnel.</strong>{" "}
              Elle n&apos;entretient aucun lien officiel, contractuel ou institutionnel avec le
              Ministère de l&apos;Intérieur, la Direction Générale de la Police Nationale (DGPN),
              ni aucune autre administration, syndicat ou organisation publique ou privée.
            </p>
            <p className="mt-2">
              Les règles APORTT et autres réglementations mentionnées dans l&apos;Application sont
              citées à titre indicatif. L&apos;éditeur ne bénéficie d&apos;aucune accréditation officielle
              pour leur interprétation. En cas de doute, l&apos;utilisateur est invité à se rapprocher
              de son service RH ou de son organisation syndicale.
            </p>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 7 — Données personnelles</h2>
            <p>
              Le traitement des données personnelles est décrit dans la{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Politique de confidentialité
              </Link>
              . L&apos;Application minimise la collecte : les données métier
              (compteurs, historique) sont stockées localement sur l&apos;appareil.
              Seul le formulaire de retour, optionnel, transmet un message et, le
              cas échéant, un email à notre sous-traitant Resend, avec
              consentement explicite préalable.
            </p>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 8 — Modifications des CGU</h2>
            <p>
              L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment.
              La date de dernière mise à jour est indiquée en haut de cette page.
              L&apos;utilisation continue de l&apos;Application après modification vaut acceptation
              des nouvelles CGU.
            </p>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Article 9 — Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige,
              les tribunaux français seront seuls compétents.
            </p>
          </section>

          {/* Séparateur */}
          <div className="border-t border-slate-200 pt-10">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Mentions légales</h2>

            <div className="space-y-6">

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Éditeur</h3>
                <p className="text-slate-600">
                  <strong>Lex Digita</strong><br />
                  SIRET : 999 555 584 00013<br />
                  2 allée des Marronniers — 94000 Créteil, France<br />
                  Contact : <a href="mailto:contact@lexdigita.fr" className="text-blue-600 hover:underline">contact@lexdigita.fr</a>
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Directeur de la publication</h3>
                <p className="text-slate-600">
                  Amreen Rolin
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Délégué à la protection des données (DPO)</h3>
                <p className="text-slate-600">
                  Contact RGPD : <a href="mailto:contact@lexdigita.fr" className="text-blue-600 hover:underline">contact@lexdigita.fr</a>
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Hébergement</h3>
                <p className="text-slate-600">
                  OVH SAS<br />
                  2 rue Kellermann — 59100 Roubaix, France<br />
                  Tél. : +33 9 72 10 10 07<br />
                  <a href="https://www.ovhcloud.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">www.ovhcloud.com</a>
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Propriété intellectuelle</h3>
                <p className="text-slate-600">
                  L&apos;ensemble du contenu de ce site est protégé par le droit d&apos;auteur.
                  Toute reproduction est interdite sans autorisation préalable.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Cookies</h3>
                <p className="text-slate-600">
                  Ce site n&apos;utilise aucun cookie de suivi ou publicitaire.
                  Seul le stockage local (localStorage) du navigateur est utilisé pour
                  le fonctionnement de l&apos;application.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-700 mb-1">Crédits</h3>
                <p className="text-slate-600">
                  Application développée avec Next.js, React et Tailwind CSS.<br />
                  Icônes : Lucide React.
                </p>
              </section>

            </div>
          </div>

        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          © 2026 My Chronos — Application non officielle, usage personnel
        </div>
      </div>
    </div>
  );
}
