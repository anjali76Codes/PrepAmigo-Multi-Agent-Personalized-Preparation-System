import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { DirectorySearch } from "./DirectorySearch";
import { FolderTile } from "./FolderIcon";
import {
  buildTree,
  filterTree,
  searchTree,
  allFolderIds,
  pathToId,
  nodesAlong,
  type TreeNode,
} from "../../lib/resourceTree";
import {
  addCustomItem,
  updateCustomItem,
  deleteCustomItem,
} from "../../lib/customResources";
import { SearchResults } from "./SearchResults";
import { cn } from "../../utils/utils";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../ui/Button";

function ListNode({
  node,
  depth,
  open,
  toggle,
  onOpenNote,
  onDeleteCustom,
}: {
  node: TreeNode;
  depth: number;
  open: Set<string>;
  toggle: (id: string) => void;
  onOpenNote: (node: TreeNode) => void;
  onDeleteCustom: (id: string, e: React.MouseEvent) => void;
}) {
  if (node.kind === "file") {
    if (node.isCustom || node.content !== undefined) {
      return (
        <div className="flex items-center justify-between py-1.5 px-3 rounded-xl text-carbon-700 hover:bg-lavender-100 transition-colors group">
          <button
            onClick={() => onOpenNote(node)}
            className="flex items-center gap-2 flex-1 text-left truncate"
          >
            <Icon name={node.icon ?? "document-text"} className="text-base text-navy-500" />
            <span className="truncate">{node.title}</span>
            <span className="text-[10px] bg-lavender-200 text-chrome font-bold px-1.5 py-0.5 rounded">
              Note
            </span>
          </button>
          {node.isCustom && (
            <button
              onClick={(e) => onDeleteCustom(node.id, e)}
              className="text-carbon-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete note"
            >
              <Icon name="trash-outline" className="text-sm" />
            </button>
          )}
        </div>
      );
    }
    return (
      <a
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 py-1.5 px-3 rounded-xl text-carbon-700 hover:bg-lavender-100 transition-colors"
      >
        <Icon name={node.icon ?? "link"} className="text-base text-navy-500" />
        <span className="truncate">{node.title}</span>
      </a>
    );
  }

  const isOpen = open.has(node.id);
  return (
    <div>
      <div className="flex items-center justify-between group rounded-xl hover:bg-lavender-100 transition-colors">
        <button
          onClick={() => toggle(node.id)}
          className={cn(
            "flex-1 flex items-center gap-2 py-2 px-3 text-left text-carbon-900 truncate",
            depth === 0 ? "font-bold" : "font-semibold"
          )}
        >
          <Icon
            name={isOpen ? "folder-open" : "folder"}
            className={cn(depth === 0 ? "text-2xl" : "text-xl", "text-chrome")}
          />
          <span className="truncate">{node.title}</span>
          {node.isCustom && (
            <span className="text-[10px] bg-surface-muted text-carbon-500 font-medium px-1.5 py-0.5 rounded">
              Custom
            </span>
          )}
        </button>
        {node.isCustom && (
          <button
            onClick={(e) => onDeleteCustom(node.id, e)}
            className="text-carbon-400 hover:text-red-500 p-2 mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete folder"
          >
            <Icon name="trash-outline" className="text-sm" />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-5 pl-4 border-l border-border space-y-0.5 my-1">
              {node.children?.length ? (
                node.children.map((c) => (
                  <ListNode
                    key={c.id}
                    node={c}
                    depth={depth + 1}
                    open={open}
                    toggle={toggle}
                    onOpenNote={onOpenNote}
                    onDeleteCustom={onDeleteCustom}
                  />
                ))
              ) : (
                <div className="py-1 px-3 text-xs italic text-navy-300">Empty</div>
              )}
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
  const [refreshKey, setRefreshKey] = useState(0);

  const tree = useMemo(() => buildTree(activePrep), [activePrep, refreshKey]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [path, setPath] = useState<string[]>(() => {
    const id = params.get("open");
    return (id && pathToId(tree, id)) || [];
  });
  const [open, setOpen] = useState<Set<string>>(() => new Set(path));

  // Modal states
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [activeNote, setActiveNote] = useState<{
    id?: string;
    title: string;
    content: string;
    isCustom?: boolean;
    parentId?: string;
  } | null>(null);

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
  const openSet = open;

  useEffect(() => {
    if (q) setOpen(new Set(allFolderIds(filtered)));
  }, [q, filtered]);

  const toggle = (id: string) =>
    setOpen((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    addCustomItem({
      parentId: currentFolderId,
      title: newFolderName.trim(),
      kind: "folder",
    });
    setNewFolderName("");
    setShowFolderModal(false);
    setRefreshKey((k) => k + 1);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !activeNote.title.trim()) return;

    if (activeNote.id && activeNote.isCustom) {
      updateCustomItem(activeNote.id, {
        title: activeNote.title.trim(),
        content: activeNote.content,
      });
    } else {
      addCustomItem({
        parentId: currentFolderId,
        title: activeNote.title.trim(),
        kind: "file",
        content: activeNote.content,
        icon: "journal",
      });
    }
    setActiveNote(null);
    setShowNoteModal(false);
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this custom item?")) {
      deleteCustomItem(id);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleOpenNote = (node: TreeNode) => {
    setActiveNote({
      id: node.id,
      title: node.title,
      content: node.content ?? "",
      isCustom: node.isCustom,
      parentId: node.parentId,
    });
    setShowNoteModal(true);
  };

  return (
    <div className="space-y-5">
      <DirectorySearch value={query} onChange={(v) => { setQuery(v); setPath([]); }} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold flex-wrap">
          <button
            onClick={() => setPath([])}
            className={crumbs.length ? "text-chrome hover:underline" : "text-carbon-900"}
          >
            Directory
          </button>
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-2">
              <span className="text-navy-300">/</span>
              <button
                onClick={() => setPath(path.slice(0, i + 1))}
                className={i === crumbs.length - 1 ? "text-carbon-900" : "text-chrome hover:underline"}
              >
                {c.title}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons */}
          <button
            onClick={() => {
              setActiveNote({
                title: "",
                content: "",
                isCustom: true,
                parentId: currentFolderId,
              });
              setShowNoteModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-chrome text-white text-xs font-bold rounded-lg hover:bg-chrome/90 transition-colors shadow-2xs"
          >
            <Icon name="add" className="text-sm" />
            New Note
          </button>
          <button
            onClick={() => {
              setNewFolderName("");
              setShowFolderModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border text-carbon-800 text-xs font-bold rounded-lg hover:bg-lavender-100 transition-colors shadow-2xs"
          >
            <Icon name="folder-outline" className="text-sm text-chrome" />
            New Folder
          </button>

          <div className="flex gap-1 bg-lavender-100 p-1 rounded-lg border border-border">
            {(["grid", "list"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                aria-label={`${m} view`}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  view === m
                    ? "bg-white shadow-xs text-chrome"
                    : "text-carbon-500 hover:text-carbon-900"
                )}
              >
                <Icon name={m} className="text-sm" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "grid" ? (
        q ? (
          <SearchResults hits={hits} onFolder={jumpTo} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {items.map((n) =>
              n.kind === "folder" ? (
                <div key={n.id} className="relative group">
                  <FolderTile
                    title={n.title}
                    count={n.children?.length ?? 0}
                    onClick={() => setPath([...path, n.id])}
                  />
                  {n.isCustom && (
                    <button
                      onClick={(e) => handleDeleteCustom(n.id, e)}
                      className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-carbon-400 hover:text-red-500 rounded-md shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete folder"
                    >
                      <Icon name="trash-outline" className="text-xs" />
                    </button>
                  )}
                </div>
              ) : n.isCustom || n.content !== undefined ? (
                <div key={n.id} className="relative group">
                  <button
                    onClick={() => handleOpenNote(n)}
                    className="w-full flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-lavender-100 transition-colors text-left"
                  >
                    <Icon
                      name={n.icon ?? "journal"}
                      className="text-6xl text-chrome group-hover:-translate-y-0.5 transition-transform"
                    />
                    <span className="text-xs font-semibold text-carbon-900 text-center line-clamp-2">
                      {n.title}
                    </span>
                    <span className="text-[10px] bg-lavender-200 text-chrome font-bold px-1.5 py-0.5 rounded">
                      Note
                    </span>
                  </button>
                  {n.isCustom && (
                    <button
                      onClick={(e) => handleDeleteCustom(n.id, e)}
                      className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-carbon-400 hover:text-red-500 rounded-md shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete note"
                    >
                      <Icon name="trash-outline" className="text-xs" />
                    </button>
                  )}
                </div>
              ) : (
                <a
                  key={n.id}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-lavender-100 transition-colors"
                >
                  <Icon
                    name={n.icon ?? "document-text"}
                    className="text-6xl text-navy-500 hover:-translate-y-0.5 transition-transform"
                  />
                  <span className="text-xs font-semibold text-carbon-900 text-center line-clamp-2">
                    {n.title}
                  </span>
                </a>
              )
            )}
            {items.length === 0 && (
              <div className="col-span-full text-center py-12 text-carbon-400">
                <Icon name="folder-open-outline" className="text-4xl mx-auto mb-2 text-carbon-300" />
                <p className="text-sm font-semibold">This folder is empty</p>
                <p className="text-xs text-carbon-400 mt-1">
                  Create a new note or folder using the buttons above.
                </p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="bg-white border border-border rounded-2xl p-3 md:p-5 shadow-xs text-sm">
          {items.length === 0 && (
            <div className="text-center py-6 text-navy-300">
              {q ? "No results found." : "This folder is empty."}
            </div>
          )}
          {items.map((n) => (
            <ListNode
              key={n.id}
              node={n}
              depth={0}
              open={openSet}
              toggle={toggle}
              onOpenNote={handleOpenNote}
              onDeleteCustom={handleDeleteCustom}
            />
          ))}
        </div>
      )}

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-border shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-carbon-900 flex items-center gap-2">
                <Icon name="folder" className="text-chrome" />
                Create New Folder
              </h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-carbon-400 hover:text-carbon-700"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-carbon-700 uppercase tracking-wider mb-1">
                  Folder Name
                </label>
                <input
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
                  {currentFolder?.title || "Root Directory"}
                </span>
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFolderModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Folder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Editor/Viewer Modal */}
      {showNoteModal && activeNote && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full border border-border shadow-xl space-y-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-carbon-900 flex items-center gap-2">
                <Icon name="journal" className="text-chrome" />
                {activeNote.id ? (activeNote.isCustom ? "Edit Note" : "View Note") : "New Note"}
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-carbon-400 hover:text-carbon-700"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 flex-1 flex flex-col min-h-0">
              <div>
                <label className="block text-xs font-bold text-carbon-700 uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  readOnly={!activeNote.isCustom && !!activeNote.id}
                  placeholder="e.g. Distributed Caching Strategies"
                  value={activeNote.title}
                  onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-carbon-900 text-sm font-medium focus:outline-none focus:border-chrome"
                />
              </div>

              <div className="flex-1 flex flex-col min-h-[200px]">
                <label className="block text-xs font-bold text-carbon-700 uppercase tracking-wider mb-1">
                  Content / Notes
                </label>
                <textarea
                  readOnly={!activeNote.isCustom && !!activeNote.id}
                  placeholder="Write your notes, key takeaways, code snippets or explanations here..."
                  value={activeNote.content}
                  onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })}
                  className="w-full flex-1 min-h-[200px] resize-y bg-bg border border-border rounded-xl p-4 text-carbon-900 text-sm leading-relaxed font-normal focus:outline-none focus:border-chrome"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-carbon-500">
                  Folder:{" "}
                  <span className="font-semibold text-carbon-800">
                    {currentFolder?.title || "Root Directory"}
                  </span>
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNoteModal(false)}
                  >
                    {activeNote.isCustom || !activeNote.id ? "Cancel" : "Close"}
                  </Button>
                  {(activeNote.isCustom || !activeNote.id) && (
                    <Button type="submit" variant="primary">
                      Save Note
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}