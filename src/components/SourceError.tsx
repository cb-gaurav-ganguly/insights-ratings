export function SourceError({ error, hasData }: { error: string | undefined; hasData?: boolean }) {
  if (!error) return null;
  return (
    <div className="source-error" role="alert">
      <span className="source-error-icon" aria-hidden="true">⚠️</span>
      <span>
        {hasData
          ? `Refresh failed: ${error}. Preserving last good data.`
          : `Failed to load: ${error}.`}
      </span>
    </div>
  );
}
