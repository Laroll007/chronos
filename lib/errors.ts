// Gestion centralisée des erreurs pour Chronos

// ============================================
// TYPES D'ERREURS
// ============================================

export type ErrorCode =
  | 'STORAGE_READ_ERROR'
  | 'STORAGE_WRITE_ERROR'
  | 'VALIDATION_ERROR'
  | 'IMPORT_ERROR'
  | 'EXPORT_ERROR'
  | 'CALCULATION_ERROR'
  | 'UNKNOWN_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================
// CLASSE D'ERREUR PERSONNALISÉE
// ============================================

export class ChronosError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = 'UNKNOWN_ERROR',
    severity: ErrorSeverity = 'medium',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ChronosError';
    this.code = code;
    this.severity = severity;
    this.timestamp = new Date();
    this.context = context;

    // Maintient la stack trace correcte
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChronosError);
    }
  }

  /**
   * Crée une erreur de stockage
   */
  static storageError(message: string, operation: 'read' | 'write', context?: Record<string, unknown>): ChronosError {
    return new ChronosError(
      message,
      operation === 'read' ? 'STORAGE_READ_ERROR' : 'STORAGE_WRITE_ERROR',
      'high',
      context
    );
  }

  /**
   * Crée une erreur de validation
   */
  static validationError(message: string, context?: Record<string, unknown>): ChronosError {
    return new ChronosError(message, 'VALIDATION_ERROR', 'medium', context);
  }

  /**
   * Crée une erreur d'import
   */
  static importError(message: string, context?: Record<string, unknown>): ChronosError {
    return new ChronosError(message, 'IMPORT_ERROR', 'medium', context);
  }

  /**
   * Crée une erreur d'export
   */
  static exportError(message: string, context?: Record<string, unknown>): ChronosError {
    return new ChronosError(message, 'EXPORT_ERROR', 'low', context);
  }

  /**
   * Sérialise l'erreur pour le logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

// ============================================
// LOGGER CENTRALISÉ
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: ChronosError | Error;
}

// Buffer pour stocker les logs (limité à 100 entrées)
const LOG_BUFFER: LogEntry[] = [];
const MAX_LOG_ENTRIES = 100;

/**
 * Logger centralisé pour Chronos
 */
export const logger = {
  /**
   * Log de debug (uniquement en développement)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      addLogEntry('debug', message, context);
      console.debug(`[Chronos] ${message}`, context || '');
    }
  },

  /**
   * Log d'information
   */
  info(message: string, context?: Record<string, unknown>): void {
    addLogEntry('info', message, context);
    if (process.env.NODE_ENV === 'development') {
      console.info(`[Chronos] ${message}`, context || '');
    }
  },

  /**
   * Log d'avertissement
   */
  warn(message: string, context?: Record<string, unknown>): void {
    addLogEntry('warn', message, context);
    console.warn(`[Chronos] ${message}`, context || '');
  },

  /**
   * Log d'erreur
   */
  error(message: string, error?: Error | ChronosError, context?: Record<string, unknown>): void {
    addLogEntry('error', message, context, error);

    // En développement, afficher l'erreur complète
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Chronos] ${message}`, {
        ...context,
        error: error instanceof ChronosError ? error.toJSON() : error,
      });
    } else {
      // En production, log minimal
      console.error(`[Chronos] ${message}`);
    }
  },

  /**
   * Récupère les derniers logs
   */
  getLogs(): LogEntry[] {
    return [...LOG_BUFFER];
  },

  /**
   * Efface les logs
   */
  clearLogs(): void {
    LOG_BUFFER.length = 0;
  },
};

/**
 * Ajoute une entrée au buffer de logs
 */
function addLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error | ChronosError
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error,
  };

  LOG_BUFFER.push(entry);

  // Limiter la taille du buffer
  if (LOG_BUFFER.length > MAX_LOG_ENTRIES) {
    LOG_BUFFER.shift();
  }

  return entry;
}

// ============================================
// HELPER POUR GÉRER LES ERREURS
// ============================================

/**
 * Wrapper pour gérer les erreurs de manière uniforme
 */
export function handleError(error: unknown, context?: string): ChronosError {
  if (error instanceof ChronosError) {
    logger.error(error.message, error, { context });
    return error;
  }

  if (error instanceof Error) {
    const chronosError = new ChronosError(
      error.message,
      'UNKNOWN_ERROR',
      'medium',
      { originalError: error.name, context }
    );
    logger.error(error.message, chronosError);
    return chronosError;
  }

  const chronosError = new ChronosError(
    String(error),
    'UNKNOWN_ERROR',
    'low',
    { context }
  );
  logger.error(String(error), chronosError);
  return chronosError;
}

/**
 * Wrapper try-catch pour les opérations async
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  context?: Record<string, unknown>
): Promise<{ success: true; data: T } | { success: false; error: ChronosError }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const chronosError = handleError(error, errorMessage);
    return { success: false, error: chronosError };
  }
}

/**
 * Wrapper try-catch pour les opérations sync
 */
export function tryCatchSync<T>(
  fn: () => T,
  errorMessage: string,
  context?: Record<string, unknown>
): { success: true; data: T } | { success: false; error: ChronosError } {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    const chronosError = handleError(error, errorMessage);
    return { success: false, error: chronosError };
  }
}
