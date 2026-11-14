export function pageUrl(path, cursor) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`;
}

export function LoadMore({ query, label = 'results' }) {
  if (!query.hasNextPage) return null;
  return (
    <button
      type="button"
      className="secondary"
      onClick={() => query.fetchNextPage()}
      disabled={query.isFetchingNextPage}
    >
      {query.isFetchingNextPage ? 'Loading…' : `Load more ${label}`}
    </button>
  );
}
