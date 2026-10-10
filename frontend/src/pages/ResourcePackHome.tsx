import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Mascot } from "../components/ui/Mascot";
import { FolderTile } from "../components/resources/FolderIcon";
import { buildTree, filterTree, type TreeNode } from "../lib/resourceTree";
import { getCustomItems, type CustomResourceItem } from "../lib/customResources";
import { useAppContext } from "../context/AppContext";

const PREVIEW_COUNT = 4;

/** Count every file below a node (any depth). */
const countFiles = (nodes: TreeNode[]): number =>
  nodes.reduce((sum, n) => sum + (n.kind === "file" ? 1 : countFiles(n.children ?? [])), 0);

export function ResourcePackHome() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
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
  const folders = useMemo(() => filterTree(tree, "").filter((n) => n.kind === "folder"), [tree]);
  const shown = folders.slice(0, PREVIEW_COUNT);
  const totalFiles = useMemo(() => countFiles(tree), [tree]);

  const openFolder = (id: string) => navigate(`/resource-pack/notes?open=${id}`);

  // One orchestrated entrance for the whole page, nothing scattered after that.
  const page: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.05 } },
  };
  const rise: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 28 } },
  };
  const tile: Variants = {
    hidden: { opacity: 0, scale: reduce ? 1 : 0.9, y: reduce ? 0 : 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 24 } },
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <motion.div
          variants={page}
          initial="hidden"
          animate="show"
          className="w-full px-6 md:px-12 py-6 md:py-8 space-y-10 pb-12"
        >
          {/* Header (unchanged UI) */}
          <motion.div variants={rise}>
            <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6">
              <div className="flex-1 min-w-0 space-y-4">
                {/* Back to Dashboard */}
                <Link to="/dashboard">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 -ml-3 font-bold border-none text-chrome mb-4"
                  >
                    <Icon name="arrow-back" />
                    Dashboard
                  </Button>
                </Link>
                <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 mb-2">Resource Pack</h1>
                <p className="text-base md:text-lg text-carbon-700 font-medium max-w-xl">
                  All your sprint notes, links and references in one place.
                </p>
              </div>
              <div className="hidden sm:flex shrink-0">
                <Mascot size="lg" variant="working.png" className="bg-surface border border-border rounded-full p-2" />
              </div>
            </Card>
          </motion.div>

          {/* Directory: a mini file-explorer window */}
          <motion.section variants={rise} className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-carbon-900 flex items-center gap-2">
                <Icon name="folder-open" className="text-chrome" /> Resource Directory
              </h2>
              <p className="text-sm font-medium text-carbon-500">
                {folders.length} folder{folders.length === 1 ? "" : "s"} · {totalFiles} item{totalFiles === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-surface overflow-hidden shadow-card">
              {/* Title bar */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-chrome text-on-chrome">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-chrome-accent/90" />
                  <span className="size-2.5 rounded-full bg-chrome-accent/60" />
                  <span className="size-2.5 rounded-full bg-chrome-accent/30" />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg bg-chrome-hover/70 border border-chrome-border/60 px-3 py-1 text-xs font-semibold text-on-chrome-muted">
                  <Icon name="home-outline" className="text-sm shrink-0" />
                  <span className="truncate">Directory</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 md:p-6">
                {resourceError && (
                  <p role="alert" className="mb-4 rounded-xl border border-danger-600/30 bg-danger-100 px-4 py-3 text-sm text-danger-600">
                    {resourceError}
                  </p>
                )}

                {shown.length === 0 ? (
                  <div className="text-center py-10 text-carbon-500">
                    <Icon name="folder-open-outline" className="text-4xl mx-auto mb-2 text-rosewood" />
                    <p className="text-sm font-semibold">No folders yet</p>
                    <p className="text-xs mt-1">Open the directory to create your first note or folder.</p>
                  </div>
                ) : (
                  <motion.div
                    variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.06 } } }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-3 items-stretch"
                  >
                    {shown.map((f) => (
                      <motion.div
                        key={f.id}
                        variants={tile}
                        whileHover={reduce ? undefined : { y: -4 }}
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                        className="min-w-0"
                      >
                        <FolderTile
                          title={f.title}
                          count={f.children?.length ?? 0}
                          onClick={() => openFolder(f.id)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-surface-muted">
                <span className="text-xs font-semibold text-cocoa">
                  Showing {shown.length} of {folders.length}
                </span>
                <Link to="/resource-pack/notes">
                  <Button variant="outline" className="border gap-2">
                    Open directory <Icon name="arrow-forward" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.section>

          {/* Ask your Resources */}
          <motion.section variants={rise}>
            <div className="relative overflow-hidden rounded-3xl bg-chrome text-on-chrome px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 text-center md:text-left space-y-1.5">
                <h2 className="text-2xl font-extrabold">Ask your Resources</h2>
                <p className="text-sm md:text-base font-medium text-on-chrome-muted max-w-md">
                  Ask anything about your sprints, notes, and references.
                </p>
              </div>

              {/* Floating bubbles: the only looping motion on the page */}
              <div className="relative h-16 w-40 hidden sm:block" aria-hidden>
                {[0, 1].map((i) => (
                  <motion.span
                    key={i}
                    className={
                      i === 0
                        ? "absolute left-0 top-0 h-7 w-24 rounded-2xl rounded-bl-sm bg-chrome-hover border border-chrome-border"
                        : "absolute right-0 bottom-0 h-7 w-20 rounded-2xl rounded-br-sm bg-chrome-accent"
                    }
                    animate={reduce ? undefined : { y: [0, -5, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
                  />
                ))}
              </div>

              <motion.div whileHover={reduce ? undefined : { scale: 1.04 }} whileTap={reduce ? undefined : { scale: 0.97 }}>
                <Link
                  to="/resource-pack/chat"
                  className="inline-flex items-center gap-2 rounded-full bg-chrome-accent px-6 py-3 text-sm font-bold text-expresso shadow-pop"
                >
                  <Icon name="chatbubbles-outline" /> Go to Chat
                </Link>
              </motion.div>
            </div>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}