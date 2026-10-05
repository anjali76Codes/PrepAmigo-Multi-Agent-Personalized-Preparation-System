import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { ChatInput } from "../components/chat/ChatInput";
import { DirectorySearch } from "../components/resources/DirectorySearch";
import { FolderTile } from "../components/resources/FolderIcon";
import { buildTree, filterTree } from "../lib/resourceTree";
import { useAppContext } from "../context/AppContext";
import { SUGGESTED_QUESTIONS } from "../data/mockNotes";

const PREVIEW_COUNT = 4;

export function ResourcePackHome() {
  const navigate = useNavigate();
  const { activePrep } = useAppContext();
  const tree = useMemo(() => buildTree(activePrep), [activePrep]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => filterTree(tree, q), [tree, q]);
  const folders = matches.filter((n) => n.kind === "folder");
  const shown = q ? folders : folders.slice(0, PREVIEW_COUNT);

  const openFolder = (id: string) => navigate(`/resource-pack/notes?open=${id}`);
  const handleSend = (msg: string) => navigate("/resource-pack/chat", { state: { initialMessage: msg } });

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-4 md:px-8 py-5 shrink-0 shadow-xs">
        <h1 className="text-xl md:text-2xl font-extrabold text-carbon-900 tracking-tight">Resource Pack</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
        <div className="max-w-5xl mx-auto space-y-10 pb-16">

          <section className="space-y-5">
            <h2 className="text-xl font-bold text-carbon-900 flex items-center gap-2 border-b border-border pb-3">
              <Icon name="folder-open" className="text-chrome" /> Resource Directory
            </h2>

            <DirectorySearch value={query} onChange={setQuery} />

            {shown.length === 0 ? (
              <div className="text-center py-10 text-navy-300">No results found.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {shown.map((f) => (
                  <FolderTile key={f.id} title={f.title} count={f.children?.length ?? 0} onClick={() => openFolder(f.id)} />
                ))}
              </div>
            )}

            {!q && (
              <div className="flex justify-center">
                <Link to="/resource-pack/notes"
                  className="px-6 py-2.5 bg-lavender-100 hover:bg-chrome-accent/40 text-chrome text-sm font-bold rounded-xl border border-border transition-colors">
                  View more
                </Link>
              </div>
            )}
          </section>

          <section className="space-y-5 pt-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold text-carbon-900">Ask your Resources</h2>
              <p className="text-sm font-medium text-carbon-500">Ask anything about your sprints, notes, and references.</p>
            </div>
            <div className="max-w-2xl mx-auto w-full">
              <ChatInput onSend={handleSend} placeholder="Search topics, explain concepts, or find links..." />
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
              {SUGGESTED_QUESTIONS.map((s) => (
                <button key={s} onClick={() => handleSend(s)}
                  className="px-4 py-2 bg-white border border-border rounded-full text-xs font-bold text-chrome hover:bg-lavender-100 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}