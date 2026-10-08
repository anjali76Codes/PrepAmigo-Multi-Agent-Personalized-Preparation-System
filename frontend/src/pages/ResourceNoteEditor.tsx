import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import {
  addCustomItem,
  getCustomItems,
  updateCustomItem,
  type CustomResourceItem,
} from "../lib/customResources";

const MDEditor = lazy(() => import("@uiw/react-md-editor").then((module) => ({ default: module.default })));

export function ResourceNoteEditor() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !noteId || noteId === "new";
  const [note, setNote] = useState<Pick<CustomResourceItem, "title" | "content" | "parentId">>({
    title: "",
    content: "",
    parentId: searchParams.get("parent") || "root",
  });
  const [folderTitle, setFolderTitle] = useState("Root Directory");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    let active = true;
    getCustomItems()
      .then((items) => {
        if (!active) return;
        const folders = new Map(items.filter((item) => item.kind === "folder").map((item) => [item.id, item.title]));
        if (!isNew && noteId) {
          const existing = items.find((item) => item.id === noteId && item.kind === "file");
          if (!existing) {
            setError("That note could not be found in your resources.");
          } else {
            setNote({ title: existing.title, content: existing.content, parentId: existing.parentId });
            setSavedAt(existing.updatedAt);
          }
        }
        const parentId = isNew ? searchParams.get("parent") || "root" : items.find((item) => item.id === noteId)?.parentId || "root";
        setFolderTitle(parentId === "root" ? "Root Directory" : folders.get(parentId) || "Resource folder");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load this note.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isNew, noteId, searchParams]);

  const save = async () => {
    if (saving) return;
    if (!note.title.trim()) {
      setError("Add a title before saving your note.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = isNew
        ? await addCustomItem({ parentId: note.parentId, title: note.title, content: note.content, kind: "file", icon: "journal" })
        : await updateCustomItem(noteId!, { title: note.title, content: note.content });
      setSavedAt(saved.updatedAt);
      if (isNew) navigate(`/resource-pack/notes/${encodeURIComponent(saved.id)}`, { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your note.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div onKeyDown={handleEditorKeyDown} className="flex-1 min-h-0 overflow-y-auto bg-bg text-carbon-700">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-10 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link to="/resource-pack/notes" className="inline-flex items-center gap-2 text-sm font-bold text-chrome hover:underline">
              <Icon name="arrow-back" /> Resource Directory
            </Link>
            <h1 className="text-2xl font-extrabold text-carbon-900">{isNew ? "New note" : "Edit note"}</h1>
          </div>
          <Button onClick={() => void save()} loading={saving} disabled={loading || !note.title.trim()}>
            <Icon name="checkmark" className="mr-2" />
            Save note
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Card className="space-y-4 p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-carbon-600">Note title</span>
              <input
                autoFocus
                value={note.title}
                onChange={(event) => setNote((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Distributed caching strategies"
                className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-lg font-semibold text-carbon-900 outline-none transition-colors focus:border-chrome"
              />
            </label>
            <div className="pb-1 text-xs text-carbon-500">
              <span className="font-semibold text-carbon-700">Folder:</span> {folderTitle}
              {savedAt && <span className="ml-3">Saved {new Date(savedAt).toLocaleString()}</span>}
            </div>
          </div>

          <div data-color-mode="light" className="resource-markdown-editor overflow-hidden rounded-xl border border-border">
            <Suspense fallback={<div className="flex h-[560px] items-center justify-center text-sm text-carbon-500">Loading Markdown editor...</div>}>
              <MDEditor
                value={note.content}
                onChange={(value) => setNote((current) => ({ ...current, content: value || "" }))}
                preview="live"
                height={560}
                textareaProps={{ placeholder: "Write your notes in Markdown. Use fenced code blocks for examples." }}
                previewOptions={{ style: { backgroundColor: "var(--color-bg, #ffffff)", color: "var(--color-carbon-900, #222222)" } }}
                className="!bg-surface"
              />
            </Suspense>
          </div>
          <p className="text-xs text-carbon-500">
            Markdown is supported, including headings, lists, links, tables, and fenced code blocks. Press Ctrl/⌘+S to save.
          </p>
        </Card>
      </div>
    </div>
  );
}
