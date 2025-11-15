/**
 * Delta computation utilities for efficient synchronization
 * Supports JSON diff/patch operations
 */

export enum DeltaOperation {
  ADD = 'add',
  REMOVE = 'remove',
  REPLACE = 'replace',
  MOVE = 'move',
  COPY = 'copy'
}

export interface DeltaChange {
  op: DeltaOperation;
  path: string;
  value?: any;
  oldValue?: any;
  from?: string; // For move/copy operations
}

export interface Delta {
  changes: DeltaChange[];
  timestamp: Date;
  checksum?: string;
}

/**
 * Create a delta between two objects
 */
export function createDelta(before: any, after: any, basePath: string = ''): DeltaChange[] {
  const changes: DeltaChange[] = [];

  // Handle null/undefined cases
  if (before === after) {
    return changes;
  }

  if (before === null || before === undefined) {
    changes.push({
      op: DeltaOperation.ADD,
      path: basePath || '/',
      value: after
    });
    return changes;
  }

  if (after === null || after === undefined) {
    changes.push({
      op: DeltaOperation.REMOVE,
      path: basePath || '/',
      oldValue: before
    });
    return changes;
  }

  // Handle primitive types
  if (typeof before !== 'object' || typeof after !== 'object') {
    if (before !== after) {
      changes.push({
        op: DeltaOperation.REPLACE,
        path: basePath || '/',
        value: after,
        oldValue: before
      });
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(before) && Array.isArray(after)) {
    return createArrayDelta(before, after, basePath);
  }

  // Handle objects
  if (Array.isArray(before) !== Array.isArray(after)) {
    changes.push({
      op: DeltaOperation.REPLACE,
      path: basePath || '/',
      value: after,
      oldValue: before
    });
    return changes;
  }

  // Compare object properties
  const beforeKeys = new Set(Object.keys(before));
  const afterKeys = new Set(Object.keys(after));

  // Check for removed properties
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      const path = basePath ? `${basePath}/${key}` : `/${key}`;
      changes.push({
        op: DeltaOperation.REMOVE,
        path,
        oldValue: before[key]
      });
    }
  }

  // Check for added and modified properties
  for (const key of afterKeys) {
    const path = basePath ? `${basePath}/${key}` : `/${key}`;

    if (!beforeKeys.has(key)) {
      // Property added
      changes.push({
        op: DeltaOperation.ADD,
        path,
        value: after[key]
      });
    } else {
      // Property might be modified
      const nestedChanges = createDelta(before[key], after[key], path);
      changes.push(...nestedChanges);
    }
  }

  return changes;
}

/**
 * Create delta for arrays using LCS (Longest Common Subsequence) algorithm
 */
function createArrayDelta(before: any[], after: any[], basePath: string): DeltaChange[] {
  const changes: DeltaChange[] = [];

  // Simple array comparison - for production, consider using a proper diff algorithm
  const maxLength = Math.max(before.length, after.length);

  for (let i = 0; i < maxLength; i++) {
    const path = `${basePath}/${i}`;

    if (i >= before.length) {
      // Element added
      changes.push({
        op: DeltaOperation.ADD,
        path,
        value: after[i]
      });
    } else if (i >= after.length) {
      // Element removed
      changes.push({
        op: DeltaOperation.REMOVE,
        path,
        oldValue: before[i]
      });
    } else if (!deepEqual(before[i], after[i])) {
      // Element modified
      if (typeof before[i] === 'object' && typeof after[i] === 'object') {
        const nestedChanges = createDelta(before[i], after[i], path);
        changes.push(...nestedChanges);
      } else {
        changes.push({
          op: DeltaOperation.REPLACE,
          path,
          value: after[i],
          oldValue: before[i]
        });
      }
    }
  }

  return changes;
}

/**
 * Apply a delta to an object
 */
export function applyDelta(base: any, delta: Delta | DeltaChange[]): any {
  const changes = Array.isArray(delta) ? delta : delta.changes;
  let result = deepClone(base);

  for (const change of changes) {
    result = applyChange(result, change);
  }

  return result;
}

/**
 * Apply a single change to an object
 */
function applyChange(obj: any, change: DeltaChange): any {
  const pathParts = change.path.split('/').filter(p => p !== '');

  if (pathParts.length === 0) {
    // Root level change
    switch (change.op) {
      case DeltaOperation.ADD:
      case DeltaOperation.REPLACE:
        return change.value;
      case DeltaOperation.REMOVE:
        return undefined;
      default:
        return obj;
    }
  }

  const result = deepClone(obj) || {};
  let current = result;

  // Navigate to the parent of the target
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    const nextPart = pathParts[i + 1];

    if (!(part in current)) {
      // Create intermediate structure
      current[part] = isNaN(Number(nextPart)) ? {} : [];
    }

    current = current[part];
  }

  const lastPart = pathParts[pathParts.length - 1];

  // Apply the operation
  switch (change.op) {
    case DeltaOperation.ADD:
    case DeltaOperation.REPLACE:
      current[lastPart] = change.value;
      break;

    case DeltaOperation.REMOVE:
      if (Array.isArray(current)) {
        current.splice(Number(lastPart), 1);
      } else {
        delete current[lastPart];
      }
      break;

    case DeltaOperation.MOVE:
      if (change.from) {
        const fromParts = change.from.split('/').filter(p => p !== '');
        const value = getValueAtPath(result, fromParts);
        setValueAtPath(result, pathParts, value);
        deleteValueAtPath(result, fromParts);
      }
      break;

    case DeltaOperation.COPY:
      if (change.from) {
        const fromParts = change.from.split('/').filter(p => p !== '');
        const value = getValueAtPath(result, fromParts);
        setValueAtPath(result, pathParts, value);
      }
      break;
  }

  return result;
}

/**
 * Merge two deltas
 */
export function mergeDelta(base: any, delta1: Delta, delta2: Delta): {
  result: any;
  conflicts: Array<{ path: string; delta1Value: any; delta2Value: any }>;
} {
  const conflicts: Array<{ path: string; delta1Value: any; delta2Value: any }> = [];

  // Create a map of changes by path
  const delta1Map = new Map<string, DeltaChange>();
  const delta2Map = new Map<string, DeltaChange>();

  for (const change of delta1.changes) {
    delta1Map.set(change.path, change);
  }

  for (const change of delta2.changes) {
    delta2Map.set(change.path, change);
  }

  // Find conflicts
  const allPaths = new Set([...delta1Map.keys(), ...delta2Map.keys()]);

  for (const path of allPaths) {
    const change1 = delta1Map.get(path);
    const change2 = delta2Map.get(path);

    if (change1 && change2) {
      // Both deltas modify the same path
      if (!deepEqual(change1.value, change2.value)) {
        conflicts.push({
          path,
          delta1Value: change1.value,
          delta2Value: change2.value
        });
      }
    }
  }

  // Apply deltas (delta2 wins in case of conflict for automatic resolution)
  let result = deepClone(base);
  result = applyDelta(result, delta1);
  result = applyDelta(result, delta2);

  return { result, conflicts };
}

/**
 * Three-way merge (base, local, remote)
 */
export function threeWayMerge(
  base: any,
  local: any,
  remote: any
): {
  result: any;
  conflicts: Array<{ path: string; localValue: any; remoteValue: any }>;
} {
  const localDelta = createDelta(base, local);
  const remoteDelta = createDelta(base, remote);

  return mergeDelta(base, { changes: localDelta, timestamp: new Date() }, { changes: remoteDelta, timestamp: new Date() });
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Deep clone an object
 */
function deepClone(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const cloned: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Get value at path
 */
function getValueAtPath(obj: any, pathParts: string[]): any {
  let current = obj;

  for (const part of pathParts) {
    if (current == null) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Set value at path
 */
function setValueAtPath(obj: any, pathParts: string[], value: any): void {
  let current = obj;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = pathParts[pathParts.length - 1];
  current[lastPart] = value;
}

/**
 * Delete value at path
 */
function deleteValueAtPath(obj: any, pathParts: string[]): void {
  let current = obj;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!(part in current)) return;
    current = current[part];
  }

  const lastPart = pathParts[pathParts.length - 1];
  if (Array.isArray(current)) {
    current.splice(Number(lastPart), 1);
  } else {
    delete current[lastPart];
  }
}

/**
 * Calculate checksum for delta verification
 */
export function calculateChecksum(data: any): string {
  const crypto = require('crypto');
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Optimize delta by removing redundant changes
 */
export function optimizeDelta(delta: Delta): Delta {
  const changes = delta.changes;
  const optimized: DeltaChange[] = [];
  const processed = new Set<string>();

  // Remove redundant changes (e.g., add then remove, or multiple replaces on same path)
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];

    if (!processed.has(change.path)) {
      optimized.unshift(change);
      processed.add(change.path);
    }
  }

  return {
    ...delta,
    changes: optimized
  };
}
