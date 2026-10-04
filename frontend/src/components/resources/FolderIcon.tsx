import { cn } from "../../utils/utils";

export function FolderIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 52" className={cn("w-24 h-20", className)} aria-hidden="true">
            <path d="M4 8a4 4 0 0 1 4-4h14l6 6h28a4 4 0 0 1 4 4v6H4V8Z" className="fill-navy-900" />
            <rect x="4" y="16" width="56" height="32" rx="4" className="fill-chrome" />
            <rect x="4" y="16" width="56" height="5" className="fill-navy-500" opacity="0.6" />
        </svg>
    );
}

export function FolderTile({ title, count, subtitle, onClick }: { title: string; count?: number; subtitle?: string; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className="group flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-lavender-100 focus-visible:bg-lavender-100 transition-colors">
            <FolderIcon className="group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-sm font-semibold text-carbon-900 text-center w-full line-clamp-2">{title}</span>
            {subtitle && <span className="text-[11px] text-navy-300 text-center line-clamp-1">{subtitle}</span>}
            {count !== undefined && <span className="text-xs text-navy-300">{count} items</span>}
        </button>
    );
}