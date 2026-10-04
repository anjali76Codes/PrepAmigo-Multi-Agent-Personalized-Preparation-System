export type Status = 'pending' | 'in_progress' | 'completed';

export interface IPlan {
  _id: string; user_id: string; plan_name: string; company: string; role: string;
  total_days: number; start_date: string; end_date: string; sprints: string[];
  completion_percent: number; status: Status; createdAt: string; updatedAt: string;
}
export interface ISprint {
  _id: string; plan_id: string; sprint_number: number; sprint_name: string;
  start_date: string; end_date: string; total_days: number; sprint_days: string[];
  completion_percent: number; status: Status; createdAt: string; updatedAt: string;
}
export interface ISprintDay {
  _id: string; sprint_id: string; day_number: number; scheduled_date: string;
  topic_title: string; topic_description: string; objectives: string[];
  estimated_minutes: number; references: { title: string; url: string }[];
  status: Status; completed_at: string | null; assessment_id?: string; flashcard_id?: string;
  createdAt: string; updatedAt: string;
}

const DONE = 5; // days already completed (set 0 for a fresh plan)
const START = Date.UTC(2026, 9, 4);
const NOW = '2026-10-04T07:48:41.730Z';
const iso = (d: number) => new Date(START + d * 864e5).toISOString();
const oid = (n: number) => n.toString(16).padStart(24, '0');
const pct = (done: number, total: number) => Math.round((done / total) * 100);
const st = (done: number, total: number): Status =>
  done === 0 ? 'pending' : done === total ? 'completed' : 'in_progress';

export const MOCK_USER_ID = '6ac1da4db66653e9348733a3';
const PLAN_ID = oid(0x1);

const SPRINTS: { name: string; topics: [string, string][] }[] = [
  { name: 'Data Structures & Algorithms', topics: [
    ['Arrays & Two Pointers', 'Solve in-place array problems using two pointers and sliding windows.'],
    ['Hash Maps & Sets', 'Use hashing for lookups, counting, and de-duplication in O(1).'],
    ['Strings & Parsing', 'Handle string manipulation and parsing, common in payment-data questions.'],
    ['Linked Lists', 'Master reversal, cycle detection, and merge patterns.'],
    ['Stacks & Queues', 'Apply monotonic stacks and queues to interval and parsing problems.'],
    ['Binary Search', 'Search over arrays and answer spaces, including rotated inputs.'],
    ['Trees & BST', 'Traverse trees recursively and iteratively; validate and build BSTs.'],
    ['Heaps & Top-K', 'Use priority queues for top-K, merge-K, and scheduling problems.'],
    ['Graphs: BFS/DFS', 'Model problems as graphs and traverse them to find paths and components.'],
    ['Topological Sort', 'Order tasks with dependencies and detect cycles.'],
    ['Recursion & Backtracking', 'Generate subsets, permutations, and constrained combinations.'],
    ['Dynamic Programming I', 'Identify overlapping subproblems; 1D DP and knapsack variants.'],
    ['Dynamic Programming II', 'Tackle 2D DP: grids, edit distance, and subsequences.'],
    ['Intervals & Greedy', 'Merge intervals and choose greedy strategies with proofs.'],
    ['DSA Mock Round', 'Timed mock: two medium problems with verbal explanation.'] ] },
  { name: 'System Design', topics: [
    ['Availability & Load Balancing', 'Compare L4 vs L7 balancing and health checks for payment services.'],
    ['Databases: SQL vs NoSQL', 'Choose storage by access patterns, consistency, and scale.'],
    ['Indexing & Query Tuning', 'Design indexes and read query plans to fix slow queries.'],
    ['Caching Strategies', 'Apply cache-aside, write-through, and invalidation with Redis.'],
    ['Sharding & Replication', 'Partition data and replicate for scale and failover.'],
    ['Consistency & CAP', 'Reason about CAP, eventual consistency, and quorum reads/writes.'],
    ['Message Queues & Kafka', 'Decouple services with queues; delivery guarantees and ordering.'],
    ['Idempotency & Retries', 'Make payment APIs safe to retry with idempotency keys.'],
    ['API Design & Rate Limiting', 'Design REST APIs with pagination, versioning, and rate limiters.'],
    ['Distributed Transactions', 'Compare 2PC, sagas, and outbox patterns for money movement.'],
    ['Microservices & Resilience', 'Use circuit breakers, timeouts, and bulkheads.'],
    ['Observability', 'Plan logging, metrics, tracing, and alerting for reliability.'],
    ['Design: Payment Gateway', 'End-to-end design of a payment processing system.'],
    ['Design: Ledger & Webhooks', 'Design a double-entry ledger and reliable webhook delivery.'],
    ['System Design Mock', 'Timed 45-minute mock with requirements, capacity, and trade-offs.'] ] },
  { name: 'Behavioral & Final Prep', topics: [
    ['STAR Method Basics', 'Structure answers with Situation, Task, Action, Result.'],
    ['Leadership Stories', 'Prepare stories showing ownership and influence without authority.'],
    ['Conflict & Feedback', 'Answer disagreements and feedback questions with maturity.'],
    ['Failure & Learning', 'Tell failure stories that show reflection and growth.'],
    ['Why Stripe', 'Research the product, culture, and values; craft a sharp "why us".'],
    ['Stripe Product Deep Dive', 'Understand Payments, Billing, and Connect to discuss them fluently.'],
    ['Debugging Walkthrough', 'Practice narrating a production incident investigation.'],
    ['Code Review & Quality', 'Discuss testing, code review, and maintainability habits.'],
    ['Pair Programming Round', 'Practice thinking aloud while coding with an interviewer.'],
    ['Take-home & Bug Bash', 'Prepare for practical rounds: reading unfamiliar code and fixing bugs.'],
    ['Questions to Ask', 'Prepare thoughtful questions for interviewers and managers.'],
    ['Salary & Offer Negotiation', 'Understand comp structure and negotiate with data.'],
    ['Full Mock Loop I', 'Mock: one coding, one design, one behavioral round.'],
    ['Full Mock Loop II', 'Second full mock; review gaps from feedback.'],
    ['Final Review & Rest', 'Light revision of weak spots and logistics for the interview day.'] ] },
];

export const MOCK_SPRINT_DAYS: ISprintDay[] = [];
export const MOCK_SPRINTS: ISprint[] = [];

SPRINTS.forEach((s, si) => {
  const days = s.topics.map(([title, desc], ti): ISprintDay => {
    const g = si * 15 + ti; // global day index 0..44
    const status: Status = g < DONE ? 'completed' : g === DONE ? 'in_progress' : 'pending';
    return {
      _id: oid(0x1000 + g), sprint_id: oid(0x100 + si), day_number: ti + 1,
      scheduled_date: iso(g), topic_title: title, topic_description: desc,
      objectives: [`Explain the key ideas behind ${title}`, `Solve or design 2 practice questions on ${title}`],
      estimated_minutes: 90, references: [], status,
      completed_at: status === 'completed' ? iso(g) : null,
      assessment_id: oid(0x2000 + g), flashcard_id: oid(0x3000 + g),
      createdAt: NOW, updatedAt: NOW,
    };
  });
  const done = days.filter((d) => d.status === 'completed').length;
  MOCK_SPRING_PUSH(si, s.name, days, done);
});

function MOCK_SPRING_PUSH(si: number, name: string, days: ISprintDay[], done: number) {
  MOCK_SPRINT_DAYS.push(...days);
  MOCK_SPRINTS.push({
    _id: oid(0x100 + si), plan_id: PLAN_ID, sprint_number: si + 1, sprint_name: name,
    start_date: iso(si * 15), end_date: iso(si * 15 + 14), total_days: 15,
    sprint_days: days.map((d) => d._id), completion_percent: pct(done, 15),
    status: st(done, 15), createdAt: NOW, updatedAt: NOW,
  });
}

const totalDone = MOCK_SPRINT_DAYS.filter((d) => d.status === 'completed').length;

export const MOCK_PLAN: IPlan = {
  _id: PLAN_ID, user_id: MOCK_USER_ID,
  plan_name: 'Stripe Backend Engineer Preparation Plan', company: 'Stripe', role: 'Backend Engineer',
  total_days: 45, start_date: iso(0), end_date: iso(44), sprints: MOCK_SPRINTS.map((s) => s._id),
  completion_percent: pct(totalDone, 45), status: st(totalDone, 45), createdAt: NOW, updatedAt: NOW,
};
