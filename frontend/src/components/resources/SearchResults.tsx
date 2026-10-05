import { Icon } from "../ui/Icon";
import { FolderTile } from "./FolderIcon";
import { domainOf, type SearchHit } from "../../lib/resourceTree";

export function SearchResults({ hits, onFolder }: { hits: SearchHit[]; onFolder: (id: string) => void }) {
    if (!hits.length) return <div className="text-center py-10 text-navy-300">No results found.</div>;
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {hits.map(({ node, trail }) =>
                node.kind === "folder" ? (
                    <FolderTile key={node.id} title={node.title} count={node.children?.length ?? 0}
                        subtitle={trail.join(" / ")} onClick={() => onFolder(node.id)} />
                ) : (
                    <a key={node.id} href={node.url} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-lavender-100 transition-colors">
                        <Icon name={node.icon ?? "link"} className="text-6xl text-navy-500" />
                        <span className="text-xs font-semibold text-carbon-900 text-center line-clamp-2">{node.title}</span>
                        <span className="text-[11px] text-navy-300 text-center line-clamp-1">{trail.join(" / ")}</span>
                        {domainOf(node.url) && <span className="text-[11px] text-chrome">{domainOf(node.url)}</span>}
                    </a>
                )
            )}
        </div>
    );
}