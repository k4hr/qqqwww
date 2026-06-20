export async function timedMovieQuery<T>(name: string, query: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await query();
  } finally {
    console.info(`[REDFILM] ${name} took ${Date.now() - startedAt}ms`);
  }
}
