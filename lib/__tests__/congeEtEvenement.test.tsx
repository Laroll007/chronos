import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LeaveList } from '@/components/dashboard/LeaveList';
import type { HistoryEntry, PersonalEvent } from '../types';

// Retour terrain : congé posé + RDV le soir → impossible d'ajouter ou de
// modifier le RDV, car toucher un jour posé n'ouvre que le détail du congé.
describe('Détail d’un congé : événements du jour', () => {
  const jour = new Date(2026, 9, 14);
  const conge: HistoryEntry = {
    id: 'c1', date: jour.toISOString(), action: 'pose', type: 'ca', amount: 1, countersSnapshot: {},
  } as HistoryEntry;
  const rdv: PersonalEvent = { id: 'e1', date: '2026-10-14', title: 'Dentiste', category: 'rdv', time: '18:30' };

  function ouvrir() {
    const onAddEvent = vi.fn();
    const onOpenEvent = vi.fn();
    render(
      <LeaveList history={[conge]} onDelete={vi.fn()} focusDate={jour} onFocusHandled={vi.fn()}
        events={[rdv]} onAddEvent={onAddEvent} onOpenEvent={onOpenEvent} />
    );
    return { onAddEvent, onOpenEvent };
  }

  it('le RDV du jour est listé et s’ouvre pour modification', () => {
    const { onOpenEvent } = ouvrir();
    fireEvent.click(screen.getByText('Dentiste'));
    expect(onOpenEvent).toHaveBeenCalledWith(rdv);
  });

  it('« Ajouter un événement » propose la date du congé', () => {
    const { onAddEvent } = ouvrir();
    fireEvent.click(screen.getByText(/Ajouter un événement/));
    expect(onAddEvent).toHaveBeenCalledWith(jour);
  });
});
