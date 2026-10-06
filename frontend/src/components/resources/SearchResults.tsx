import { FolderTile, FileTile } from "./FolderIcon";
import { domainOf, type SearchHit } from "../../lib/resourceTree";

export function SearchResults({ hits, onFolder }: { hits: SearchHit[]; onFolder: (id: string) => void }) {
    if (!hits.length) return <div className="text-center py-10 text-carbon-500">No results found.</div>;
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {hits.map(({ node, trail }) =>
                node.kind === "folder" ? (
                    <FolderTile key={node.id} title={node.title} count={node.children?.length ?? 0}
                        subtitle={trail.join(" / ")} onClick={() => onFolder(node.id)} />
                ) : (
                    <FileTile key={node.id} title={node.title} url={node.url} icon={node.icon}
                        subtitle={trail.join(" / ")} domain={domainOf(node.url)} />
                )
            )}
        </div>
    );
}