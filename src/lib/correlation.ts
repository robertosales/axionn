import { v4 as uuidv4 } from 'uuid';

let currentCorrelationId: string | null = null;
let currentRootCorrelationId: string | null = null;
let correlationListeners: Set<(correlationId: string | null) => void> = new Set();

export function generateCorrelationId(): string {
  return uuidv4();
}

export function getCorrelationId(): string {
  if (!currentCorrelationId) {
    currentCorrelationId = generateCorrelationId();
    currentRootCorrelationId = currentCorrelationId;
    notifyListeners();
  }
  return currentCorrelationId;
}

export function getRootCorrelationId(): string {
  if (!currentRootCorrelationId) {
    getCorrelationId();
  }
  return currentRootCorrelationId!;
}

export function setCorrelationId(correlationId: string, isRoot = false): void {
  currentCorrelationId = correlationId;
  if (isRoot || !currentRootCorrelationId) {
    currentRootCorrelationId = correlationId;
  }
  notifyListeners();
}

export function clearCorrelationId(): void {
  currentCorrelationId = null;
  currentRootCorrelationId = null;
  notifyListeners();
}

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  const previousId = currentCorrelationId;
  const previousRootId = currentRootCorrelationId;
  try {
    currentCorrelationId = correlationId;
    if (!currentRootCorrelationId) {
      currentRootCorrelationId = correlationId;
    }
    notifyListeners();
    return fn();
  } finally {
    currentCorrelationId = previousId;
    currentRootCorrelationId = previousRootId;
    notifyListeners();
  }
}

export function createChildCorrelationId(): string {
  const childId = generateCorrelationId();
  const parentId = getCorrelationId();
  return childId;
}

function notifyListeners(): void {
  correlationListeners.forEach(listener => listener(currentCorrelationId));
}

export function subscribeToCorrelationChanges(listener: (correlationId: string | null) => void): () => void {
  correlationListeners.add(listener);
  return () => correlationListeners.delete(listener);
}

export function addCorrelationHeader(headers: Record<string, string>): Record<string, string> {
  const correlationId = getCorrelationId();
  const rootCorrelationId = getRootCorrelationId();
  return {
    ...headers,
    'x-correlation-id': correlationId,
    'x-root-correlation-id': rootCorrelationId,
  };
}

export function extractCorrelationId(headers: Headers | Record<string, string>): string | null {
  const headerObj = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : headers;

  return (
    headerObj['x-correlation-id'] ??
    headerObj['x-request-id'] ??
    headerObj['correlation-id'] ??
    null
  );
}

export function createCorrelationContext(
  sourceSystem: string,
  sourceComponent?: string,
  metadata?: Record<string, unknown>
): { correlationId: string; rootCorrelationId: string; context: Record<string, unknown> } {
  const correlationId = generateCorrelationId();
  const rootCorrelationId = correlationId;

  return {
    correlationId,
    rootCorrelationId,
    context: {
      sourceSystem,
      sourceComponent,
      correlationId,
      rootCorrelationId,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}