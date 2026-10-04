import type { ResourceItem } from '../components/ui/DayTaskCard';

export const mockLevelData = {
  sprintId: "sprint-1",
  levelId: "level-1",
  title: "Foundations & Basics",
  progress: 40,
  days: [
    {
      id: "day-1",
      number: 1,
      date: "01/10/26",
      tasks: [
        {
          id: "task-1",
          title: "Read Chapter 1 of the guidebook",
          completed: true,
          resources: [
            { id: "r1", type: "Article", title: "Introduction to Basics", url: "#" },
            { id: "r2", type: "Video", title: "Welcome Video", url: "#" },
          ] as ResourceItem[]
        }
      ]
    },
    {
      id: "day-2",
      number: 2,
      date: "02/10/26",
      tasks: [
        {
          id: "task-2",
          title: "Complete the initial setup and configuration",
          completed: false,
          resources: [
            { id: "r3", type: "Link", title: "Setup Guide", url: "#" },
          ] as ResourceItem[]
        }
      ]
    }
  ]
};
