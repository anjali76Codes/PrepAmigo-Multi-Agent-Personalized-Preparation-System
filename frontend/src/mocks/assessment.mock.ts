import { MOCK_SPRINT_DAYS } from "./interviewPlan.mock";

const DAY = MOCK_SPRINT_DAYS[0];
const NOW = "2026-10-04T12:25:58.680Z";

const q = (question: string, options: string[], correct_answer: string, explanation: string, difficulty = "medium") =>
    ({ question, options, correct_answer, explanation, difficulty, type: "mcq", is_attempted: false, user_answer: null, is_correct: null });

const c = (front: string, back: string, tags: string[]) =>
    ({ front, back, difficulty: "easy", category: "concept", tags, is_reviewed: false, confidence_level: null, last_reviewed_at: null });

export const MOCK_ASSESSMENTS = [{
    _id: "6ac245d6986397c55c1600ee", sprint_day_id: DAY._id,
    questions: [
        q("In payment gateway systems, which of the following best describes 'availability'?",
            ["The system's ability to handle traffic spikes without downtime", "The percentage of time the gateway is operational and reachable", "The speed at which transactions are processed", "The accuracy of transaction validation"],
            "B", "Availability is the proportion of time a system is operational and accessible (e.g. 99.9% uptime). It says nothing about performance under load or error rates.", "easy"),
        q("What is the primary purpose of health checks in L4 load balancing?",
            ["To inspect application-layer data for security threats", "To verify the operational status of backend servers at the transport layer", "To optimize SSL/TLS termination for HTTPS traffic", "To distribute traffic based on server response times"],
            "B", "L4 balancers work at the transport layer (TCP/UDP) and use health checks such as TCP connection tests to monitor server availability."),
        q("Which health check is most appropriate for an L7 load balancer handling payment transactions?",
            ["Sending a TCP SYN packet", "Performing an HTTP GET request to a /health endpoint", "Checking SSL certificate validity", "Measuring ICMP round-trip time"],
            "B", "L7 balancers understand HTTP, so a GET to /health validates application-specific readiness, which TCP-level checks cannot."),
        q("Which statement correctly compares L4 and L7 load balancing?",
            ["L4 balances on URL paths, L7 on IP addresses", "L7 enables content-based routing (e.g. /api/v1/payments), L4 uses IP/port", "L4 requires SSL termination, L7 does not", "L7 is faster but less scalable than L4"],
            "B", "L7 inspects application-layer data such as HTTP paths to route requests, while L4 only sees IP addresses and ports."),
    ],
    score: 0, attempted_questions: 0, correct_answers: 0, wrong_answers: 0, total_attempts: 0,
    is_completed: false, createdAt: NOW, updatedAt: NOW,
}];

export const MOCK_DECKS = [{
    _id: "6ac24db9677156ceaf6969b7", sprint_day_id: DAY._id,
    cards: [
        c("What is the key difference between availability and reliability for payment gateways?", "Availability measures uptime (e.g. 99.9% SLA), while reliability measures consistent correct behavior (e.g. successful transactions without errors).", ["availability", "reliability"]),
        c("What is the primary difference between L4 and L7 load balancing?", "L4 operates at the transport layer (TCP/UDP), while L7 operates at the application layer (HTTP/HTTPS).", ["load balancing", "L4", "L7"]),
        c("What is a common health check mechanism for L4 load balancing?", "TCP connection attempts to verify backend server availability.", ["health check", "L4"]),
        c("What is a common health check mechanism for L7 load balancing?", "HTTP GET requests to specific endpoints (e.g. /health) to verify server responsiveness.", ["health check", "L7"]),
        c("Why is health check configuration critical for payment gateways?", "It ensures only healthy backend servers receive traffic, preventing failed transactions and maintaining high availability.", ["health check", "payment gateways"]),
    ],
    reviewed_count: 0, total_attempts: 0, is_completed: false, createdAt: NOW, updatedAt: NOW,
}];

export type Assessment = (typeof MOCK_ASSESSMENTS)[number];
export type FlashcardDeck = (typeof MOCK_DECKS)[number];

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 250));

// INTEGRATION: replace with fetch(`${API}/assessments`) / fetch(`${API}/flashcards`)
export const getAssessments = () => wait(MOCK_ASSESSMENTS);
export const getFlashcardDecks = () => wait(MOCK_DECKS);
export const getDayTitle = (id: string) =>
    MOCK_SPRINT_DAYS.find((d) => d._id === id)?.topic_title ?? "Practice set";