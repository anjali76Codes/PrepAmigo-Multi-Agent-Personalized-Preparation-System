import { folders, files } from "../data/mockNotes";
import type { Prep } from "../data/mockData";
import { buildSprintLevelNodes } from "./sprintLevels";
import type { CustomResourceItem } from "./customResources";

export type TreeNode = {
    id: string;
    title: string;
    kind: "folder" | "file";
    icon?: string;
    url?: string;
    content?: string;
    isCustom?: boolean;
    parentId?: string;
    children?: TreeNode[];
};

const file = (
    id: string,
    title: string,
    icon = "document-text",
    url = "#",
    content?: string,
    isCustom = false,
    parentId?: string
): TreeNode => ({ id, title, kind: "file", icon, url, content, isCustom, parentId });

const getResourceIcon = (type?: string) => {
    const lower = (type || "").toLowerCase();
    if (lower.includes("video") || lower.includes("youtube")) return "play-circle";
    if (lower.includes("book") || lower.includes("paper")) return "book";
    if (lower.includes("problem") || lower.includes("code")) return "code-slash";
    if (lower.includes("course")) return "school";
    return "document-text";
};

function buildCustomTreeNodes(parentId: string, allCustom: CustomResourceItem[]): TreeNode[] {
    const children = allCustom.filter((c) => c.parentId === parentId);
    return children.map((c) => {
        if (c.kind === "folder") {
            return {
                id: c.id,
                title: c.title,
                kind: "folder" as const,
                isCustom: true,
                parentId: c.parentId,
                children: buildCustomTreeNodes(c.id, allCustom),
            };
        }
        return file(c.id, c.title, c.icon || "document-text", c.url || "#", c.content, true, c.parentId);
    });
}

export function buildTree(prep?: Prep | null, customItems: CustomResourceItem[] = []): TreeNode[] {

    const prepNotesChildren = [
        file("pn-1", "System Design Cheat Sheets", "journal"),
        file("pn-2", "Behavioral Questions Bank", "journal"),
        file("pn-3", "Offer Negotiation Guide.pdf", "document"),
        ...buildCustomTreeNodes("prep-notes", customItems),
    ];

    const prepNotes: TreeNode = {
        id: "prep-notes",
        title: "Prep Notes",
        kind: "folder",
        children: prepNotesChildren,
    };

    const sprintsList = prep?.roadmap?.sprints || [];
    const sprints: TreeNode[] = sprintsList.map((s, sIdx) => {
        const days = s.days || [];
        const levels = buildSprintLevelNodes(days)
            .filter((level) => !level.isAssessment)
            .map((level) => {
                const lvlId = `lvl-${s.id}-${level.id}`;
                return {
                    id: lvlId,
                    title: level.title,
                    kind: "folder" as const,
                    children: [
                        ...level.days.map((d: any) => {
                            const dayId = d.id || d.dayNumber;
                            const taskId = `task-${dayId}`;
                            const objectives = d.objectives?.length ? d.objectives : [d.objective].filter(Boolean);
                            return {
                                id: taskId,
                                title: `Day ${d.dayNumber}: ${d.topic}`,
                                kind: "folder" as const,
                                children: [
                                    ...objectives.map((objective: string, index: number) =>
                                        file(`o-${dayId}-${index}`, objective, "journal")
                                    ),
                                    ...(d.rawReferences || []).map((reference: any, index: number) =>
                                        file(
                                            `r-${dayId}-${index}`,
                                            reference.title || reference.url,
                                            getResourceIcon(reference.type),
                                            reference.url,
                                        )
                                    ),
                                    ...buildCustomTreeNodes(taskId, customItems),
                                ],
                            };
                        }),
                        ...buildCustomTreeNodes(lvlId, customItems),
                    ],
                };
            });
        const sprintFolderId = `sprint-${s.id}`;
        return {
            id: sprintFolderId,
            title: s.title || `Sprint ${sIdx + 1}`,
            kind: "folder" as const,
            children: [
                ...levels,
                ...buildCustomTreeNodes(sprintFolderId, customItems),
            ],
        };
    });

    const notesChildren = [
        ...folders.map((f) => ({
            id: `nf-${f.id}`,
            title: f.name,
            kind: "folder" as const,
            children: buildCustomTreeNodes(`nf-${f.id}`, customItems),
        })),
        ...files.map((f) => file(`nfile-${f.id}`, f.name, f.type === "pdf" ? "document" : "document-text")),
        ...buildCustomTreeNodes("notes", customItems),
    ];

    const notes: TreeNode = {
        id: "notes",
        title: "Notes",
        kind: "folder",
        children: notesChildren,
    };

    const rootCustom = buildCustomTreeNodes("root", customItems);

    return [prepNotes, ...sprints, notes, ...rootCustom];
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