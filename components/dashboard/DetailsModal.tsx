'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CountersOverview } from './CountersOverview';
import { Counters } from '@/lib/types';

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  counters: Counters;
}

export function DetailsModal({ isOpen, onClose, counters }: DetailsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto glass border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl">Tous les compteurs</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <CountersOverview counters={counters} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
