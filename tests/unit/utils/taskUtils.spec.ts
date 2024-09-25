import { calculateTaskPercentage } from '../../../src/utils/taskUtils';

describe('calculateTaskPercentage', () => {
  const calculateTaskPercentageParams = {
    completedTasks: 26,
    totalTasks: 30,
    shouldReturn: 86,
  };

  it('should return the percentages rounded down, when provided with completed tasks and total tasks', () => {
    const newPercentages = calculateTaskPercentage(calculateTaskPercentageParams.completedTasks, calculateTaskPercentageParams.totalTasks);

    expect(newPercentages).toBe(calculateTaskPercentageParams.shouldReturn);
  });
});
