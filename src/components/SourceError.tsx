export function SourceError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <div className="source-error">Refresh failed: {error}. Showing the last good data.</div>;
}
