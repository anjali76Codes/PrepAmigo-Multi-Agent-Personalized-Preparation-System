// Data Model for the unified source of truth
export interface Resource {
  id: string;
  type: 'article' | 'video' | 'link' | 'note';
  title: string;
  url: string;
}

export interface Task {
  id: string;
  dayId: string;
  title: string;
  type: string;
  xp: number;
  completed: boolean;
  resources: Resource[];
}

export interface Day {
  id: string;
  levelId: string;
  dayNumber: number;
  date: string;
  tasks: Task[];
}

export interface Level {
  id: string;
  sprintId: string;
  title: string;
  topic: string;
  days: Day[];
}

export interface Sprint {
  id: string;
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  levels: Level[];
}

export interface Goal {
  id: string;
  title: string;
  startDate: string;
  targetDate: string;
  sprints: Sprint[];
}

// Seed data
export const unifiedGoal: Goal = {
  id: 'goal-1',
  title: 'Senior Frontend Engineer Interview',
  startDate: '2026-10-01',
  targetDate: '2026-11-15',
  sprints: [
    {
      id: 'sprint-1',
      title: 'Foundation & Basics',
      goal: 'Master the basics of React and DSA',
      startDate: '2026-10-01',
      endDate: '2026-10-14',
      levels: [
        {
          id: 'level-1',
          sprintId: 'sprint-1',
          title: 'React Fundamentals',
          topic: 'Hooks and Context',
          days: [
            {
              id: 'day-1',
              levelId: 'level-1',
              dayNumber: 1,
              date: '2026-10-01',
              tasks: [
                { id: 'task-1', dayId: 'day-1', title: 'Read about useState', type: 'reading', xp: 50, completed: true, resources: [{ id: 'res-1', type: 'article', title: 'React Docs', url: '#' }] }
              ]
            },
            {
              id: 'day-2',
              levelId: 'level-1',
              dayNumber: 2,
              date: '2026-10-02',
              tasks: [
                { id: 'task-2', dayId: 'day-2', title: 'Build a Counter App', type: 'coding', xp: 100, completed: true, resources: [] }
              ]
            },
            {
              id: 'day-3',
              levelId: 'level-1',
              dayNumber: 3,
              date: '2026-10-03',
              tasks: [
                { id: 'task-3', dayId: 'day-3', title: 'Context API practice', type: 'coding', xp: 100, completed: true, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-2',
          sprintId: 'sprint-1',
          title: 'Advanced React',
          topic: 'Performance & Architecture',
          days: [
            {
              id: 'day-4',
              levelId: 'level-2',
              dayNumber: 4,
              date: '2026-10-04',
              tasks: [
                { id: 'task-4', dayId: 'day-4', title: 'React.memo and useMemo', type: 'reading', xp: 50, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-5',
              levelId: 'level-2',
              dayNumber: 5,
              date: '2026-10-05',
              tasks: [
                { id: 'task-5', dayId: 'day-5', title: 'Optimize a list component', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-6',
              levelId: 'level-2',
              dayNumber: 6,
              date: '2026-10-06',
              tasks: [
                { id: 'task-6', dayId: 'day-6', title: 'Component architecture', type: 'video', xp: 50, completed: false, resources: [{ id: 'res-2', type: 'video', title: 'Architecture Patterns', url: '#' }] }
              ]
            }
          ]
        },
        {
          id: 'level-3',
          sprintId: 'sprint-1',
          title: 'DSA Basics',
          topic: 'Arrays and Strings',
          days: [
            {
              id: 'day-7',
              levelId: 'level-3',
              dayNumber: 7,
              date: '2026-10-07',
              tasks: [
                { id: 'task-7', dayId: 'day-7', title: 'Two Sum', type: 'coding', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-8',
              levelId: 'level-3',
              dayNumber: 8,
              date: '2026-10-08',
              tasks: [
                { id: 'task-8', dayId: 'day-8', title: 'Valid Anagram', type: 'coding', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-9',
              levelId: 'level-3',
              dayNumber: 9,
              date: '2026-10-09',
              tasks: [
                { id: 'task-9', dayId: 'day-9', title: 'Group Anagrams', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-4',
          sprintId: 'sprint-1',
          title: 'DSA Review',
          topic: 'Mixed Practice',
          days: [
            {
              id: 'day-10',
              levelId: 'level-4',
              dayNumber: 10,
              date: '2026-10-10',
              tasks: [
                { id: 'task-10', dayId: 'day-10', title: 'Mock Interview 1', type: 'mock-interview', xp: 200, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-11',
              levelId: 'level-4',
              dayNumber: 11,
              date: '2026-10-11',
              tasks: [
                { id: 'task-11', dayId: 'day-11', title: 'Review Mistakes', type: 'reading', xp: 50, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-12',
              levelId: 'level-4',
              dayNumber: 12,
              date: '2026-10-12',
              tasks: [
                { id: 'task-12', dayId: 'day-12', title: 'Rest day', type: 'reading', xp: 10, completed: false, resources: [] }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'sprint-2',
      title: 'Advanced DSA',
      goal: 'Trees, Graphs and DP',
      startDate: '2026-10-15',
      endDate: '2026-10-28',
      levels: [
        {
          id: 'level-5',
          sprintId: 'sprint-2',
          title: 'Trees',
          topic: 'BST and Traversal',
          days: [
            {
              id: 'day-13',
              levelId: 'level-5',
              dayNumber: 13,
              date: '2026-10-15',
              tasks: [
                { id: 'task-13', dayId: 'day-13', title: 'Invert Binary Tree', type: 'coding', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-14',
              levelId: 'level-5',
              dayNumber: 14,
              date: '2026-10-16',
              tasks: [
                { id: 'task-14', dayId: 'day-14', title: 'Maximum Depth', type: 'coding', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-15',
              levelId: 'level-5',
              dayNumber: 15,
              date: '2026-10-17',
              tasks: [
                { id: 'task-15', dayId: 'day-15', title: 'Same Tree', type: 'coding', xp: 100, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-6',
          sprintId: 'sprint-2',
          title: 'Graphs',
          topic: 'BFS and DFS',
          days: [
            {
              id: 'day-16',
              levelId: 'level-6',
              dayNumber: 16,
              date: '2026-10-18',
              tasks: [
                { id: 'task-16', dayId: 'day-16', title: 'Number of Islands', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-17',
              levelId: 'level-6',
              dayNumber: 17,
              date: '2026-10-19',
              tasks: [
                { id: 'task-17', dayId: 'day-17', title: 'Clone Graph', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-18',
              levelId: 'level-6',
              dayNumber: 18,
              date: '2026-10-20',
              tasks: [
                { id: 'task-18', dayId: 'day-18', title: 'Pacific Atlantic', type: 'coding', xp: 200, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-7',
          sprintId: 'sprint-2',
          title: 'Dynamic Programming',
          topic: '1D DP',
          days: [
            {
              id: 'day-19',
              levelId: 'level-7',
              dayNumber: 19,
              date: '2026-10-21',
              tasks: [
                { id: 'task-19', dayId: 'day-19', title: 'Climbing Stairs', type: 'coding', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-20',
              levelId: 'level-7',
              dayNumber: 20,
              date: '2026-10-22',
              tasks: [
                { id: 'task-20', dayId: 'day-20', title: 'House Robber', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-21',
              levelId: 'level-7',
              dayNumber: 21,
              date: '2026-10-23',
              tasks: [
                { id: 'task-21', dayId: 'day-21', title: 'Coin Change', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-8',
          sprintId: 'sprint-2',
          title: 'Advanced DP',
          topic: '2D DP',
          days: [
            {
              id: 'day-22',
              levelId: 'level-8',
              dayNumber: 22,
              date: '2026-10-24',
              tasks: [
                { id: 'task-22', dayId: 'day-22', title: 'Unique Paths', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-23',
              levelId: 'level-8',
              dayNumber: 23,
              date: '2026-10-25',
              tasks: [
                { id: 'task-23', dayId: 'day-23', title: 'Longest Common Subsequence', type: 'coding', xp: 200, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-24',
              levelId: 'level-8',
              dayNumber: 24,
              date: '2026-10-26',
              tasks: [
                { id: 'task-24', dayId: 'day-24', title: 'Edit Distance', type: 'coding', xp: 200, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-9',
          sprintId: 'sprint-2',
          title: 'Sprint Review',
          topic: 'Mock Interviews',
          days: [
            {
              id: 'day-25',
              levelId: 'level-9',
              dayNumber: 25,
              date: '2026-10-27',
              tasks: [
                { id: 'task-25', dayId: 'day-25', title: 'Mock Interview 2', type: 'mock-interview', xp: 200, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-26',
              levelId: 'level-9',
              dayNumber: 26,
              date: '2026-10-28',
              tasks: [
                { id: 'task-26', dayId: 'day-26', title: 'Review Mistakes', type: 'reading', xp: 50, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-27',
              levelId: 'level-9',
              dayNumber: 27,
              date: '2026-10-29',
              tasks: [
                { id: 'task-27', dayId: 'day-27', title: 'Rest day', type: 'reading', xp: 10, completed: false, resources: [] }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'sprint-3',
      title: 'System Design',
      goal: 'Scale and architecture',
      startDate: '2026-10-30',
      endDate: '2026-11-15',
      levels: [
        {
          id: 'level-10',
          sprintId: 'sprint-3',
          title: 'Basics',
          topic: 'Networking and Load Balancing',
          days: [
            {
              id: 'day-28',
              levelId: 'level-10',
              dayNumber: 28,
              date: '2026-10-30',
              tasks: [
                { id: 'task-28', dayId: 'day-28', title: 'Read about Load Balancing', type: 'reading', xp: 50, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-29',
              levelId: 'level-10',
              dayNumber: 29,
              date: '2026-10-31',
              tasks: [
                { id: 'task-29', dayId: 'day-29', title: 'Design a Load Balancer', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-30',
              levelId: 'level-10',
              dayNumber: 30,
              date: '2026-11-01',
              tasks: [
                { id: 'task-30', dayId: 'day-30', title: 'Consistent Hashing', type: 'video', xp: 100, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-11',
          sprintId: 'sprint-3',
          title: 'Databases',
          topic: 'SQL vs NoSQL',
          days: [
            {
              id: 'day-31',
              levelId: 'level-11',
              dayNumber: 31,
              date: '2026-11-02',
              tasks: [
                { id: 'task-31', dayId: 'day-31', title: 'CAP Theorem', type: 'reading', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-32',
              levelId: 'level-11',
              dayNumber: 32,
              date: '2026-11-03',
              tasks: [
                { id: 'task-32', dayId: 'day-32', title: 'Database Indexing', type: 'reading', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-33',
              levelId: 'level-11',
              dayNumber: 33,
              date: '2026-11-04',
              tasks: [
                { id: 'task-33', dayId: 'day-33', title: 'Sharding', type: 'video', xp: 100, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-12',
          sprintId: 'sprint-3',
          title: 'Caching',
          topic: 'Redis and Memcached',
          days: [
            {
              id: 'day-34',
              levelId: 'level-12',
              dayNumber: 34,
              date: '2026-11-05',
              tasks: [
                { id: 'task-34', dayId: 'day-34', title: 'Cache Eviction Policies', type: 'reading', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-35',
              levelId: 'level-12',
              dayNumber: 35,
              date: '2026-11-06',
              tasks: [
                { id: 'task-35', dayId: 'day-35', title: 'Distributed Caching', type: 'video', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-36',
              levelId: 'level-12',
              dayNumber: 36,
              date: '2026-11-07',
              tasks: [
                { id: 'task-36', dayId: 'day-36', title: 'Design Twitter Cache', type: 'coding', xp: 150, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-13',
          sprintId: 'sprint-3',
          title: 'Message Queues',
          topic: 'Kafka and RabbitMQ',
          days: [
            {
              id: 'day-37',
              levelId: 'level-13',
              dayNumber: 37,
              date: '2026-11-08',
              tasks: [
                { id: 'task-37', dayId: 'day-37', title: 'Pub/Sub model', type: 'reading', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-38',
              levelId: 'level-13',
              dayNumber: 38,
              date: '2026-11-09',
              tasks: [
                { id: 'task-38', dayId: 'day-38', title: 'Message Delivery Guarantees', type: 'video', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-39',
              levelId: 'level-13',
              dayNumber: 39,
              date: '2026-11-10',
              tasks: [
                { id: 'task-39', dayId: 'day-39', title: 'Design a Chat System', type: 'coding', xp: 200, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-14',
          sprintId: 'sprint-3',
          title: 'Microservices',
          topic: 'Architecture and Orchestration',
          days: [
            {
              id: 'day-40',
              levelId: 'level-14',
              dayNumber: 40,
              date: '2026-11-11',
              tasks: [
                { id: 'task-40', dayId: 'day-40', title: 'Monolith vs Microservices', type: 'reading', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-41',
              levelId: 'level-14',
              dayNumber: 41,
              date: '2026-11-12',
              tasks: [
                { id: 'task-41', dayId: 'day-41', title: 'API Gateways', type: 'reading', xp: 100, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-42',
              levelId: 'level-14',
              dayNumber: 42,
              date: '2026-11-13',
              tasks: [
                { id: 'task-42', dayId: 'day-42', title: 'Design Uber', type: 'coding', xp: 250, completed: false, resources: [] }
              ]
            }
          ]
        },
        {
          id: 'level-15',
          sprintId: 'sprint-3',
          title: 'Final Review',
          topic: 'Mock Interviews',
          days: [
            {
              id: 'day-43',
              levelId: 'level-15',
              dayNumber: 43,
              date: '2026-11-14',
              tasks: [
                { id: 'task-43', dayId: 'day-43', title: 'Full Mock Interview', type: 'mock-interview', xp: 300, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-44',
              levelId: 'level-15',
              dayNumber: 44,
              date: '2026-11-15',
              tasks: [
                { id: 'task-44', dayId: 'day-44', title: 'Rest and Prepare', type: 'reading', xp: 50, completed: false, resources: [] }
              ]
            },
            {
              id: 'day-45',
              levelId: 'level-15',
              dayNumber: 45,
              date: '2026-11-16',
              tasks: [
                { id: 'task-45', dayId: 'day-45', title: 'Interview Day', type: 'reading', xp: 0, completed: false, resources: [] }
              ]
            }
          ]
        }
      ]
    }
  ]
};
