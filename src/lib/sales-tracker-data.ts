import { format, startOfDay } from 'date-fns';

export interface CallLog {
  originalIndex: string;
  type: 'New Call' | 'Follow-up';
  timestamp: string;
  duration: number; // in seconds
  feedback: 'Interested' | 'Not Interested' | 'Follow Up' | 'Callback' | 'Not Picked' | 'Send Details';
  message: string;
  spokenToName?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  callHistory: CallLog[];
  status: string;
  lastContacted: string;
  callCount: number;
}

export interface AnalyticsData {
  totalCalls: number;
  interested: number;
  totalDuration: number;
  avgDuration: number;
  tableData: Record<string, {
    interested: number;
    notInterested: number;
    followUp: number;
    callback: number;
    notPicked: number;
    sendDetails: number;
    totalCalls: number;
    duration: number;
  }>;
}

const initialDailyStats = () => ({
  interested: 0, notInterested: 0, followUp: 0, callback: 0, notPicked: 0, sendDetails: 0, totalCalls: 0, duration: 0
});

export const processAnalytics = (contacts: Contact[], filter: 'New Call' | 'Follow-up' | 'all'): AnalyticsData => {
  const tableData: AnalyticsData['tableData'] = {};
  let totalCalls = 0;
  let interested = 0;
  let totalDuration = 0;

  contacts.forEach(contact => {
    contact.callHistory.forEach(log => {
      if (filter !== 'all' && log.type !== filter) return;

      const dateStr = format(startOfDay(new Date(log.timestamp)), 'yyyy-MM-dd');
      if (!tableData[dateStr]) {
        tableData[dateStr] = initialDailyStats();
      }

      const dayStats = tableData[dateStr];
      dayStats.totalCalls += 1;
      dayStats.duration += log.duration;
      totalCalls += 1;
      totalDuration += log.duration;

      switch (log.feedback) {
        case 'Interested': dayStats.interested += 1; interested += 1; break;
        case 'Not Interested': dayStats.notInterested += 1; break;
        case 'Follow Up': dayStats.followUp += 1; break;
        case 'Callback': dayStats.callback += 1; break;
        case 'Not Picked': dayStats.notPicked += 1; break;
        case 'Send Details': dayStats.sendDetails += 1; break;
      }
    });
  });

  return {
    totalCalls,
    interested,
    totalDuration,
    avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
    tableData,
  };
};