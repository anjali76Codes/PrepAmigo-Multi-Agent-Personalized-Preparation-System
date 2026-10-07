export interface SprintLevelNode<T> {
  id: string;
  title: string;
  isAssessment: boolean;
  assessmentNumber?: number;
  assessmentDay?: T;
  days: T[];
}

export function buildSprintLevelNodes<T>(days: T[]): SprintLevelNode<T>[] {
  const nodes: SprintLevelNode<T>[] = [];
  const groups: {
    id: string;
    title: string;
    isAssessment: boolean;
    start: number;
    end: number;
    dayIndex?: number;
  }[] = [
    { id: "level", title: "Level", isAssessment: false, start: 0, end: 1 },
    { id: "level", title: "Level", isAssessment: false, start: 1, end: 3 },
    { id: "assessment", title: "Assessment", isAssessment: true, start: 0, end: 0, dayIndex: 2 },
    { id: "level", title: "Level", isAssessment: false, start: 3, end: 5 },
    { id: "level", title: "Level", isAssessment: false, start: 5, end: 7 },
    { id: "assessment", title: "Assessment", isAssessment: true, start: 0, end: 0, dayIndex: 6 },
  ];
  let levelNumber = 0;
  let assessmentNumber = 0;

  for (let offset = 0; offset < days.length; offset += 7) {
    const sprintDays = days.slice(offset, offset + 7);

    groups.forEach((group) => {
      if (group.isAssessment) {
        assessmentNumber += 1;
        nodes.push({
          id: `assessment-${assessmentNumber}`,
          title: `Q${assessmentNumber}`,
          isAssessment: true,
          assessmentNumber,
          assessmentDay: group.dayIndex === undefined ? undefined : sprintDays[group.dayIndex],
          days: [],
        });
        return;
      }

      const levelDays = sprintDays.slice(group.start, group.end);
      if (levelDays.length === 0) return;
      levelNumber += 1;
      nodes.push({
        id: `level-${levelNumber}`,
        title: `${group.title} ${levelNumber}`,
        isAssessment: false,
        days: levelDays,
      });
    });
  }

  return nodes;
}
