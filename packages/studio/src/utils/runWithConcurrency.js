export async function runWithConcurrency(items, maxConcurrency, worker) {
  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(maxConcurrency)),
  );
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    }),
  );
}
