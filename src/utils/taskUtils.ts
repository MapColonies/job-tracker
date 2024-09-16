export const calculateTaskPercentage = (completedTasks: number, totalTasks: number): number => {
  const updatedPercentage = Math.trunc((completedTasks / totalTasks) * 100);
  return updatedPercentage;
};
