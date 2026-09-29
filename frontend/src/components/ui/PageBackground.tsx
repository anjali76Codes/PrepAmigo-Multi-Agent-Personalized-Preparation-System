
export function PageBackground({ className }: { className?: string }) {
  return (
    <div className={`absolute inset-0 z-[-1] bg-gradient-to-br from-bg to-surface ${className}`}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(var(--color-carbon-900) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
    </div>
  );
}
