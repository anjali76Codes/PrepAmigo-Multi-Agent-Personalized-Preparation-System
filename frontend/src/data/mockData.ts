export const AGENTS = [
  { name: 'Company Research', role: 'Finds company-specific culture and stack.', out: 'Company X prefers React and AWS.' },
  { name: 'Job Intelligence', role: 'Analyzes the specific job description.', out: 'Role requires distributed systems knowledge.' },
  { name: 'Skill Gap', role: 'Compares your resume to the job.', out: 'Gap identified: High-scale database design.' },
  { name: 'Research', role: 'Gathers learning resources.', out: 'Found 5 highly-rated System Design articles.' },
  { name: 'Assessment', role: 'Generates quizzes and flashcards.', out: 'Created 15 flashcards for load balancing.' },
  { name: 'Planner', role: 'Builds and adjusts the roadmap.', out: 'Scheduled System Design for Day 3.' }
] as const;

export type AgentName = typeof AGENTS[number]['name'];

interface CompanyProfile {
  name: string;
  industry: string;
  description: string;
  culture: string[];
}

interface JobRequirement {
  id: string;
  category: 'technical' | 'soft' | 'domain';
  skill: string;
  importance: 'critical' | 'important' | 'nice-to-have';
}

interface InterviewPattern {
  round: string;
  focus: string;
  format: string;
}

export interface Skill {
  name: string;
  level: number; // 0-100
}

export interface SkillGap {
  id: string;
  skill: string;
  impactScore: number; // 0-100
  hoursAllocated: number;
}

interface ResourceItem {
  id: string;
  title: string;
  type: 'article' | 'docs' | 'video' | 'problem set';
  estimatedMinutes: number;
  whyThisOne: string;
  url: string;
}

interface ResourceGroup {
  purpose: 'Start here' | 'Go deeper' | 'Practice' | 'Interview-specific';
  items: ResourceItem[];
}

export interface ResourcePack {
  topic: string;
  groups: ResourceGroup[];
}

interface PracticeTask {
  id: string;
  type: 'quiz' | 'flashcard' | 'coding' | 'mock-interview';
  title: string;
  status: 'pending' | 'completed' | 'missed' | 'rescheduled';
}

export interface RoadmapDay {
  id?: string;
  dayNumber: number;
  topic: string;
  objective: string;
  objectives?: string[];
  estimatedMinutes: number;
  references: string[];
  rawReferences?: any[];
  practiceTask: PracticeTask | null;
  status: 'done' | 'today' | 'upcoming' | 'missed' | 'rescheduled';
  date: string;
}

export interface Sprint {
  id: string;
  title: string;
  focus: string;
  days: RoadmapDay[];
}

export interface Roadmap {
  sprints: Sprint[];
}

export interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  type: 'due' | 'reminder' | 'missed' | 'rescheduled';
  reason?: string;
  originalDate?: string;
}

export interface WeeklyQuiz {
  id: string;
  title: string;
  status: 'completed' | 'upcoming';
  score?: number;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardDeck {
  id: string;
  topic: string;
  dueForRevision: boolean;
  cards: Flashcard[];
}

export interface Assessment {
  id: string;
  type: 'coding' | 'mock-interview';
  title: string;
  status: 'pending' | 'completed';
  score?: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  unlockedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  unlocked: boolean;
  condition: string;
}

export interface Title {
  id: string;
  name: string;
}

export interface ProgressStats {
  xp: number;
  streak: number;
  level: number;
  badges: Badge[];
  titles: Title[];
  milestones: Milestone[];
  skillLevels: Skill[];
  learningVelocity: string;
}

export interface LearningContext {
  id: string;
  targetRole: string;
  companyInfo: CompanyProfile;
  jobRequirements: JobRequirement[];
  interviewPatterns: InterviewPattern[];
  candidateSkills: Skill[];
  resumeSummary: string;
  knowledgeGaps: SkillGap[];
  deadline: string;
  completedTopics: string[];
  resources: ResourcePack[];
  progress: ProgressStats;
  constraints: string[];
}

export interface Prep {
  id: string;
  title: string;
  durationDays: number;
  learningContext: LearningContext;
  roadmap: Roadmap;
  calendarEntries: CalendarEntry[];
  assessments: {
    quizzes: WeeklyQuiz[];
    flashcardDecks: FlashcardDeck[];
    tasks: Assessment[];
  };
  isActive: boolean;
}

export interface AgentEvent {
  id: string;
  agent: AgentName;
  action: string;
  timestamp: string;
  details?: string;
}

export interface Notification {
  id: string;
  type: 'reminder' | 'missed-task' | 'plan-update' | 'quiz-result' | 'streak-warning' | 'milestone-unlock' | 'daily-digest';
  title: string;
  message: string;
  timestamp: string;
  reason?: string;
  read: boolean;
}

// --------------------------------------------------------------------------
// SEED DATA
// --------------------------------------------------------------------------

export const mockPreps: Prep[] = [
  {
    id: 'prep-1',
    title: 'Software Engineer at Company X',
    durationDays: 45,
    isActive: true,
    learningContext: {
      id: 'lc-1',
      targetRole: 'Senior Frontend Engineer',
      companyInfo: {
        name: 'Company X',
        industry: 'Tech',
        description: 'Leading provider of cloud-based solutions.',
        culture: ['Fast-paced', 'Data-driven', 'Collaborative'],
      },
      jobRequirements: [
        { id: 'req-1', category: 'technical', skill: 'React', importance: 'critical' },
        { id: 'req-2', category: 'technical', skill: 'Node.js', importance: 'important' },
        { id: 'req-3', category: 'technical', skill: 'System Design', importance: 'critical' },
        { id: 'req-4', category: 'technical', skill: 'Data Structures & Algorithms', importance: 'critical' },
      ],
      interviewPatterns: [
        { round: 'Phone Screen', focus: 'Past experience & culture fit', format: '30m call' },
        { round: 'Technical 1', focus: 'DSA & problem solving', format: '45m coding' },
        { round: 'Technical 2', focus: 'System Design', format: '60m whiteboard' },
        { round: 'Onsite', focus: 'Deep dive, behavioral', format: '4 hours' },
      ],
      candidateSkills: [
        { name: 'React', level: 90 },
        { name: 'Node.js', level: 85 },
        { name: 'System Design', level: 40 },
        { name: 'DSA', level: 35 },
      ],
      resumeSummary: '5 years of frontend experience heavily focused on React and Node.js. Lacking formalized DSA and large-scale system design practice.',
      knowledgeGaps: [
        { id: 'gap-1', skill: 'System Design', impactScore: 90, hoursAllocated: 25 },
        { id: 'gap-2', skill: 'Data Structures (Graphs/Trees)', impactScore: 85, hoursAllocated: 20 },
      ],
      deadline: '2026-11-15T00:00:00Z',
      completedTopics: ['React Context API', 'Node Streams'],
      resources: [
        {
          topic: 'System Design',
          groups: [
            {
              purpose: 'Start here',
              items: [
                {
                  id: 'res-1',
                  title: 'System Design Primer',
                  type: 'article',
                  estimatedMinutes: 60,
                  whyThisOne: 'The best holistic overview of scalable architectures.',
                  url: '#'
                }
              ]
            }
          ]
        }
      ],
      progress: {
        xp: 1450,
        streak: 5,
        level: 3,
        badges: [
          { id: 'b-1', name: 'Consistent Learner', icon: 'flame', unlockedAt: '2026-09-20T00:00:00Z' }
        ],
        titles: [{ id: 't-1', name: 'Initiate' }],
        milestones: [
          { id: 'm-1', title: 'Complete 10 Mock Interviews', unlocked: false, condition: '10/10 mock interviews passed' }
        ],
        skillLevels: [
          { name: 'React', level: 92 },
          { name: 'System Design', level: 45 }
        ],
        learningVelocity: '1.2x (Above average)'
      },
      constraints: ['Only 2 hours available on weekdays', 'Weekends free'],
    },
    roadmap: {
      sprints: [
        {
          id: 'sprint-1',
          title: 'Foundation & DSA Basics',
          focus: 'Arrays, Strings, and Hashing',
          days: [
            {
              dayNumber: 1,
              topic: 'Arrays & Hashing',
              objective: 'Master Two Sum and grouping anagrams.',
              estimatedMinutes: 120,
              references: ['NeetCode Arrays', 'CTCI Chapter 1'],
              practiceTask: { id: 'pt-1', type: 'coding', title: 'Two Sum & Contains Duplicate', status: 'completed' },
              status: 'done',
              date: '2026-09-25T00:00:00Z'
            },
            {
              dayNumber: 2,
              topic: 'Two Pointers',
              objective: 'Solve problems involving shrinking windows.',
              estimatedMinutes: 120,
              references: ['LeetCode Two Pointers', 'Grokking Patterns'],
              practiceTask: { id: 'pt-2', type: 'coding', title: '3Sum & Container With Most Water', status: 'pending' },
              status: 'today',
              date: '2026-09-26T00:00:00Z'
            }
          ]
        },
        {
          id: 'sprint-2',
          title: 'Advanced DSA Reprioritized',
          focus: 'Trees & Graphs (Reprioritized due to low quiz score)',
          days: [
            {
              dayNumber: 8,
              topic: 'Graph Traversal',
              objective: 'BFS and DFS mastery.',
              estimatedMinutes: 150,
              references: ['CLRS Graphs', 'NeetCode Graphs'],
              practiceTask: { id: 'pt-8', type: 'coding', title: 'Number of Islands', status: 'pending' },
              status: 'upcoming',
              date: '2026-10-02T00:00:00Z'
            }
          ]
        }
      ]
    },
    calendarEntries: [
      { id: 'cal-1', title: 'Arrays Quiz Due', date: '2026-09-25T18:00:00Z', type: 'due' },
      { id: 'cal-2', title: 'Missed: System Design Reading', date: '2026-09-24T18:00:00Z', type: 'missed' },
      { id: 'cal-3', title: 'Rescheduled: Graph Traversal', date: '2026-10-02T18:00:00Z', type: 'rescheduled', reason: 'Needed more time on Trees', originalDate: '2026-10-01T18:00:00Z' },
    ],
    assessments: {
      quizzes: [
        { id: 'q-1', title: 'Week 1: DSA Basics', status: 'completed', score: 85 },
        { id: 'q-2', title: 'Week 2: Advanced DSA', status: 'upcoming' }
      ],
      flashcardDecks: [
        {
          id: 'fd-1',
          topic: 'System Design Concepts',
          dueForRevision: true,
          cards: [{ id: 'fc-1', front: 'CAP Theorem', back: 'Consistency, Availability, Partition Tolerance' }]
        }
      ],
      tasks: [
        { id: 'ta-1', type: 'mock-interview', title: 'Behavioral Mock', status: 'completed', score: 90 }
      ]
    }
  },
  {
    id: 'prep-2',
    title: 'Product Manager at Startup Y',
    durationDays: 30,
    isActive: false,
    learningContext: {
      id: 'lc-2',
      targetRole: 'Product Manager',
      companyInfo: {
        name: 'Startup Y',
        industry: 'FinTech',
        description: 'Disrupting personal finance.',
        culture: ['Agile', 'Customer-centric'],
      },
      jobRequirements: [
        { id: 'req-5', category: 'domain', skill: 'Product Strategy', importance: 'critical' },
      ],
      interviewPatterns: [],
      candidateSkills: [],
      resumeSummary: 'Experienced PM looking to pivot into FinTech.',
      knowledgeGaps: [],
      deadline: '2026-10-15T00:00:00Z',
      completedTopics: [],
      resources: [],
      progress: {
        xp: 300,
        streak: 1,
        level: 1,
        badges: [],
        titles: [],
        milestones: [],
        skillLevels: [],
        learningVelocity: '1.0x (Average)'
      },
      constraints: [],
    },
    roadmap: { sprints: [] },
    calendarEntries: [],
    assessments: { quizzes: [], flashcardDecks: [], tasks: [] }
  }
];

export const mockAgentEvents: AgentEvent[] = [
  { id: 'evt-1', agent: 'Planner', action: 'Reprioritized Sprint 2 based on poor DSA quiz score', timestamp: '2026-09-25T10:00:00Z' },
  { id: 'evt-2', agent: 'Company Research', action: 'Extracted 3 new interview patterns for Company X', timestamp: '2026-09-25T10:05:00Z' },
];

export const mockNotifications: Notification[] = [
  { id: 'notif-1', type: 'missed-task', title: 'Missed Task', message: 'You missed your System Design reading.', timestamp: '2026-09-25T09:00:00Z', read: false },
  { id: 'notif-2', type: 'plan-update', title: 'Plan Updated', message: 'Sprint 2 was adjusted to focus more on Trees & Graphs.', reason: 'Low score on recent assessment.', timestamp: '2026-09-25T10:01:00Z', read: false },
];
