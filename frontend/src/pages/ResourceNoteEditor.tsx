import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
const MDPreview = lazy(() =>
  import("@uiw/react-md-editor").then((module) => ({ default: module.default.Markdown })),
);

type Draft = Pick<CustomResourceItem, "title" | "content" | "parentId">;
type Mode = "view" | "edit";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Chip({ icon, children, tone = "muted" }: { icon?: string; children: React.ReactNode; tone?: "muted" | "gold" | "emerald" }) {
  const tones = {
    muted: "bg-surface-muted text-cocoa",
    gold: "bg-beige-100 text-beige-600",
    emerald: "bg-sky-100 text-forest-emerald",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export function ResourceNoteEditor() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !noteId || noteId === "new";

  const emptyDraft = useMemo<Draft>(
    () => ({
      title: searchParams.get("title") || "",
      content: searchParams.get("content") || "",
      parentId: searchParams.get("parent") || "root",
    }),
    [searchParams],
  );

  // `saved` is the last persisted version; `note` is the working draft.
  const [saved, setSaved] = useState<Draft>(emptyDraft);
  const [note, setNote] = useState<Draft>(emptyDraft);
  const [mode, setMode] = useState<Mode>(isNew ? "edit" : "view");
  const [folderTitle, setFolderTitle] = useState("Root Directory");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");

  const editing = mode === "edit";
  const dirty = note.title !== saved.title || note.content !== saved.content;

  // New notes open in the editor; existing notes open in the preview.
  useEffect(() => {
    setMode(isNew ? "edit" : "view");
  }, [isNew]);

  useEffect(() => {
    let active = true;
    getCustomItems()
      .then((items) => {
        if (!active) return;
        const folders = new Map(items.filter((item) => item.kind === "folder").map((item) => [item.id, item.title]));
        if (isNew) {
          setSaved(emptyDraft);
          setNote(emptyDraft);
          setError("");
          setSavedAt("");
        } else if (noteId) {
          const existing = items.find((item) => item.id === noteId && item.kind === "file");
          if (!existing) {
            setError("That note could not be found in your resources.");
          } else {
            const loaded = { title: existing.title, content: existing.content, parentId: existing.parentId };
            setSaved(loaded);
            setNote(loaded);
            setSavedAt(existing.updatedAt);
          }
        }
        const parentId = isNew
          ? searchParams.get("parent") || "root"
          : items.find((item) => item.id === noteId)?.parentId || "root";
        setFolderTitle(parentId === "root" ? "Root Directory" : folders.get(parentId) || "Resource folder");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load this note.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [emptyDraft, isNew, noteId, searchParams]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!editing || !dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, dirty]);

  const save = useCallback(async () => {
    if (saving) return;
    if (!note.title.trim()) {
      setError("Add a title before saving your note.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = isNew
        ? await addCustomItem({ parentId: note.parentId, title: note.title, content: note.content, kind: "file", icon: "journal" })
        : await updateCustomItem(noteId!, { title: note.title, content: note.content });
      setSaved({ ...note });
      setSavedAt(result.updatedAt);
      setMode("view");
      if (isNew) navigate(`/resource-pack/notes/${encodeURIComponent(result.id)}`, { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your note.");
    } finally {
      setSaving(false);
    }
  }, [saving, note, isNew, noteId, navigate]);

  const cancelEdit = () => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    if (isNew) {
      navigate("/resource-pack/notes");
      return;
    }
    setNote(saved);
    setError("");
    setMode("view");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
    }
  };

  const hasContent = saved.content.trim().length > 0;

  return (
    <div onKeyDown={handleKeyDown} className="flex-1 min-h-0 overflow-y-auto bg-bg text-carbon-700">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 md:px-10 md:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link to="/resource-pack/notes" className="inline-flex items-center gap-2 text-sm font-bold text-chrome hover:underline">
              <Icon name="arrow-back" /> Resource Directory
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-carbon-900">
                {isNew ? "New note" : editing ? "Editing note" : "Note"}
              </h1>
              {editing && dirty && <Chip tone="gold" icon="ellipse">Unsaved changes</Chip>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-surface-muted px-4 py-2.5 text-sm font-semibold text-cocoa transition-colors hover:bg-lavender-100 disabled:opacity-50"
                >
                  <Icon name="close" /> Cancel
                </button>
                <Button onClick={() => void save()} loading={saving} disabled={loading || !note.title.trim()}>
                  <Icon name="checkmark" className="mr-2" />
                  Save note
                </Button>
              </>
            ) : (
              <Button onClick={() => setMode("edit")} disabled={loading || !!error && !saved.title}>
                <Icon name="create" className="mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-danger-600/30 bg-danger-100 px-4 py-3 text-sm text-danger-600">
            {error}
          </p>
        )}

        {editing ? (
          /* ───────────── Editor ───────────── */
          <Card className="space-y-4 p-4 md:p-6">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-carbon-500">Note title</span>
              <input
                autoFocus={isNew}
                value={note.title}
                onChange={(event) => setNote((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Distributed caching strategies"
                className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-lg font-semibold text-carbon-900 outline-none transition-colors placeholder:text-rosewood/60 focus:border-chrome"
              />
            </label>

            <div data-color-mode="light" className="resource-markdown-editor overflow-hidden rounded-xl border border-border">
              <Suspense fallback={<div className="flex h-[560px] items-center justify-center text-sm text-carbon-500">Loading Markdown editor...</div>}>
                <MDEditor
                  value={note.content}
                  onChange={(value) => setNote((current) => ({ ...current, content: value || "" }))}
                  preview="live"
                  height={560}
                  textareaProps={{ placeholder: "Write your notes in Markdown. Use fenced code blocks for examples." }}
                  previewOptions={{ style: { backgroundColor: "var(--color-surface)", color: "var(--color-carbon-900)" } }}
                  className="!bg-surface"
                />
              </Suspense>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-carbon-500">
              <span>
                Markdown supported: headings, lists, links, tables and fenced code. Press{" "}
                <kbd className="rounded bg-surface-muted px-1.5 py-0.5 font-semibold text-cocoa">Ctrl/⌘ + S</kbd> to save.
              </span>
              <span>
                <span className="font-semibold text-carbon-700">Folder:</span> {folderTitle}
              </span>
            </div>
          </Card>
        ) : (
          /* ───────────── Preview ───────────── */
          <Card className="overflow-hidden p-0">
            <div className="space-y-3 border-b border-border bg-surface-muted/60 px-5 py-6 md:px-10 md:py-8">
              <div className="flex flex-wrap items-center gap-2">
                <Chip icon="folder">{folderTitle}</Chip>
                {savedAt && <Chip icon="time">Updated {formatDate(savedAt)}</Chip>}
              </div>
              <h2 className="break-words text-3xl font-extrabold leading-tight text-carbon-900 md:text-4xl">
                {loading ? "Loading…" : saved.title || "Untitled note"}
              </h2>
            </div>

            <div data-color-mode="light" className="px-5 py-6 md:px-10 md:py-8">
              {loading ? (
                <p className="text-sm text-carbon-500">Loading note…</p>
              ) : hasContent ? (
                <Suspense fallback={<p className="text-sm text-carbon-500">Rendering note…</p>}>
                  <MDPreview
                    source={saved.content}
                    style={{ backgroundColor: "transparent", color: "var(--color-carbon-900)", fontFamily: "var(--font-sans)" }}
                  />
                </Suspense>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-lavender-50 px-6 py-12 text-center">
                  <Icon name="journal" className="text-5xl text-rosewood" />
                  <p className="text-sm font-semibold text-carbon-700">This note is empty</p>
                  <p className="text-xs text-carbon-500">Press Edit to start writing in Markdown.</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}