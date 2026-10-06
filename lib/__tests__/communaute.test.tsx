import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { CommunauteBanner } from '@/components/dashboard/CommunauteBanner';
import { LIEN_COMMUNAUTE } from '../communaute';
import { RELEASE_NOTES } from '../releaseNotes';

describe('Communauté Discord', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  });

  it('lien permanent, et « Quoi de neuf » 1.15 l’annonce en premier avec la mise en garde', () => {
    expect(LIEN_COMMUNAUTE).toBe('https://discord.gg/bhDaJRqEHx');
    const n = RELEASE_NOTES.find((r) => r.version === '1.15.0')!;
    expect(n.items[0].action?.target).toBe('communaute');
    expect(n.items[0].note).toMatch(/matricule/);
  });

  it('l’encart ouvre Discord, et la croix le masque définitivement', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { unmount } = render(<CommunauteBanner />);
    fireEvent.click(screen.getByText('Rejoindre le Discord'));
    expect(open).toHaveBeenCalledWith(LIEN_COMMUNAUTE, '_blank', 'noopener,noreferrer');
    fireEvent.click(screen.getByLabelText('Ne plus afficher'));
    expect(screen.queryByText('Rejoindre le Discord')).toBeNull();
    unmount();
    render(<CommunauteBanner />);
    expect(screen.queryByText('Rejoindre le Discord')).toBeNull();
  });
});
