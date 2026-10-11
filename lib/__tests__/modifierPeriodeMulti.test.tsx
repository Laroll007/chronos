// Une période posée sur plusieurs compteurs (ex. CA + CET) se modifie comme une
// période sur un seul : « Modifier » reprend toutes ses poses.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { HistoryEntry } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));

import { LeaveList } from '@/components/dashboard/LeaveList';

afterEach(cleanup);

const pose = (id: string, type: HistoryEntry['type'], date: string, dateEnd: string, groupId?: string): HistoryEntry =>
  ({ id, action: 'pose', type, amount: 1, date, dateEnd, groupId, description: '' }) as HistoryEntry;

describe('Modifier une période', () => {
  it('CA + CET : le bouton « Modifier » reprend les deux poses', () => {
    const onEdit = vi.fn();
    const history = [
      pose('a', 'ca', '2026-11-02T00:00:00', '2026-11-04T00:00:00', 'g1'),
      pose('b', 'cet', '2026-11-05T00:00:00', '2026-11-06T00:00:00', 'g1'),
    ];
    render(<LeaveList history={history} onDelete={vi.fn()} onEdit={onEdit} />);
    fireEvent.click(screen.getByText(/du 2 au/));
    fireEvent.click(screen.getByRole('button', { name: /Modifier/ }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit.mock.calls[0]![0].map((e: HistoryEntry) => e.id)).toEqual(['a', 'b']);
  });

  it('une seule pose : inchangé', () => {
    const onEdit = vi.fn();
    render(<LeaveList history={[pose('a', 'ca', '2026-11-02T00:00:00', '2026-11-04T00:00:00')]} onDelete={vi.fn()} onEdit={onEdit} />);
    fireEvent.click(screen.getByText(/du 2 au/));
    fireEvent.click(screen.getByRole('button', { name: /Modifier/ }));
    expect(onEdit.mock.calls[0]![0]).toHaveLength(1);
  });
});
