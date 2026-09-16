export default function Spinner({ fullPage = false, size = 32 }) {
  const style = { width: size, height: size };
  if (fullPage) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={style} role="status" aria-label="Chargement…" />
        <span style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>Chargement…</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <div className="spinner" style={style} role="status" aria-label="Chargement…" />
    </div>
  );
}
