import { Task } from '@/types';
import { differenceInHours, isSameDay, startOfDay, subDays } from 'date-fns';

// --- Constants for Scoring Logic (Easy to tweak) ---
const TASK_WEIGHTS = {
  simple: 10,   // < 30 mins
  standard: 20, // 30 - 90 mins
  complex: 30,  // > 90 mins
};

const PRIORITY_MULTIPLIERS = {
  high: 1.5,
  medium: 1.0,
  low: 0.75,
};

const TIMELINESS_FACTORS = {
  earlyBird: 1.20,     // > 24 hours early (+20%)
  onTrack: 1.10,       // < 24 hours early (+10%)
  onTime: 1.0,         // On the due date
  slightlyLate: 0.75,  // < 24 hours late (-25%)
  delayed: 0.50,       // 1-3 days late (-50%)
  overdue: 0,          // > 3 days late (-100%)
};

const STREAK_MULTIPLIERS = {
  warmUp: 1.05,  // 2-3 days
  inTheZone: 1.10, // 4-6 days
  onFire: 1.20,    // 7+ days
};

// --- Helper Functions ---

const getTaskWeight = (task: Task): number => {
  const time = task.estimatedTime || 25; // Default to 25 mins if not set
  if (time < 30) return TASK_WEIGHTS.simple;
  if (time <= 90) return TASK_WEIGHTS.standard;
  return TASK_WEIGHTS.complex;
};

const getPriorityMultiplier = (task: Task): number => {
  return PRIORITY_MULTIPLIERS[task.priority] || 1.0;
};

const getTimelinessFactor = (task: Task): number => {
  if (!task.dueDate || !task.completedAt) {
    return TIMELINESS_FACTORS.onTime; // No due date means no penalty or bonus
  }
  const dueDate = new Date(task.dueDate);
  const completedDate = new Date(task.completedAt as string);
  const hoursDiff = differenceInHours(dueDate, completedDate);

  if (hoursDiff > 24) return TIMELINESS_FACTORS.earlyBird;
  if (hoursDiff >= 0) return TIMELINESS_FACTORS.onTrack;
  if (hoursDiff > -24) return TIMELINESS_FACTORS.slightlyLate;
  if (hoursDiff > -72) return TIMELINESS_FACTORS.delayed;
  return TIMELINESS_FACTORS.overdue;
};

/**
 * Calculates the final score for a single completed task.
 */
export const calculateTaskScore = (task: Task): number => {
  if (task.status !== 'completed') return 0;

  const baseScore = getTaskWeight(task) * getPriorityMultiplier(task);
  const finalScore = baseScore * getTimelinessFactor(task);

  // Handle subtask progress if the main task is completed
  const subtaskCount = task.subtasks?.length || 0;
  if (subtaskCount > 0) {
    const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
    const completionRatio = completedSubtasks / subtaskCount;
    // Give full points only if all subtasks are done, otherwise proportional
    return finalScore * completionRatio;
  }

  return finalScore;
};

/**
 * Calculates the user's continuous daily streak ending on a specific date.
 */
export const calculateDailyStreak = (allUserCompletedTasks: Task[], forDate: Date): number => {
  if (allUserCompletedTasks.length === 0) return 0;

  const completedDays = new Set(
    allUserCompletedTasks.map(task => startOfDay(new Date(task.completedAt as string)).getTime())
  );

  let streak = 0;
  let currentDate = startOfDay(forDate);

  while (completedDays.has(currentDate.getTime())) {
    streak++;
    currentDate = subDays(currentDate, 1);
  }

  return streak;
};

const getStreakMultiplier = (streak: number): number => {
  if (streak >= 7) return STREAK_MULTIPLIERS.onFire;
  if (streak >= 4) return STREAK_MULTIPLIERS.inTheZone;
  if (streak >= 2) return STREAK_MULTIPLIERS.warmUp;
  return 1.0;
};

/**
 * Calculates the total performance score for a user over a given period,
 * including daily streak bonuses.
 */
export const calculateUserScoreForPeriod = (
  allUserTasks: Task[],
  startDate: Date,
  endDate: Date
): number => {
  const allUserCompletedTasks = allUserTasks.filter(t => t.status === 'completed' && t.completedAt);

  const tasksInPeriod = allUserCompletedTasks.filter(task => {
    const completedDate = new Date(task.completedAt as string);
    return completedDate >= startDate && completedDate <= endDate;
  });

  // Group tasks by completion day
  const tasksByDay: { [key: string]: Task[] } = {};
  tasksInPeriod.forEach(task => {
    const day = startOfDay(new Date(task.completedAt as string)).toISOString();
    if (!tasksByDay[day]) {
      tasksByDay[day] = [];
    }
    tasksByDay[day].push(task);
  });

  let totalScore = 0;

  // Calculate score for each day and apply streak bonus
  for (const dayString in tasksByDay) {
    const day = new Date(dayString);
    const dailyTasks = tasksByDay[dayString];
    
    const dailyBaseScore = dailyTasks.reduce((sum, task) => sum + calculateTaskScore(task), 0);
    
    const streakOnThatDay = calculateDailyStreak(allUserCompletedTasks, day);
    const multiplier = getStreakMultiplier(streakOnThatDay);
    
    totalScore += dailyBaseScore * multiplier;
  }

  return Math.round(totalScore);
};