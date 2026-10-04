import { folders, files } from "../data/mockNotes";
import { MOCK_SPRINTS, MOCK_SPRINT_DAYS } from "../mocks/interviewPlan.mock";

export type TreeNode = {
    id: string; title: string; kind: "folder" | "file";
    icon?: string; url?: string; children?: TreeNode[];
};

const file = (id: string, title: string, icon = "document-text", url = "#"): TreeNode =>
    ({ id, title, kind: "file", icon, url });

export function buildTree(): TreeNode[] {
    const prep: TreeNode = {
        id: "prep-notes", title: "Prep Notes", kind: "folder",
        children: [
            file("pn-1", "System Design Cheat Sheets", "journal"),
            file("pn-2", "Behavioral Questions Bank", "journal"),
            file("pn-3", "Offer Negotiation Guide.pdf", "document"),
        ],
    };

    const sprints: TreeNode[] = MOCK_SPRINTS.map((s) => {
        const days = MOCK_SPRINT_DAYS.filter((d) => d.sprint_id === s._id);
        const levels: TreeNode[] = [];
        for (let i = 0; i < days.length; i += 3) {
            levels.push({
                id: `lvl-${s._id}-${i}`, title: `Level ${i / 3 + 1}`, kind: "folder",
                children: days.slice(i, i + 3).map((d) => ({
                    id: `task-${d._id}`, title: `Day ${d.day_number}: ${d.topic_title}`, kind: "folder" as const,
                    children: [
                        ...d.objectives.map((o, k) => file(`o-${d._id}-${k}`, o, "journal")),
                        ...d.references.map((r, k) => file(`r-${d._id}-${k}`, r.title, "document-text", r.url)),
                        ...(d.references.length === 0
                            ? [file(`v-${d._id}`, `Watch ${d.topic_title} tutorial`, "play-circle", "https://youtube.com")]
                            : []),
                    ],
                })),
            });
        }
        return { id: `sprint-${s._id}`, title: `Sprint ${s.sprint_number}`, kind: "folder" as const, children: levels };
    });

    const notes: TreeNode = {
        id: "notes", title: "Notes", kind: "folder",
        children: [
            ...folders.map((f) => ({ id: `nf-${f.id}`, title: f.name, kind: "folder" as const, children: [] })),
            ...files.map((f) => file(`nfile-${f.id}`, f.name, f.type === "pdf" ? "document" : "document-text")),
        ],
    };

    return [prep, ...sprints, notes];
}

export const domainOf = (u?: string) => {
    try { return u && u !== "#" ? new URL(u).hostname.replace("www.", "") : ""; } catch { return ""; }
};

const hay = (n: TreeNode) => `${n.title} ${domainOf(n.url)}`.toLowerCase();

export function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
    if (!q) return nodes;
    return nodes.flatMap((n) => {
        if (hay(n).includes(q)) return [n];
        const kids = n.children ? filterTree(n.children, q) : [];
        return kids.length ? [{ ...n, children: kids }] : [];
    });
}

export type SearchHit = { node: TreeNode; trail: string[] };

/** Flat list of every node (any depth) whose own title/domain matches. */
export function searchTree(nodes: TreeNode[], q: string, trail: string[] = []): SearchHit[] {
    return nodes.flatMap((n) => [
        ...(hay(n).includes(q) ? [{ node: n, trail }] : []),
        ...(n.children ? searchTree(n.children, q, [...trail, n.title]) : []),
    ]);
}

export const allFolderIds = (nodes: TreeNode[]): string[] =>
    nodes.flatMap((n) => (n.children ? [n.id, ...allFolderIds(n.children)] : []));

export function pathToId(nodes: TreeNode[], id: string, trail: string[] = []): string[] | null {
    for (const n of nodes) {
        if (n.id === id) return [...trail, n.id];
        const r = n.children ? pathToId(n.children, id, [...trail, n.id]) : null;
        if (r) return r;
    }
    return null;
}

export function nodesAlong(nodes: TreeNode[], ids: string[]): TreeNode[] {
    const out: TreeNode[] = [];
    let level = nodes;
    for (const id of ids) {
        const n = level.find((x) => x.id === id);
        if (!n) break;
        out.push(n);
        level = n.children ?? [];
    }
    return out;
}