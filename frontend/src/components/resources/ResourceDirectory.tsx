import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Icon } from "../ui/Icon";
import { DirectorySearch } from "./DirectorySearch";
import { FolderTile } from "./FolderIcon";
import {
  buildTree,
  filterTree,
  searchTree,
  pathToId,
  nodesAlong,
  domainOf,
  type TreeNode,
} from "../../lib/resourceTree";
import {
  addCustomItem,
  deleteCustomItem,
  getCustomItems,
  getLegacyCustomItems,
  clearLegacyCustomItems,
  type CustomResourceItem,
} from "../../lib/customResources";
import { SearchResults } from "./SearchResults";
import { cn } from "../../utils/utils";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../ui/Button";

/* ───────────────────────── helpers ───────────────────────── */

const isNote = (n: TreeNode) => n.kind === "file" && (n.isCustom || n.content !== undefined);

const typeLabel = (n: TreeNode) => {
  if (n.kind === "folder") return "Folder";
  if (isNote(n)) return "Note";
  return domainOf(n.url) || "Link";
};

const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/* ───────────────────────── sidebar tree ───────────────────────── */

function SidebarRow({
  node,
  depth,
  activeId,
  open,
  onToggle,
  onGo,
}: {
  node: TreeNode;
  depth: number;
  activeId: string | null;
  open: Set<string>;
  onToggle: (id: string) => void;
  onGo: (id: string) => void;
}) {
  const subfolders = (node.children ?? []).filter((c) => c.kind === "folder");
  const expanded = open.has(node.id);
  const active = activeId === node.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-lg transition-colors",
          active ? "bg-chrome text-on-chrome" : "text-carbon-800 hover:bg-lavender-100"
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          onClick={() => onToggle(node.id)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className={cn("p-1.5 shrink-0", subfolders.length ? "" : "invisible")}
        >
          <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.18 }} className="block">
            <Icon name="chevron-forward" className="text-xs" />
          </motion.span>
        </button>
        <button
          onClick={() => onGo(node.id)}
          className="flex-1 flex items-center gap-2 py-1.5 pr-2 text-left text-sm font-semibold truncate"
        >
          <Icon
            name={expanded || active ? "folder-open" : "folder"}
            className={cn("text-base shrink-0", active ? "text-chrome-accent" : "text-chrome")}
          />
          <span className="truncate">{node.title}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && subfolders.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {subfolders.map((c) => (
              <SidebarRow
                key={c.id}
                node={c}
                depth={depth + 1}
                activeId={activeId}
                open={open}
                onToggle={onToggle}
                onGo={onGo}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── details-view row ───────────────────────── */

function DetailRow({
  node,
  selected,
  onSelect,
  onOpen,
  onDelete,
}: {
  node: TreeNode;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const iconName =
    node.kind === "folder" ? "folder" : node.icon ?? (isNote(node) ? "journal" : "document-text");
  return (
    <div
      role="row"
      onClick={() => (isTouch() ? onOpen() : onSelect())}
      onDoubleClick={onOpen}
      className={cn(
        "group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_80px_32px] items-center gap-3 px-3 py-2 rounded-lg cursor-pointer select-none transition-colors",
        selected ? "bg-chrome/10 ring-1 ring-chrome-border" : "hover:bg-lavender-100"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={iconName} className={cn("text-xl shrink-0", node.kind === "folder" ? "text-chrome" : "text-cocoa")} />
        <span className="truncate text-sm font-semibold text-carbon-900">{node.title}</span>
        {node.isCustom && (
          <span className="hidden md:inline text-[10px] font-medium bg-surface-muted text-carbon-500 px-1.5 py-0.5 rounded">
            Custom
          </span>
        )}
      </div>
      <span className="hidden sm:block text-xs font-medium text-carbon-500 truncate">{typeLabel(node)}</span>
      <span className="hidden sm:block text-xs font-medium text-carbon-500 text-right">
        {node.kind === "folder" ? `${node.children?.length ?? 0} items` : ""}
      </span>
      <span className="flex justify-end">
        {node.isCustom && (
          <button
            onClick={(e) => onDelete(node.id, e)}
            title={node.kind === "folder" ? "Delete folder" : "Delete note"}
            className="p-1 text-carbon-400 hover:text-danger-600 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <Icon name="trash-outline" className="text-sm" />
          </button>
        )}
      </span>
    </div>
  );
}

/* ───────────────────────── main component ───────────────────────── */

export function ResourceDirectory() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { activePrep } = useAppContext();
  const [customItems, setCustomItems] = useState<CustomResourceItem[]>([]);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importingLegacy, setImportingLegacy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const tree = useMemo(() => buildTree(activePrep, customItems), [activePrep, customItems]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>(() => {
    const id = params.get("open");
    return (id && pathToId(tree, id)) || [];
  });
  // sidebar expansion
  const [open, setOpen] = useState<Set<string>>(() => new Set(path));

  useEffect(() => {
    const id = params.get("open");
    if (!id) return;
    const nextPath = pathToId(tree, id);
    if (nextPath) {
      setPath(nextPath);
      setOpen((p) => new Set([...p, ...nextPath]));
    }
  }, [params, tree]);

  // keep the sidebar expanded along the current path, clear selection on navigation
  useEffect(() => {
    setOpen((p) => new Set([...p, ...path]));
    setSelectedId(null);
  }, [path]);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    let active = true;
    getCustomItems()
      .then((items) => {
        if (!active) return;
        setCustomItems(items);
        const imported = new Set(items.map((item) => item.legacyId).filter(Boolean));
        setLegacyCount(getLegacyCustomItems().filter((item) => !imported.has(item.id)).length);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load your resources.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!showFolderModal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowFolderModal(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFolderModal]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => filterTree(tree, q), [tree, q]);
  const hits = useMemo(() => (q ? searchTree(tree, q) : []), [tree, q]);
  const jumpTo = (id: string) => {
    setQuery("");
    setPath(pathToId(tree, id) ?? []);
  };
  const crumbs = nodesAlong(filtered, path);
  const currentFolder = crumbs.length ? crumbs[crumbs.length - 1] : null;
  const currentFolderId = currentFolder ? currentFolder.id : "root";
  const items = currentFolder ? currentFolder.children ?? [] : filtered;
  const selected = items.find((n) => n.id === selectedId) ?? null;

  const goUp = () => setPath((p) => p.slice(0, -1));
  const toggleOpen = (id: string) =>
    setOpen((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const goToFolder = (id: string) => {
    setQuery("");
    setPath(pathToId(tree, id) ?? []);
  };

  const handleOpenNote = (node: TreeNode) => {
    if (node.isCustom) navigate(`/resource-pack/notes/${encodeURIComponent(node.id)}`);
  };

  const openNode = (n: TreeNode) => {
    if (n.kind === "folder") setPath([...path, n.id]);
    else if (isNote(n)) handleOpenNote(n);
    else if (n.url && n.url !== "#") window.open(n.url, "_blank", "noopener,noreferrer");
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const item = await addCustomItem({
        parentId: currentFolderId,
        title: newFolderName.trim(),
        kind: "folder",
      });
      setCustomItems((items) => [...items, item]);
      setNewFolderName("");
      setShowFolderModal(false);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not create the folder.");
    }
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this custom item?")) {
      void deleteCustomItem(id).then(() => {
        const removed = new Set([id]);
        let added = true;
        while (added) {
          added = false;
          for (const item of customItems) {
            if (!removed.has(item.id) && removed.has(item.parentId)) {
              removed.add(item.id);
              added = true;
            }
          }
        }
        setCustomItems((items) => items.filter((item) => !removed.has(item.id)));
        setLoadError("");
      }).catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Could not delete the resource.");
      });
    }
  };

  const handleImportLegacy = async () => {
    const legacyItems = getLegacyCustomItems();
    const importedIds = new Map(
      customItems.filter((item) => item.legacyId).map((item) => [item.legacyId!, item.id]),
    );
    const legacyIds = new Set(legacyItems.map((item) => item.id));
    const pending = legacyItems.filter((item) => !importedIds.has(item.id));
    setImportingLegacy(true);
    setLoadError("");
    try {
      while (pending.length) {
        const readyIndex = pending.findIndex((item) =>
          item.parentId === "root" ||
          importedIds.has(item.parentId) ||
          !legacyIds.has(item.parentId),
        );
        if (readyIndex === -1) {
          throw new Error("The old browser folders contain a parent cycle and could not be imported safely.");
        }
        const [item] = pending.splice(readyIndex, 1);
        const saved = await addCustomItem({
          legacyId: item.id,
          parentId: importedIds.get(item.parentId) || "root",
          title: item.title,
          kind: item.kind,
          content: item.content,
          url: item.url,
          icon: item.icon,
        });
        importedIds.set(item.id, saved.id);
        setCustomItems((items) => items.some((current) => current.id === saved.id) ? items : [...items, saved]);
      }
      clearLegacyCustomItems();
      setLegacyCount(0);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not import the older browser notes.");
    } finally {
      setImportingLegacy(false);
    }
  };

  /* ── motion ── */
  const pane: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.18, staggerChildren: reduce ? 0 : 0.03 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, scale: reduce ? 1 : 0.94, y: reduce ? 0 : 6 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
  };

  const paneKey = `${path.join("/")}|${view}|${q ? "search" : "browse"}`;
  const itemCount = q ? hits.length : items.length;

  return (
    <div className="space-y-4">
      <DirectorySearch value={query} onChange={(v) => { setQuery(v); setPath([]); }} />

      {loadError && (
        <p role="alert" className="rounded-xl border border-danger-600/30 bg-danger-100 px-4 py-3 text-sm text-danger-600">
          {loadError}
        </p>
      )}
      {legacyCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm text-carbon-700">
            {legacyCount} older browser resource{legacyCount === 1 ? "" : "s"} are not in your account yet.
          </p>
          <Button size="sm" variant="outline" loading={importingLegacy} onClick={() => void handleImportLegacy()}>
            Import from this browser
          </Button>
        </div>
      )}

      {/* ── Explorer window ── */}
      <div className="rounded-3xl border border-border bg-surface overflow-hidden shadow-card">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-muted border-b border-border flex-wrap">
          <button
            onClick={goUp}
            disabled={path.length === 0}
            aria-label="Go up one level"
            className="p-2 rounded-lg text-chrome hover:bg-lavender-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Icon name="arrow-up" className="text-base" />
          </button>

          {/* Address bar */}
          <nav
            aria-label="Breadcrumb"
            className="flex-1 min-w-[160px] flex items-center gap-1 rounded-xl bg-surface border border-border px-3 py-1.5 overflow-x-auto text-sm font-semibold whitespace-nowrap"
          >
            <button
              onClick={() => setPath([])}
              className={cn("flex items-center gap-1.5 hover:underline", crumbs.length ? "text-chrome" : "text-carbon-900")}
            >
              <Icon name="home-outline" className="text-sm" /> Directory
            </button>
            <AnimatePresence initial={false}>
              {crumbs.map((c, i) => (
                <motion.span
                  key={c.id}
                  initial={{ opacity: 0, x: reduce ? 0 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduce ? 0 : -8 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center gap-1"
                >
                  <Icon name="chevron-forward" className="text-xs text-rosewood" />
                  <button
                    onClick={() => setPath(path.slice(0, i + 1))}
                    className={i === crumbs.length - 1 ? "text-carbon-900" : "text-chrome hover:underline"}
                  >
                    {c.title}
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </nav>

          {/* Actions */}
          <motion.button
            whileTap={reduce ? undefined : { scale: 0.95 }}
            onClick={() => navigate(`/resource-pack/notes/new?parent=${encodeURIComponent(currentFolderId)}`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-chrome text-on-chrome text-xs font-bold rounded-lg hover:bg-chrome-hover transition-colors"
          >
            <Icon name="add" className="text-sm" />
            New note
          </motion.button>
          <motion.button
            whileTap={reduce ? undefined : { scale: 0.95 }}
            onClick={() => {
              setNewFolderName("");
              setShowFolderModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-carbon-800 text-xs font-bold rounded-lg hover:bg-lavender-100 transition-colors"
          >
            <Icon name="folder-outline" className="text-sm text-chrome" />
            New folder
          </motion.button>

          {/* View switch with sliding pill */}
          <div className="relative flex gap-1 bg-lavender-100 p-1 rounded-lg border border-border">
            {(["grid", "list"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                aria-label={`${m} view`}
                aria-pressed={view === m}
                className={cn(
                  "relative p-1.5 rounded-md transition-colors",
                  view === m ? "text-chrome" : "text-carbon-500 hover:text-carbon-900"
                )}
              >
                {view === m && (
                  <motion.span
                    layoutId="view-pill"
                    className="absolute inset-0 rounded-md bg-surface shadow-xs"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon name={m} className="relative text-sm" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden md:block w-60 shrink-0 border-r border-border bg-lavender-50 p-2 max-h-[60vh] overflow-y-auto">
            <button
              onClick={() => setPath([])}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg text-sm font-bold text-left transition-colors",
                path.length === 0 ? "bg-chrome text-on-chrome" : "text-carbon-900 hover:bg-lavender-100"
              )}
            >
              <Icon name="home-outline" className="text-base" /> Directory
            </button>
            {tree
              .filter((n) => n.kind === "folder")
              .map((n) => (
                <SidebarRow
                  key={n.id}
                  node={n}
                  depth={0}
                  activeId={path[path.length - 1] ?? null}
                  open={open}
                  onToggle={toggleOpen}
                  onGo={goToFolder}
                />
              ))}
          </aside>

          {/* Content pane */}
          <div className="flex-1 min-w-0 min-h-[320px] max-h-[60vh] overflow-y-auto p-3 md:p-4" onClick={() => setSelectedId(null)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={paneKey} variants={pane} initial="hidden" animate="show" exit="exit">
                {q ? (
                  <SearchResults hits={hits} onFolder={jumpTo} onNote={handleOpenNote} />
                ) : view === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((n) => (
                      <motion.div
                        key={n.id}
                        variants={item}
                        whileHover={reduce ? undefined : { y: -3 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          isTouch() ? openNode(n) : setSelectedId(n.id);
                        }}
                        onDoubleClick={() => openNode(n)}
                        className={cn(
                          "relative group rounded-2xl cursor-pointer select-none transition-shadow",
                          selectedId === n.id && "ring-2 ring-chrome-border bg-chrome/5"
                        )}
                      >
                        {n.kind === "folder" ? (
                          // click is handled by the wrapper (select / double-click to open)
                          <div className="pointer-events-none">
                            <FolderTile title={n.title} count={n.children?.length ?? 0} onClick={() => { }} />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 p-3">
                            <Icon
                              name={n.icon ?? (isNote(n) ? "journal" : "document-text")}
                              className={cn("text-6xl", isNote(n) ? "text-chrome" : "text-cocoa")}
                            />
                            <span className="text-xs font-semibold text-carbon-900 text-center line-clamp-2">
                              {n.title}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                isNote(n) ? "bg-lavender-100 text-chrome" : "bg-surface-muted text-carbon-500"
                              )}
                            >
                              {typeLabel(n)}
                            </span>
                          </div>
                        )}
                        {n.isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustom(n.id, e)}
                            title={n.kind === "folder" ? "Delete folder" : "Delete note"}
                            className="absolute top-2 right-2 p-1.5 bg-surface/90 hover:bg-danger-100 text-carbon-400 hover:text-danger-600 rounded-md shadow-xs sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          >
                            <Icon name="trash-outline" className="text-xs" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div role="table" className="text-sm">
                    <div
                      role="row"
                      className="hidden sm:grid grid-cols-[1fr_120px_80px_32px] gap-3 px-3 pb-2 mb-1 border-b border-border text-xs font-bold text-carbon-500"
                    >
                      <span>Name</span>
                      <span>Type</span>
                      <span className="text-right">Contents</span>
                      <span />
                    </div>
                    {items.map((n) => (
                      <motion.div key={n.id} variants={item}>
                        <DetailRow
                          node={n}
                          selected={selectedId === n.id}
                          onSelect={() => setSelectedId(n.id)}
                          onOpen={() => openNode(n)}
                          onDelete={handleDeleteCustom}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {!q && items.length === 0 && (
                  <div className="text-center py-14 text-carbon-500">
                    <motion.div
                      animate={reduce ? undefined : { y: [0, -4, 0] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Icon name="folder-open-outline" className="text-5xl mx-auto mb-2 text-rosewood" />
                    </motion.div>
                    <p className="text-sm font-semibold text-carbon-900">This folder is empty</p>
                    <p className="text-xs mt-1">Use New note or New folder above to add something.</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-surface-muted border-t border-border text-xs font-semibold text-cocoa">
          <span>
            {itemCount} {q ? (itemCount === 1 ? "result" : "results") : itemCount === 1 ? "item" : "items"}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            {selected && (
              <motion.span
                key={selected.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="truncate"
              >
                {selected.title} · {typeLabel(selected)} · double-click to open
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowFolderModal(false)}
            className="fixed inset-0 bg-expresso/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Create new folder"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.94, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="bg-surface rounded-3xl p-6 max-w-md w-full border border-border shadow-pop space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-carbon-900 flex items-center gap-2">
                  <Icon name="folder" className="text-chrome" />
                  Create new folder
                </h3>
                <button
                  onClick={() => setShowFolderModal(false)}
                  aria-label="Close"
                  className="text-carbon-400 hover:text-carbon-700"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>
              <form onSubmit={handleCreateFolder} className="space-y-4">
                <div>
                  <label htmlFor="new-folder-name" className="block text-xs font-bold text-carbon-700 mb-1">
                    Folder name
                  </label>
                  <input
                    id="new-folder-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. System Design Notes"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-carbon-900 text-sm font-medium focus:outline-none focus:border-chrome"
                  />
                </div>
                <p className="text-xs text-carbon-500">
                  Will be created inside:{" "}
                  <span className="font-semibold text-carbon-800">
                    {currentFolder?.title || "Directory"}
                  </span>
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowFolderModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Create folder
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}