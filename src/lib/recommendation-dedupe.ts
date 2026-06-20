type Identifiable = { id: string };

export function excludeCurrentMovie<T extends Identifiable>(list: T[], movieId: string) {
  return list.filter((movie) => movie.id !== movieId);
}

export function takeUniqueMovies<T extends Identifiable>(list: T[], count: number, excludedIds: Iterable<string> = []) {
  const used = new Set(excludedIds);
  const result: T[] = [];
  for (const movie of list) {
    if (used.has(movie.id)) continue;
    used.add(movie.id);
    result.push(movie);
    if (result.length >= count) break;
  }
  return result;
}

export function dedupeMovieLists<T extends Identifiable>(...lists: T[][]) {
  const used = new Set<string>();
  return lists.map((list) => {
    const unique = takeUniqueMovies(list, list.length, used);
    for (const movie of unique) used.add(movie.id);
    return unique;
  });
}
