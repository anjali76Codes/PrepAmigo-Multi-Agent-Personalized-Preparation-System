import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { DirectorySearch } from "./DirectorySearch";
import { FolderTile } from "./FolderIcon";
import { buildTree, filterTree, searchTree, allFolderIds, pathToId, nodesAlong, type TreeNode } from "../../lib/resourceTree";
import { SearchResults } from "./SearchResults";
import { cn } from "../../utils/utils";
import { useAppContext } from "../../context/AppContext";

function ListNode({ node, depth, open, toggle }: { node: TreeNode; depth: number; open: Set<string>; toggle: (id: string) => void }) {
    if (node.kind === "file") {
        return (
            <a href={node.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 py-1.5 px-3 rounded-xl text-carbon-700 hover:bg-lavender-100 transition-colors">
                <Icon name={node.icon ?? "link"} className="text-base text-navy-500" />
                <span className="truncate">{node.title}</span>
            </a>
        );
    }
    const isOpen = open.has(node.id);
    return (
        <div>
            <button onClick={() => toggle(node.id)}
                className={cn("w-full flex items-center gap-2 py-2 px-3 rounded-xl text-left hover:bg-lavender-100 transition-colors text-carbon-900",
                    depth === 0 ? "font-bold" : "font-semibold")}>
                <Icon name={isOpen ? "folder-open" : "folder"} className={cn(depth === 0 ? "text-2xl" : "text-xl", "text-chrome")} />
                <span className="truncate">{node.title}</span>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="ml-5 pl-4 border-l border-border space-y-0.5 my-1">
                            {node.children?.length
                                ? node.children.map((c) => <ListNode key={c.id} node={c} depth={depth + 1} open={open} toggle={toggle} />)
                                : <div className="py-1 px-3 text-xs italic text-navy-300">Empty</div>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function ResourceDirectory() {
    const [params] = useSearchParams();
    const { activePrep } = useAppContext();
    const tree = useMemo(() => buildTree(activePrep), [activePrep]);
    const [query, setQuery] = useState("");
    const [view, setView] = useState<"grid" | "list">("grid");
    const [path, setPath] = useState<string[]>(() => {
        const id = params.get("open");
        return (id && pathToId(tree, id)) || [];
    });
    const [open, setOpen] = useState<Set<string>>(() => new Set(path));

    const q = query.trim().toLowerCase();
    const filtered = useMemo(() => filterTree(tree, q), [tree, q]);
    const hits = useMemo(() => (q ? searchTree(tree, q) : []), [tree, q]);
    const jumpTo = (id: string) => { setQuery(""); setPath(pathToId(tree, id) ?? []); };
    const crumbs = nodesAlong(filtered, path);
    const items = crumbs.length ? crumbs[crumbs.length - 1].children ?? [] : filtered;
    const openSet = q ? new Set(allFolderIds(filtered)) : open;

    const toggle = (id: string) =>
        setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

    return (
        <div className="space-y-5">
            <DirectorySearch value={query} onChange={(v) => { setQuery(v); setPath([]); }} />

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold flex-wrap">
                    <button onClick={() => setPath([])} className={crumbs.length ? "text-chrome hover:underline" : "text-carbon-900"}>Directory</button>
                    {crumbs.map((c, i) => (
                        <span key={c.id} className="flex items-center gap-2">
                            <span className="text-navy-300">/</span>
                            <button onClick={() => setPath(path.slice(0, i + 1))}
                                className={i === crumbs.length - 1 ? "text-carbon-900" : "text-chrome hover:underline"}>{c.title}</button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-1 bg-lavender-100 p-1 rounded-lg border border-border">
                    {(["grid", "list"] as const).map((m) => (
                        <button key={m} onClick={() => setView(m)} aria-label={`${m} view`}
                            className={cn("p-1.5 rounded-md transition-colors", view === m ? "bg-white shadow-xs text-chrome" : "text-carbon-500 hover:text-carbon-900")}>
                            <Icon name={m} className="text-sm" />
                        </button>
                    ))}
                </div>
            </div>

            {view === "grid" ? (
                q ? (
                    <SearchResults hits={hits} onFolder={jumpTo} />
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {items.map((n) =>
                            n.kind === "folder" ? (
                                <FolderTile key={n.id} title={n.title} count={n.children?.length ?? 0} onClick={() => setPath([...path, n.id])} />
                            ) : (
                                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-lavender-100 transition-colors">
                                    <Icon name={n.icon ?? "document-text"} className="text-6xl text-navy-500" />
                                    <span className="text-xs font-semibold text-carbon-900 text-center line-clamp-2">{n.title}</span>
                                </a>
                            )
                        )}
                    </div>
                )
            ) : (
                <div className="bg-white border border-border rounded-2xl p-3 md:p-5 shadow-xs text-sm">
                    {filtered.length === 0 && <div className="text-center py-6 text-navy-300">No results found.</div>}
                    {filtered.map((n) => <ListNode key={n.id} node={n} depth={0} open={openSet} toggle={toggle} />)}
                </div>
            )}
        </div>
    );
}