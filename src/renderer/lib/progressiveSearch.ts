/** Keep rendering/focus responsive while a completed provider response is processed. */
export async function processSearchChunks<T>(
  values: T[], onChunk: (chunk: T[]) => void, isCurrent: () => boolean, size = 300
): Promise<void> {
  for (let index = 0; index < values.length && isCurrent(); index += size) {
    onChunk(values.slice(index, index + size));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Bounded category requests can publish each completed category independently. */
export async function searchCategories<T>(
  tasks: T[], run: (task: T) => Promise<void>, isCurrent: () => boolean, concurrency = 3
): Promise<unknown[]> {
  let cursor = 0;
  const errors: unknown[] = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (isCurrent() && cursor < tasks.length) {
      const task = tasks[cursor++];
      try { await run(task); } catch (error) { if (isCurrent()) errors.push(error); }
    }
  }));
  return errors;
}
