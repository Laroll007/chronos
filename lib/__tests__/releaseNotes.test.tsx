import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { compareVersions, pendingReleaseNotes, RELEASE_NOTES } from '../releaseNotes';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { WhatsNewModal } from '@/components/dashboard/WhatsNewModal';

describe('Nouveautés : quelles notes afficher', () => {
  it('compare les versions', () => {
    expect(compareVersions('1.12.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.12.0', '1.12.0')).toBe(0);
    expect(compareVersions('1.11.0', '1.12.0')).toBe(-1);
  });

  it('utilisateur existant qui n’a jamais vu de note : la 1.12 s’affiche', () => {
    expect(pendingReleaseNotes(null, '1.12.0').map((n) => n.version)).toEqual(['1.12.0']);
  });

  it('version 1.13 : la note 1.13 seule si la 1.12 a été vue, les deux sinon', () => {
    expect(pendingReleaseNotes('1.12.0', '1.13.0').map((n) => n.version)).toEqual(['1.13.0']);
    expect(pendingReleaseNotes(null, '1.13.0').map((n) => n.version)).toEqual(['1.13.0', '1.12.0']);
  });

  it('déjà vue : rien', () => {
    expect(pendingReleaseNotes('1.12.0', '1.12.0')).toEqual([]);
  });

  it('une note n’apparaît pas avant d’avoir la version correspondante', () => {
    expect(pendingReleaseNotes('1.11.0', '1.11.0')).toEqual([]);
  });

  it('la 1.12 annonce les événements et les RPS', () => {
    const titles = RELEASE_NOTES.find((n) => n.version === '1.12.0')!.items.map((i) => i.title).join(' ');
    expect(titles).toMatch(/RPS/);
    expect(titles).toMatch(/événements/);
  });
});

describe('Fenêtre « Quoi de neuf ? »', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  });

  it('s’affiche une fois, puis plus jamais après « Compris »', () => {
    const { unmount } = render(<WhatsNewModal onAction={vi.fn()} />);
    expect(screen.getByText('Quoi de neuf ?')).toBeTruthy();
    fireEvent.click(screen.getByText('Compris'));
    expect(screen.queryByText('Quoi de neuf ?')).toBeNull();
    unmount();

    render(<WhatsNewModal onAction={vi.fn()} />);
    expect(screen.queryByText('Quoi de neuf ?')).toBeNull();
  });

  it('« Renseigner mes horaires » ouvre la modification du cycle', () => {
    const onAction = vi.fn();
    render(<WhatsNewModal onAction={onAction} />);
    fireEvent.click(screen.getByText(/Renseigner mes horaires/));
    expect(onAction).toHaveBeenCalledWith('cycle');
    expect(store.get('chronos_release_seen')).toBeTruthy();
  });
});
