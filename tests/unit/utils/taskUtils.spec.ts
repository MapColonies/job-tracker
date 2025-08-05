import { calculateJobPercentage } from '../../../src/utils/jobUtils';

describe('calculateJobPercentage', () => {
  const calculateJobPercentageParams = {
    completedTasks: 26,
    totalTasks: 30,
    shouldReturn: 86,
  };

  it('should return the percentages rounded down, when provided with completed tasks and total tasks', () => {
    const newPercentages = calculateJobPercentage(calculateJobPercentageParams.completedTasks, calculateJobPercentageParams.totalTasks);

    expect(newPercentages).toBe(calculateJobPercentageParams.shouldReturn);
  });
});
