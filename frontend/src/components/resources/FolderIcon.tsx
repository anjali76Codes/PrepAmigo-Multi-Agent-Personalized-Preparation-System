import type { ReactNode } from "react";
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

/*
 * Shared tile anatomy: icon box → title (grows) → meta lines pinned to the bottom.
 * Grid cells stretch to the tallest tile in a row, so when one title wraps to
 * 3 lines, every icon / title / meta line in that row stays aligned and the
 * next row starts at the same offset.
 */
const TILE_BASE =
    "group h-full w-full min-w-0 flex flex-col items-center gap-2 rounded-2xl px-3 pt-4 pb-3 text-center transition-colors focus-visible:bg-lavender-100";
const TILE_HOVER = "hover:bg-lavender-100";
const TILE_SELECTED = "bg-chrome/10 ring-2 ring-chrome-border";

const tileClass = (selected?: boolean) => cn(TILE_BASE, selected ? TILE_SELECTED : TILE_HOVER);

/** Fixed box (same size as FolderIcon) so folders and notes line up in a row. */
function IconBox({ children }: { children: ReactNode }) {
    return <span className="flex h-20 w-24 shrink-0 items-center justify-center">{children}</span>;
}

function TileTitle({ children }: { children: ReactNode }) {
    return (
        <span className="flex-1 w-full">
            <span className="block text-sm font-semibold leading-snug text-carbon-900 line-clamp-3 break-words">
                {children}
            </span>
        </span>
    );
}

const LIFT = "group-hover:-translate-y-0.5 transition-transform";

type TileInteraction = {
    selected?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
};

export function FolderTile({
    title,
    count,
    subtitle,
    onClick,
    onDoubleClick,
    selected,
}: { title: string; count?: number; subtitle?: string } & TileInteraction) {
    return (
        <button
            type="button"
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            aria-pressed={selected}
            className={tileClass(selected)}
        >
            <IconBox>
                <FolderIcon className={LIFT} />
            </IconBox>
            <TileTitle>{title}</TileTitle>
            {subtitle && <span className="text-[11px] text-carbon-500 line-clamp-1">{subtitle}</span>}
            {count !== undefined && (
                <span className="text-xs text-carbon-500">
                    {count} item{count === 1 ? "" : "s"}
                </span>
            )}
        </button>
    );
}

/** An in-app note (opens the note editor / viewer). */
export function NoteTile({
    title,
    icon,
    subtitle = "Note",
    onClick,
    onDoubleClick,
    selected,
}: { title: string; icon?: string; subtitle?: string } & TileInteraction) {
    return (
        <button
            type="button"
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            aria-pressed={selected}
            className={tileClass(selected)}
        >
            <IconBox>
                <Icon name={icon ?? "journal"} className={cn("text-6xl leading-none text-cocoa", LIFT)} />
            </IconBox>
            <TileTitle>{title}</TileTitle>
            {subtitle && <span className="text-xs text-carbon-500">{subtitle}</span>}
        </button>
    );
}

export function FileTile({ title, url, icon, subtitle, domain }: { title: string; url?: string; icon?: string; subtitle?: string; domain?: string }) {
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={tileClass()}>
            <IconBox>
                <Icon name={icon ?? "document-text"} className={cn("text-6xl leading-none text-cocoa", LIFT)} />
            </IconBox>
            <TileTitle>{title}</TileTitle>
            {subtitle && <span className="text-[11px] text-carbon-500 line-clamp-1">{subtitle}</span>}
            {domain && <span className="text-[11px] font-semibold text-chrome">{domain}</span>}
        </a>
    );
}