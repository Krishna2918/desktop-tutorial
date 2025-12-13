/**
 * Vector Clock utilities for distributed synchronization
 * Implements CRDT (Conflict-free Replicated Data Type) for conflict detection
 */

export type VectorClock = Record<string, number>;

export enum ClockComparison {
  BEFORE = 'BEFORE',       // clock1 happened before clock2
  AFTER = 'AFTER',         // clock1 happened after clock2
  CONCURRENT = 'CONCURRENT', // clocks are concurrent (conflict)
  EQUAL = 'EQUAL'          // clocks are identical
}

/**
 * Create a new vector clock
 */
export function createVectorClock(deviceId: string): VectorClock {
  return { [deviceId]: 1 };
}

/**
 * Increment the vector clock for a device
 */
export function incrementVectorClock(
  clock: VectorClock,
  deviceId: string
): VectorClock {
  const newClock = { ...clock };
  newClock[deviceId] = (newClock[deviceId] || 0) + 1;
  return newClock;
}

/**
 * Merge two vector clocks by taking the maximum value for each device
 */
export function mergeVectorClocks(
  clock1: VectorClock,
  clock2: VectorClock
): VectorClock {
  const merged: VectorClock = { ...clock1 };

  for (const [deviceId, timestamp] of Object.entries(clock2)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, timestamp);
  }

  return merged;
}

/**
 * Compare two vector clocks to determine their relationship
 */
export function compareVectorClocks(
  clock1: VectorClock,
  clock2: VectorClock
): ClockComparison {
  if (!clock1 || !clock2) {
    throw new Error('Both vector clocks must be provided');
  }

  // Get all device IDs from both clocks
  const allDeviceIds = new Set([
    ...Object.keys(clock1),
    ...Object.keys(clock2)
  ]);

  let clock1Greater = false;
  let clock2Greater = false;

  for (const deviceId of allDeviceIds) {
    const time1 = clock1[deviceId] || 0;
    const time2 = clock2[deviceId] || 0;

    if (time1 > time2) {
      clock1Greater = true;
    } else if (time2 > time1) {
      clock2Greater = true;
    }
  }

  // Determine relationship
  if (clock1Greater && clock2Greater) {
    return ClockComparison.CONCURRENT;
  } else if (clock1Greater) {
    return ClockComparison.AFTER;
  } else if (clock2Greater) {
    return ClockComparison.BEFORE;
  } else {
    return ClockComparison.EQUAL;
  }
}

/**
 * Check if clock1 happened before clock2
 */
export function happenedBefore(
  clock1: VectorClock,
  clock2: VectorClock
): boolean {
  return compareVectorClocks(clock1, clock2) === ClockComparison.BEFORE;
}

/**
 * Check if two clocks are concurrent (conflict)
 */
export function areConcurrent(
  clock1: VectorClock,
  clock2: VectorClock
): boolean {
  return compareVectorClocks(clock1, clock2) === ClockComparison.CONCURRENT;
}

/**
 * Get the latest timestamp for a device from a vector clock
 */
export function getDeviceTimestamp(
  clock: VectorClock,
  deviceId: string
): number {
  return clock[deviceId] || 0;
}

/**
 * Check if a clock dominates another (all timestamps >= and at least one >)
 */
export function dominates(
  clock1: VectorClock,
  clock2: VectorClock
): boolean {
  const comparison = compareVectorClocks(clock1, clock2);
  return comparison === ClockComparison.AFTER || comparison === ClockComparison.EQUAL;
}

/**
 * Create a clock from a merge of multiple clocks
 */
export function mergeMultipleClocks(clocks: VectorClock[]): VectorClock {
  if (clocks.length === 0) {
    return {};
  }

  return clocks.reduce((merged, clock) => mergeVectorClocks(merged, clock), {});
}

/**
 * Convert vector clock to a comparable string for sorting
 */
export function clockToString(clock: VectorClock): string {
  const entries = Object.entries(clock)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deviceId, timestamp]) => `${deviceId}:${timestamp}`);

  return entries.join(',');
}

/**
 * Parse a vector clock from string representation
 */
export function stringToClock(clockString: string): VectorClock {
  if (!clockString) {
    return {};
  }

  const clock: VectorClock = {};
  const entries = clockString.split(',');

  for (const entry of entries) {
    const [deviceId, timestamp] = entry.split(':');
    if (deviceId && timestamp) {
      clock[deviceId] = parseInt(timestamp, 10);
    }
  }

  return clock;
}

/**
 * Validate a vector clock structure
 */
export function isValidVectorClock(clock: any): clock is VectorClock {
  if (!clock || typeof clock !== 'object') {
    return false;
  }

  for (const [key, value] of Object.entries(clock)) {
    if (typeof key !== 'string' || typeof value !== 'number' || value < 0) {
      return false;
    }
  }

  return true;
}
