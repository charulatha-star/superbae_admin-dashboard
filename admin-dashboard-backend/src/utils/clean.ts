type PlainDocument = Record<string, unknown> & {
  toObject?: () => Record<string, unknown>;
};

export function cleanDoc<T>(doc: T): T {
  if (!doc) return doc;

  const source = doc as PlainDocument;
  const obj = typeof source.toObject === 'function' ? source.toObject() : { ...source };
  delete obj._id;
  delete obj.__v;
  return obj as T;
}

export function cleanDocs<T>(docs: T[]): T[] {
  return docs.map(cleanDoc);
}
