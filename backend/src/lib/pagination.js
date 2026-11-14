export function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ t: new Date(row.createdAt).toISOString(), id: row.id })).toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    const createdAt = new Date(parsed.t);
    if (!parsed.id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function cursorWhere(cursor) {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  return {
    OR: [
      { createdAt: { lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, id: { lt: decoded.id } },
    ],
  };
}

export function pageResult(rows, limit) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
}
