const tails = new Map<string, Promise<unknown>>();

/**
 * Runs creates for one lot one after another inside this process.
 * MongoDB transactions are not used anywhere in this backend, and the local
 * database is a single server, so this is the same kind of guard as a
 * reservation: check after the write and undo it when it lost the race.
 * Two backend processes can still interleave; the unique spot index and the
 * capacity check after insert then keep the lot from staying over its limit.
 */
export function withLotLock<T>(
  lotId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(lotId) ?? Promise.resolve();
  const current = previous.then(task, task);
  tails.set(lotId, current);
  // The caller awaits `current`. This extra handler only clears the queue,
  // so its rejection must not surface as an unhandled promise.
  void current.then(
    () => {
      if (tails.get(lotId) === current) tails.delete(lotId);
    },
    () => {
      if (tails.get(lotId) === current) tails.delete(lotId);
    },
  );
  return current;
}
