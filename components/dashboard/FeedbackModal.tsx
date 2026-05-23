'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Bug, Lightbulb, HelpCircle, X } from 'lucide-react';

type FeedbackType = 'bug' | 'amelioration' | 'question';

const TYPES: { id: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { id: 'bug', label: 'Bug', icon: <Bug className="w-4 h-4" /> },
  { id: 'amelioration', label: 'Amélioration', icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" /> },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    if (status !== 'sending') {
      setType('bug');
      setMessage('');
      setEmail('');
      setWebsite('');
      setConsent(false);
      setStatus('idle');
      setErrorMsg(null);
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || !consent || status === 'sending') return;
    setStatus('sending');
    setErrorMsg(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, email, consent, website }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setStatus('success');
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(data.error ?? 'Erreur serveur');
        setStatus('error');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.name === 'AbortError'
          ? 'Délai dépassé, vérifiez votre connexion'
          : 'Erreur réseau',
      );
      setStatus('error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold leading-tight text-white">Donner mon avis</DialogTitle>
              <p className="text-blue-200 text-xs mt-1">Votre retour compte pour améliorer My Chronos.</p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          {/* Bande tricolore */}
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        {/* Body */}
        <div className="px-6 py-5 bg-white space-y-4">

          {status === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-base font-semibold text-slate-800">Merci pour votre retour</p>
              <p className="text-sm text-slate-500">Votre message a bien été envoyé.</p>
              <Button
                className="mt-2 text-white font-semibold rounded-xl px-8"
                style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
                onClick={handleClose}
              >
                Fermer
              </Button>
            </div>
          ) : (
            <>
              {/* Sélecteur de type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      onClick={() => setType(id)}
                      className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                        type === id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zone de texte */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                  placeholder="Décrivez votre retour..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                />
                <p className="text-right text-xs text-slate-400 mt-1">{message.length}/1000</p>
              </div>

              {/* Email optionnel */}
              <div>
                <label htmlFor="feedback-email" className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Email <span className="normal-case font-normal">(optionnel, pour réponse)</span></label>
                <input
                  id="feedback-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@exemple.fr"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              {/* Honeypot (champ caché, les bots remplissent, pas les humains) */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="feedback-website">Site web (laissez vide)</label>
                <input
                  id="feedback-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {/* Consentement RGPD */}
              <div>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                    required
                  />
                  <span>
                    J&apos;accepte que mon message et, le cas échéant, mon email soient
                    transmis via <strong>Resend</strong> (sous-traitant, données
                    hébergées UE) à l&apos;éditeur, pour le traitement de ma demande.
                    Données conservées 12 mois maximum.{' '}
                    <Link href="/privacy" className="text-blue-600 underline hover:text-blue-700" target="_blank">
                      En savoir plus
                    </Link>
                  </span>
                </label>
              </div>

              {status === 'error' && (
                <p role="alert" className="text-xs text-rose-600 text-center">
                  {errorMsg ?? 'Erreur lors de l’envoi. Réessayez.'}
                </p>
              )}

              {/* Boutons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-slate-200 text-slate-600"
                  onClick={handleClose}
                  disabled={status === 'sending'}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1 text-white font-semibold rounded-xl disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
                  onClick={handleSubmit}
                  disabled={!message.trim() || !consent || status === 'sending'}
                >
                  {status === 'sending' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Envoyer'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
