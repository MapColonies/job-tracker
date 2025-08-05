/**
 * Calculate job completion percentage
 */
export const calculateJobPercentage = (completedTasks: number, totalTasks: number): number => {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const updatedPercentage = Math.trunc((completedTasks / totalTasks) * 100);
    return updatedPercentage;
};
