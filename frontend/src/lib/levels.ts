export type NodeState = "completed" | "current" | "locked";

/** done[i] = level i fully completed. First unfinished level is current, everything after it is locked. */
export function levelStates(done: boolean[]): NodeState[] {
    const first = done.findIndex((d) => !d);
    return done.map((_, i) => (first === -1 || i < first ? "completed" : i === first ? "current" : "locked"));
}