'use client';

import { ReactNode, useEffect } from 'react';
import { isChunkLoadError, reloadForNewVersion } from '@/lib/chunkReload';
import { ErrorBoundary } from './ErrorBoundary';

interface ClientErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Wrapper client pour ErrorBoundary
 * Utilisé dans le layout pour capturer les erreurs React
 */
export function ClientErrorBoundary({ children }: ClientErrorBoundaryProps) {
  // Imports dynamiques ratés hors rendu React (ex. module chargé au clic) :
  // même traitement que dans l'ErrorBoundary.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) reloadForNewVersion();
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
