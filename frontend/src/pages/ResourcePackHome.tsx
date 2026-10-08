import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Mascot } from "../components/ui/Mascot";
import { ChatInput } from "../components/chat/ChatInput";
import { DirectorySearch } from "../components/resources/DirectorySearch";
import { FolderTile } from "../components/resources/FolderIcon";
import { buildTree, filterTree } from "../lib/resourceTree";
import { getCustomItems, type CustomResourceItem } from "../lib/customResources";
import { useAppContext } from "../context/AppContext";
import { SUGGESTED_QUESTIONS } from "../data/mockNotes";

const PREVIEW_COUNT = 4;

export function ResourcePackHome() {
  const navigate = useNavigate();
  const { activePrep } = useAppContext();
  const [customItems, setCustomItems] = useState<CustomResourceItem[]>([]);
  const [resourceError, setResourceError] = useState("");
  useEffect(() => {
    let active = true;
    getCustomItems()
      .then((items) => { if (active) setCustomItems(items); })
      .catch((error: unknown) => {
        if (active) setResourceError(error instanceof Error ? error.message : "Could not load your resources.");
      });
    return () => { active = false; };
  }, []);
  const tree = useMemo(() => buildTree(activePrep, customItems), [activePrep, customItems]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => filterTree(tree, q), [tree, q]);
  const folders = matches.filter((n) => n.kind === "folder");
  const shown = q ? folders : folders.slice(0, PREVIEW_COUNT);

  const openFolder = (id: string) => navigate(`/resource-pack/notes?open=${id}`);
  const handleSend = (msg: string) => navigate("/resource-pack/chat", { state: { initialMessage: msg } });

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <div className="w-full px-6 md:px-12 py-6 md:py-8 space-y-10 pb-12">

          {/* Header */}
          <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 mb-2">Resource Pack</h1>
              <p className="text-base md:text-lg text-carbon-700 font-medium max-w-xl">
                All your sprint notes, links and references in one place.
              </p>
            </div>
            <div className="hidden sm:flex shrink-0">
              <Mascot size="lg" variant="working.png" className="bg-surface border border-border rounded-full p-2" />
            </div>
          </Card>

          {/* Directory */}
          <section className="space-y-5">
            <h2 className="text-xl font-bold text-carbon-900 flex items-center gap-2 border-b border-border pb-3">
              <Icon name="folder-open" className="text-chrome" /> Resource Directory
            </h2>

            <DirectorySearch value={query} onChange={setQuery} />
            {resourceError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {resourceError}
              </p>
            )}

            {shown.length === 0 ? (
              <div className="text-center py-10 text-carbon-500">No results found.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {shown.map((f) => (
                  <FolderTile key={f.id} title={f.title} count={f.children?.length ?? 0} onClick={() => openFolder(f.id)} />
                ))}
              </div>
            )}

            {!q && (
              <div className="flex justify-center">
                <Link to="/resource-pack/notes">
                  <Button variant="outline" className="border gap-2">
                    View more <Icon name="arrow-forward" />
                  </Button>
                </Link>
              </div>
            )}
          </section>

          {/* Ask header & suggestions */}
          <section className="space-y-4 pt-2">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold text-carbon-900">Ask your Resources</h2>
              <p className="text-sm font-medium text-carbon-500">Ask anything about your sprints, notes, and references.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
              {SUGGESTED_QUESTIONS.map((s) => (
                <button key={s} onClick={() => handleSend(s)}
                  className="px-4 py-2 bg-surface border border-border rounded-full text-xs font-bold text-chrome hover:bg-lavender-100 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Floating Chat Input at the bottom */}
      <div className="pointer-events-none sticky bottom-0 left-0 right-0 z-20 px-4 sm:px-6 pb-5 pt-2 bg-gradient-to-t from-bg via-bg/90 to-transparent">
        <div className="max-w-2xl mx-auto w-full pointer-events-auto shadow-xl rounded-3xl">
          <ChatInput onSend={handleSend} placeholder="Search topics, explain concepts, or find links..." />
        </div>
      </div>
    </div>
  );
}