import { FolderTile, FileTile } from "./FolderIcon";
import { Icon } from "../ui/Icon";
import { domainOf, type SearchHit, type TreeNode } from "../../lib/resourceTree";

export function SearchResults({
    hits,
    onFolder,
    onNote,
}: {
    hits: SearchHit[];
    onFolder: (id: string) => void;
    onNote: (node: TreeNode) => void;
}) {
    if (!hits.length) return <div className="text-center py-10 text-carbon-500">No results found.</div>;
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {hits.map(({ node, trail }) =>
                node.kind === "folder" ? (
                    <FolderTile key={node.id} title={node.title} count={node.children?.length ?? 0}
                        subtitle={trail.join(" / ")} onClick={() => onFolder(node.id)} />
                ) : node.isCustom ? (
                    <button key={node.id} onClick={() => onNote(node)}
                        className="group flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-colors hover:bg-lavender-100">
                        <Icon name={node.icon ?? "journal"} className="text-6xl text-navy-500 transition-transform group-hover:-translate-y-0.5" />
                        <span className="line-clamp-2 text-xs font-semibold text-carbon-900">{node.title}</span>
                        <span className="line-clamp-1 text-[11px] text-carbon-500">{trail.join(" / ")}</span>
                    </button>
                ) : (
                    <FileTile key={node.id} title={node.title} url={node.url} icon={node.icon}
                        subtitle={trail.join(" / ")} domain={domainOf(node.url)} />
                )
            )}
        </div>
    );
}