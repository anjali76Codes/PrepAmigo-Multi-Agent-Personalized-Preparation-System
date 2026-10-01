import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export interface ProblemItem {
  id: string;
  title: string;
  difficulty: 'Basic' | 'Core' | 'Pro';
  solved: boolean;
  bookmarked: boolean;
  platformUrl?: string;
  videoUrl?: string;
  articleUrl?: string;
  notes?: string;
}

export interface SubTopic {
  id: string;
  title: string;
  problems: ProblemItem[];
}

export interface RoadmapCategory {
  id: string;
  title: string;
  subtopics: SubTopic[];
}

const INITIAL_ROADMAP: RoadmapCategory[] = [
  {
    id: 'cat-1',
    title: 'Beginner Problems',
    subtopics: [
      {
        id: 'sub-1-1',
        title: 'Basics of Programming & Math',
        problems: [
          { id: 'p-1', title: 'Count Digits in a Number', difficulty: 'Basic', solved: true, bookmarked: false, notes: 'Use log10(n) + 1 for O(1) space.' },
          { id: 'p-2', title: 'Reverse a Number', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-3', title: 'Check for Palindrome', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-4', title: 'GCD or HCF Calculation', difficulty: 'Basic', solved: true, bookmarked: true },
          { id: 'p-5', title: 'Armstrong Numbers', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-6', title: 'Print all Divisors of a Number', difficulty: 'Basic', solved: false, bookmarked: false },
        ]
      },
      {
        id: 'sub-1-2',
        title: 'Patterns & Logic Building',
        problems: [
          { id: 'p-7', title: 'Rectangular Star Pattern', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-8', title: 'Right-Angled Triangle Pattern', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-9', title: 'Inverted Number Pyramid', difficulty: 'Basic', solved: false, bookmarked: false },
        ]
      }
    ]
  },
  {
    id: 'cat-2',
    title: 'Sorting',
    subtopics: [
      {
        id: 'sub-2-1',
        title: 'Algorithms',
        problems: [
          { id: 'p-10', title: 'Selection Sort', difficulty: 'Core', solved: true, bookmarked: false, notes: 'Find minimum element in unsorted array and swap.' },
          { id: 'p-11', title: 'Bubble Sort', difficulty: 'Core', solved: true, bookmarked: false, notes: 'Repeatedly swap adjacent elements if out of order.' },
          { id: 'p-12', title: 'Insertion Sorting', difficulty: 'Core', solved: true, bookmarked: false, notes: 'Build sorted array one item at a time.' },
          { id: 'p-13', title: 'Merge Sorting', difficulty: 'Core', solved: true, bookmarked: true, notes: 'Divide and conquer with O(N log N) guarantee.' },
          { id: 'p-14', title: 'Quick Sorting', difficulty: 'Core', solved: true, bookmarked: false, notes: 'Partitioning around pivot element.' },
          { id: 'p-15', title: 'Recursive Bubble Sort', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-16', title: 'Recursive Insertion Sort', difficulty: 'Core', solved: true, bookmarked: false },
        ]
      }
    ]
  },
  {
    id: 'cat-3',
    title: 'Arrays & Hashing',
    subtopics: [
      {
        id: 'sub-3-1',
        title: 'Easy Problems',
        problems: [
          { id: 'p-17', title: 'Largest Element in an Array', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-18', title: 'Second Largest Element Without Sorting', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-19', title: 'Check if Array is Sorted and Rotated', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-20', title: 'Remove Duplicates from Sorted Array', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-21', title: 'Left Rotate an Array by One', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-22', title: 'Move Zeros to End', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-23', title: 'Linear Search & Union of Two Sorted Arrays', difficulty: 'Basic', solved: true, bookmarked: false },
        ]
      },
      {
        id: 'sub-3-2',
        title: 'Medium Problems',
        problems: [
          { id: 'p-24', title: 'Two Sum Problem', difficulty: 'Core', solved: true, bookmarked: true, notes: 'Use hash map storing complement.' },
          { id: 'p-25', title: 'Sort an Array of 0s, 1s and 2s (Dutch National Flag)', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-26', title: 'Majority Element (> N/2 times - Moore Voting)', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-27', title: 'Maximum Subarray Sum (Kadane\'s Algorithm)', difficulty: 'Core', solved: true, bookmarked: true },
          { id: 'p-28', title: 'Best Time to Buy and Sell Stock', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-29', title: 'Rearrange Array Elements by Sign', difficulty: 'Core', solved: false, bookmarked: false },
          { id: 'p-30', title: 'Next Permutation', difficulty: 'Pro', solved: false, bookmarked: true },
        ]
      },
      {
        id: 'sub-3-3',
        title: 'Hard Problems',
        problems: [
          { id: 'p-31', title: 'Pascal\'s Triangle', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-32', title: 'Majority Element II (> N/3 times)', difficulty: 'Pro', solved: false, bookmarked: false },
          { id: 'p-33', title: '3-Sum Problem', difficulty: 'Pro', solved: true, bookmarked: true },
          { id: 'p-34', title: '4-Sum Problem', difficulty: 'Pro', solved: false, bookmarked: false },
          { id: 'p-35', title: 'Largest Subarray with 0 Sum', difficulty: 'Core', solved: true, bookmarked: false },
        ]
      }
    ]
  },
  {
    id: 'cat-4',
    title: 'Binary Search',
    subtopics: [
      {
        id: 'sub-4-1',
        title: 'BS on 1D Arrays',
        problems: [
          { id: 'p-36', title: 'Binary Search to Find X in Sorted Array', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-37', title: 'Implement Lower Bound and Upper Bound', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-38', title: 'Search Insert Position', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-39', title: 'Search in Rotated Sorted Array I', difficulty: 'Core', solved: true, bookmarked: true },
          { id: 'p-40', title: 'Find Minimum in Rotated Sorted Array', difficulty: 'Core', solved: false, bookmarked: false },
        ]
      },
      {
        id: 'sub-4-2',
        title: 'BS on Answers / Min-Max Patterns',
        problems: [
          { id: 'p-41', title: 'Find Square Root of a Number in log N', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-42', title: 'Koko Eating Bananas', difficulty: 'Core', solved: false, bookmarked: true },
          { id: 'p-43', title: 'Minimum Number of Days to Make m Bouquets', difficulty: 'Pro', solved: false, bookmarked: true, notes: 'Binary search on minimum and maximum days.' },
          { id: 'p-44', title: 'Aggressive Cows (Capacity to Ship Packages)', difficulty: 'Pro', solved: false, bookmarked: false },
          { id: 'p-45', title: 'Book Allocation Problem', difficulty: 'Pro', solved: false, bookmarked: true },
        ]
      }
    ]
  },
  {
    id: 'cat-5',
    title: 'Linked List',
    subtopics: [
      {
        id: 'sub-5-1',
        title: 'Singly & Doubly Linked List',
        problems: [
          { id: 'p-46', title: 'Introduction to Linked List & Traversal', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-47', title: 'Reverse a Linked List (Iterative & Recursive)', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-48', title: 'Middle of the Linked List (Tortoise & Hare)', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-49', title: 'Detect a Loop in Linked List', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-50', title: 'Find the Starting Point of Loop in LL', difficulty: 'Pro', solved: false, bookmarked: true },
          { id: 'p-51', title: 'Flattening of a Linked List', difficulty: 'Pro', solved: false, bookmarked: false },
        ]
      }
    ]
  },
  {
    id: 'cat-6',
    title: 'Trees & Binary Search Trees',
    subtopics: [
      {
        id: 'sub-6-1',
        title: 'Traversals & Properties',
        problems: [
          { id: 'p-52', title: 'Preorder, Inorder, and Postorder Traversal', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-53', title: 'Level Order Traversal / BFS of Binary Tree', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-54', title: 'Maximum Depth of Binary Tree', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-55', title: 'Check for Balanced Binary Tree', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-56', title: 'Diameter of Binary Tree', difficulty: 'Core', solved: false, bookmarked: false },
          { id: 'p-57', title: 'Lowest Common Ancestor in Binary Tree', difficulty: 'Pro', solved: false, bookmarked: true },
        ]
      }
    ]
  },
  {
    id: 'cat-7',
    title: 'Dynamic Programming',
    subtopics: [
      {
        id: 'sub-7-1',
        title: '1D DP & 2D Grid DP',
        problems: [
          { id: 'p-58', title: 'Climbing Stairs / Fibonacci with Memoization', difficulty: 'Basic', solved: true, bookmarked: false },
          { id: 'p-59', title: 'Frog Jump with K Distances', difficulty: 'Core', solved: true, bookmarked: false },
          { id: 'p-60', title: 'House Robber / Maximum Sum of Non-Adjacent Elements', difficulty: 'Core', solved: false, bookmarked: true },
          { id: 'p-61', title: 'Grid Unique Paths I & II', difficulty: 'Core', solved: false, bookmarked: false },
          { id: 'p-62', title: '0/1 Knapsack Problem', difficulty: 'Pro', solved: false, bookmarked: true },
          { id: 'p-63', title: 'Longest Common Subsequence (LCS)', difficulty: 'Pro', solved: false, bookmarked: false },
        ]
      }
    ]
  }
];

export function Roadmap() {
  const [roadmap, setRoadmap] = useState<RoadmapCategory[]>(INITIAL_ROADMAP);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'cat-1': false,
    'cat-2': true,
    'cat-3': false,
    'cat-4': false,
  });
  const [openSubtopics, setOpenSubtopics] = useState<Record<string, boolean>>({
    'sub-2-1': true,
    'sub-3-1': false,
    'sub-3-2': false,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Basic' | 'Core' | 'Pro'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Solved' | 'Unsolved' | 'Bookmarked'>('All');
  const [activeNotesProblem, setActiveNotesProblem] = useState<ProblemItem | null>(null);

  // Toggle Category Accordion
  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Toggle Subtopic Accordion
  const toggleSubtopic = (subId: string) => {
    setOpenSubtopics(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  // Toggle Problem Solved
  const toggleProblemSolved = (probId: string) => {
    setRoadmap(prev => prev.map(cat => ({
      ...cat,
      subtopics: cat.subtopics.map(sub => ({
        ...sub,
        problems: sub.problems.map(p => p.id === probId ? { ...p, solved: !p.solved } : p)
      }))
    })));
  };

  // Toggle Bookmark
  const toggleBookmark = (probId: string) => {
    setRoadmap(prev => prev.map(cat => ({
      ...cat,
      subtopics: cat.subtopics.map(sub => ({
        ...sub,
        problems: sub.problems.map(p => p.id === probId ? { ...p, bookmarked: !p.bookmarked } : p)
      }))
    })));
  };

  // Expand / Collapse All
  const handleToggleExpandAll = () => {
    const allOpen = Object.values(openCategories).every(Boolean);
    const newCatState: Record<string, boolean> = {};
    const newSubState: Record<string, boolean> = {};
    roadmap.forEach(cat => {
      newCatState[cat.id] = !allOpen;
      cat.subtopics.forEach(sub => {
        newSubState[sub.id] = !allOpen;
      });
    });
    setOpenCategories(newCatState);
    setOpenSubtopics(newSubState);
  };

  // Flattened problem statistics calculation
  const allProblems = useMemo(() => {
    return roadmap.flatMap(c => c.subtopics.flatMap(s => s.problems));
  }, [roadmap]);

  const totalCount = allProblems.length;
  const solvedCount = allProblems.filter(p => p.solved).length;
  const overallPercentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  const basicProblems = allProblems.filter(p => p.difficulty === 'Basic');
  const basicSolved = basicProblems.filter(p => p.solved).length;

  const coreProblems = allProblems.filter(p => p.difficulty === 'Core');
  const coreSolved = coreProblems.filter(p => p.solved).length;

  const proProblems = allProblems.filter(p => p.difficulty === 'Pro');
  const proSolved = proProblems.filter(p => p.solved).length;

  // Next unsolved problem
  const nextUnsolved = allProblems.find(p => !p.solved);

  // Filtered categories
  const filteredRoadmap = useMemo(() => {
    return roadmap.map(cat => {
      const filteredSubs = cat.subtopics.map(sub => {
        const filteredProbs = sub.problems.filter(p => {
          const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesDiff = difficultyFilter === 'All' || p.difficulty === difficultyFilter;
          const matchesStatus = 
            statusFilter === 'All' ? true :
            statusFilter === 'Solved' ? p.solved :
            statusFilter === 'Unsolved' ? !p.solved :
            p.bookmarked;

          return matchesSearch && matchesDiff && matchesStatus;
        });

        return { ...sub, problems: filteredProbs };
      }).filter(sub => sub.problems.length > 0);

      return { ...cat, subtopics: filteredSubs };
    }).filter(cat => cat.subtopics.length > 0);
  }, [roadmap, searchQuery, difficultyFilter, statusFilter]);

  const getDifficultyBadge = (diff: 'Basic' | 'Core' | 'Pro') => {
    switch (diff) {
      case 'Basic':
        return 'bg-navy-100 text-navy-800 border-navy-200';
      case 'Core':
        return 'bg-beige-100 text-beige-800 border-beige-200';
      case 'Pro':
        return 'bg-coral-100 text-coral-800 border-coral-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-carbon-400">
            <Link to="/dashboard" className="hover:text-carbon-900 transition-colors">Prep Hub</Link>
            <span>/</span>
            <span className="text-carbon-800">Striver's A2Z DSA Sheet</span>
          </div>

          {/* Top Header Card following Screenshot 2 */}
          <div className="bg-white border border-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col lg:flex-row justify-between items-start gap-8">
            
            {/* Left Header Description */}
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-carbon-900 tracking-tight">
                Striver's A2Z DSA Sheet
              </h1>
              <p className="text-sm md:text-base text-carbon-500 leading-relaxed">
                Learn data structures and algorithms in a clear sequence, from programming foundations to advanced problems. Build your coding interview skills through independent practice, better approaches, and regular revision.
              </p>

              <div className="flex items-center gap-4 text-xs font-semibold text-carbon-400">
                <span className="flex items-center gap-1.5 text-navy-700">
                  <span className="w-2 h-2 rounded-full bg-navy-700 inline-block animate-pulse" />
                  7,642 online
                </span>
                <span>•</span>
                <span>10,000 learners</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {nextUnsolved && (
                  <button 
                    onClick={() => {
                      const el = document.getElementById(`prob-${nextUnsolved.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                  >
                    <span>Up next : {nextUnsolved.title.slice(0, 24)}...</span>
                    <Icon name="arrow-down" className="text-xs" />
                  </button>
                )}

                <Link to="/dashboard/chat">
                  <button className="px-4 py-2 bg-navy-100 hover:bg-navy-100/80 text-navy-800 border border-navy-700/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                    <Icon name="sparkles" className="text-xs text-navy-700" />
                    <span>Plan with PrepAmigo →</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Overall Progress Card */}
            <div className="bg-bg/80 border border-border rounded-2xl p-5 md:p-6 w-full lg:w-96 shrink-0 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-carbon-500">
                <span>Overall Progress</span>
                <Icon name="ribbon" className="text-lg text-beige-500" />
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-extrabold text-carbon-900">{overallPercentage} %</span>
                <span className="text-xs font-bold text-carbon-400">{solvedCount} / {totalCount} problems solved</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <motion.div 
                  className="h-full bg-navy-900 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Sub-categories Progress Bars */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60 text-center">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-carbon-400">Basic</div>
                  <div className="text-xs font-extrabold text-carbon-800">{basicSolved} / {basicProblems.length}</div>
                  <div className="h-1 w-full bg-navy-700/20 rounded-full overflow-hidden">
                    <div className="h-full bg-navy-700 rounded-full" style={{ width: `${basicProblems.length ? (basicSolved / basicProblems.length) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-carbon-400">Core</div>
                  <div className="text-xs font-extrabold text-carbon-800">{coreSolved} / {coreProblems.length}</div>
                  <div className="h-1 w-full bg-beige-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-beige-500 rounded-full" style={{ width: `${coreProblems.length ? (coreSolved / coreProblems.length) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-carbon-400">Pro</div>
                  <div className="text-xs font-extrabold text-carbon-800">{proSolved} / {proProblems.length}</div>
                  <div className="h-1 w-full bg-coral-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-coral-500 rounded-full" style={{ width: `${proProblems.length ? (proSolved / proProblems.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Filter & Search Toolbar */}
          <div className="bg-white border border-border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-400 text-sm" />
              <input
                type="text"
                placeholder="Search problems, patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg border border-border rounded-xl text-xs text-carbon-900 placeholder:text-carbon-400 outline-none focus:border-navy-900 transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {/* Difficulty Dropdown / Pill */}
              <div className="flex items-center gap-1 bg-surface-muted/60 p-1 rounded-xl border border-border/60">
                {(['All', 'Basic', 'Core', 'Pro'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficultyFilter(d)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                      difficultyFilter === d
                        ? "bg-white text-carbon-900 shadow-xs"
                        : "text-carbon-500 hover:text-carbon-900"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-surface-muted/60 border border-border/60 rounded-xl text-xs font-bold text-carbon-700 outline-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Solved">Solved Only</option>
                <option value="Unsolved">Unsolved Only</option>
                <option value="Bookmarked">Bookmarked </option>
              </select>

              {/* Expand / Collapse All */}
              <button
                onClick={handleToggleExpandAll}
                className="p-2 border border-border rounded-xl text-carbon-600 hover:text-carbon-900 hover:bg-surface-muted transition-colors text-xs font-semibold flex items-center gap-1"
                title="Expand / Collapse All"
              >
                <Icon name="layers" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Hierarchical Roadmap Tree Accordion (following Screenshot 2) */}
          <div className="space-y-4">
            {filteredRoadmap.map((category) => {
              const catProblems = category.subtopics.flatMap(s => s.problems);
              const catSolved = catProblems.filter(p => p.solved).length;
              const catTotal = catProblems.length;
              const isOpen = openCategories[category.id] ?? false;

              return (
                <div key={category.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs">
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-bg/50 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name={isOpen ? "chevron-down" : "chevron-forward"}
                        className="text-base text-carbon-500 transition-transform"
                      />
                      <h3 className="text-base md:text-lg font-bold text-carbon-900">{category.title}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-carbon-400">{catSolved} / {catTotal}</span>
                      <div className="w-16 md:w-24 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-navy-900 rounded-full transition-all"
                          style={{ width: `${catTotal ? (catSolved / catTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category Content */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/60 bg-bg/20"
                      >
                        {category.subtopics.map((subtopic) => {
                          const subSolved = subtopic.problems.filter(p => p.solved).length;
                          const subTotal = subtopic.problems.length;
                          const isSubOpen = openSubtopics[subtopic.id] ?? true;

                          return (
                            <div key={subtopic.id} className="p-3 md:p-4 border-b border-border/40 last:border-b-0">
                              {/* Subtopic Header */}
                              <div
                                onClick={() => toggleSubtopic(subtopic.id)}
                                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white cursor-pointer select-none transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-chrome-accent" />
                                  <Icon
                                    name={isSubOpen ? "chevron-down" : "chevron-forward"}
                                    className="text-xs text-carbon-400"
                                  />
                                  <h4 className="text-sm font-bold text-carbon-800">{subtopic.title}</h4>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] font-bold text-carbon-400">{subSolved} / {subTotal}</span>
                                  <div className="w-12 h-1 rounded-full bg-surface-muted overflow-hidden">
                                    <div
                                      className="h-full bg-navy-700 rounded-full"
                                      style={{ width: `${subTotal ? (subSolved / subTotal) * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Problem Items List */}
                              {isSubOpen && (
                                <div className="mt-2 space-y-1.5 pl-3 md:pl-6 border-l-2 border-border/60 ml-3">
                                  {subtopic.problems.map((problem) => (
                                    <div
                                      key={problem.id}
                                      id={`prob-${problem.id}`}
                                      className={cn(
                                        "group flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-border/70 hover:border-navy-900/30 hover:shadow-xs transition-all",
                                        problem.solved && "bg-surface-muted/30 text-carbon-400"
                                      )}
                                    >
                                      {/* Checkbox & Problem Title */}
                                      <div className="flex items-center gap-3 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => toggleProblemSolved(problem.id)}
                                          className={cn(
                                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                                            problem.solved
                                              ? "bg-navy-900 border-navy-900 text-white"
                                              : "border-carbon-300 group-hover:border-navy-900 bg-white"
                                          )}
                                        >
                                          {problem.solved && <Icon name="checkmark" className="text-[10px] font-bold" />}
                                        </button>

                                        <span className={cn(
                                          "text-xs md:text-sm font-semibold text-carbon-900 truncate",
                                          problem.solved && "line-through text-carbon-400"
                                        )}>
                                          {problem.title}
                                        </span>

                                        <span className={cn(
                                          "px-2 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0",
                                          getDifficultyBadge(problem.difficulty)
                                        )}>
                                          {problem.difficulty}
                                        </span>
                                      </div>

                                      {/* Action Icons Right (Platform, Video, Notes, Bookmark, Solution) */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Notes Button */}
                                        <button
                                          onClick={() => setActiveNotesProblem(problem)}
                                          className={cn(
                                            "p-1.5 rounded-lg text-carbon-400 hover:text-carbon-900 hover:bg-surface-muted transition-colors",
                                            problem.notes && "text-beige-600 font-bold"
                                          )}
                                          title={problem.notes ? "View revision notes" : "Add note"}
                                        >
                                          <Icon name="document-text" className="text-sm" />
                                        </button>

                                        {/* Video Tutorial */}
                                        <a
                                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(problem.title + ' DSA')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-lg text-carbon-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                          title="Watch Video Solution"
                                        >
                                          <Icon name="play-circle" className="text-sm" />
                                        </a>

                                        {/* Code Link */}
                                        <a
                                          href={`https://leetcode.com/problemset/all/?search=${encodeURIComponent(problem.title)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-lg text-carbon-400 hover:text-navy-700 hover:bg-navy-100/60 transition-colors"
                                          title="Practice on LeetCode"
                                        >
                                          <Icon name="code-slash" className="text-sm" />
                                        </a>

                                        {/* Bookmark */}
                                        <button
                                          onClick={() => toggleBookmark(problem.id)}
                                          className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            problem.bookmarked 
                                              ? "text-sky-600 bg-sky-50" 
                                              : "text-carbon-300 hover:text-carbon-900 hover:bg-surface-muted"
                                          )}
                                          title={problem.bookmarked ? "Bookmarked" : "Bookmark problem"}
                                        >
                                          <Icon name="bookmark" className="text-sm" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Problem Notes Drawer / Modal */}
      <AnimatePresence>
        {activeNotesProblem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-border space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Icon name="document-text" className="text-beige-600 text-lg" />
                  <h3 className="font-bold text-base text-carbon-900">Problem Notes</h3>
                </div>
                <button 
                  onClick={() => setActiveNotesProblem(null)}
                  className="p-1 text-carbon-400 hover:text-carbon-900 rounded-lg"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-carbon-900">{activeNotesProblem.title}</h4>
                <span className={cn("inline-block px-2 py-0.5 text-[10px] font-bold rounded", getDifficultyBadge(activeNotesProblem.difficulty))}>
                  {activeNotesProblem.difficulty}
                </span>
              </div>

              <textarea
                defaultValue={activeNotesProblem.notes || ''}
                rows={4}
                placeholder="Write your personal notes, approach, time complexity, and gotchas here..."
                className="w-full p-3 bg-bg border border-border rounded-xl text-xs text-carbon-900 outline-none focus:border-navy-900 resize-none"
                id="problem-notes-input"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setActiveNotesProblem(null)}
                  className="px-4 py-2 text-xs font-semibold text-carbon-500 hover:text-carbon-900"
                >
                  Close
                </button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const val = (document.getElementById('problem-notes-input') as HTMLTextAreaElement)?.value;
                    setRoadmap(prev => prev.map(cat => ({
                      ...cat,
                      subtopics: cat.subtopics.map(sub => ({
                        ...sub,
                        problems: sub.problems.map(p => p.id === activeNotesProblem.id ? { ...p, notes: val } : p)
                      }))
                    })));
                    setActiveNotesProblem(null);
                  }}
                >
                  Save Notes
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
