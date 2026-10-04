import type { Goal, Sprint, Task } from './newMockData';

// Retrieve all tasks for a sprint
export const getSprintTasks = (sprint: Sprint): Task[] => {
  const tasks: Task[] = [];
  sprint.levels.forEach(level => {
    level.days.forEach(day => {
      tasks.push(...day.tasks);
    });
  });
  return tasks;
};

// Retrieve all tasks for a goal
export const getGoalTasks = (goal: Goal): Task[] => {
  const tasks: Task[] = [];
  goal.sprints.forEach(sprint => {
    tasks.push(...getSprintTasks(sprint));
  });
  return tasks;
};

// Get progress percentage for a goal
export const getGoalProgressPct = (goal: Goal, completedTasks: Set<string>): number => {
  const allTasks = getGoalTasks(goal);
  if (allTasks.length === 0) return 0;
  const completedCount = allTasks.filter(t => completedTasks.has(t.id) || t.completed).length;
  return Math.round((completedCount / allTasks.length) * 100);
};

// Get total XP for a goal
export const getGoalTotalXP = (goal: Goal, completedTasks: Set<string>): number => {
  return getGoalTasks(goal).reduce((acc, task) => {
    if (completedTasks.has(task.id) || task.completed) return acc + task.xp;
    return acc;
  }, 0);
};

// Get days left for a goal
export const getDaysLeft = (goal: Goal): number => {
  const target = new Date(goal.targetDate);
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
};

// Get node states for a sprint based on level completion
export const getSprintNodeStates = (sprint: Sprint, completedTasks: Set<string>): ('completed' | 'current' | 'locked' | 'upcoming')[] => {
  const states: ('completed' | 'current' | 'locked' | 'upcoming')[] = [];
  let foundCurrent = false;

  sprint.levels.forEach((level, index) => {
    const levelTasks: Task[] = [];
    level.days.forEach(day => levelTasks.push(...day.tasks));

    if (levelTasks.length === 0) {
      states.push(foundCurrent ? 'upcoming' : 'completed');
      return;
    }

    const allCompleted = levelTasks.every(t => completedTasks.has(t.id) || t.completed);
    
    if (allCompleted) {
      states.push('completed');
    } else if (!foundCurrent) {
      states.push('current');
      foundCurrent = true;
    } else {
      // previous was current, so this is locked
      states.push(index > 0 && states[index - 1] === 'current' ? 'locked' : 'locked'); // simplify to just locked or upcoming
    }
  });

  // Make future nodes after current locked/upcoming
  // let's say immediate next is locked, rest are upcoming (or all locked)
  for(let i=0; i<states.length; i++) {
     if(states[i] === 'locked' && i > 0 && states[i-1] !== 'current') {
         states[i] = 'upcoming';
     }
  }

  return states;
};
