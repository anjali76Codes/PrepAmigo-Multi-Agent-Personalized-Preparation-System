
export function PageBackground({ className }: { className?: string }) {
  return (
    <div className={`absolute inset-0 z-[-1] bg-gradient-to-br from-[#FAF9F6] to-white ${className}`}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#2C3E50 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
    </div>
  );
}
