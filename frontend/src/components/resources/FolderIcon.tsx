import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";

export function FolderIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 52" className={cn("w-24 h-20", className)} aria-hidden="true">
            <path d="M4 8a4 4 0 0 1 4-4h14l6 6h28a4 4 0 0 1 4 4v6H4V8Z" className="fill-deep-emerald" />
            <rect x="4" y="16" width="56" height="32" rx="4" className="fill-chrome" />
            <rect x="4" y="16" width="56" height="5" className="fill-cocoa" opacity="0.6" />
        </svg>
    );
}

const TILE =
    "group flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-lavender-100 focus-visible:bg-lavender-100 transition-colors";

export function FolderTile({ title, count, subtitle, onClick }: { title: string; count?: number; subtitle?: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className={TILE}>
            <FolderIcon className="group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-sm font-semibold text-carbon-900 text-center w-full line-clamp-2">{title}</span>
            {subtitle && <span className="text-[11px] text-carbon-500 text-center line-clamp-1">{subtitle}</span>}
            {count !== undefined && <span className="text-xs text-carbon-500">{count} items</span>}
        </button>
    );
}

export function FileTile({ title, url, icon, subtitle, domain }: { title: string; url?: string; icon?: string; subtitle?: string; domain?: string }) {
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={TILE}>
            <Icon name={icon ?? "document-text"} className="text-6xl text-cocoa group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-xs font-semibold text-carbon-900 text-center line-clamp-2">{title}</span>
            {subtitle && <span className="text-[11px] text-carbon-500 text-center line-clamp-1">{subtitle}</span>}
            {domain && <span className="text-[11px] font-semibold text-chrome">{domain}</span>}
        </a>
    );
}