'use client';

import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const WELCOME_KEY = 'chronos_welcome_shown';

export function markWelcomeSeen() {
  localStorage.setItem(WELCOME_KEY, '1');
}

export function hasSeenWelcome() {
  return localStorage.getItem(WELCOME_KEY) === '1';
}

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const handleClose = () => {
    markWelcomeSeen();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        {/* Header dark blue */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
        >
          <div className="flex items-start gap-3 mb-1">
            {/* Logo small */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="My Chronos" className="w-9 h-9 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight text-white">Bienvenue sur My Chronos 👋</DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">Application de gestion des congés policiers</p>
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
          <p className="text-sm text-slate-600 leading-relaxed">
            Conçue par un agent, pour les agents. Cette première version est vouée à évoluer — vos retours comptent énormément.
          </p>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-sm text-slate-700 leading-relaxed">
              📱 <span className="font-medium">Données locales</span> — tout reste sur votre appareil. En cas de changement de téléphone, vos données peuvent être perdues.
            </p>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Retrouvez toutes les informations utiles depuis les paramètres. ⚙️
          </p>

          <p className="text-sm text-slate-600 leading-relaxed">
            Merci d&apos;être parmi les premiers. 🙏
          </p>

          <p className="text-sm font-semibold text-slate-800">Y.</p>

          <Button
            className="w-full mt-2 text-white font-semibold rounded-xl py-3 h-auto"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
            onClick={handleClose}
          >
            C&apos;est parti !
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
