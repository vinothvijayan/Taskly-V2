import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { Task } from '@/types';

interface DailyReportData {
  date: Date;
  completedTasks: Task[];
  completedSubtasks: Array<{
    subtask: any;
    parentTask: Task;
    completionPercentage: number;
  }>;
  totalTimeSpent: number;
}

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
};

export const exportDailyReportToPDF = (data: DailyReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Productivity Report', margin, yPos);
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(format(data.date, 'PPPP'), margin, yPos);
  yPos += 15;

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Summary', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const totalItems = data.completedTasks.length + data.completedSubtasks.length;
  const summaryData = [
    `Total Items Completed: ${totalItems}`,
    `Tasks Completed: ${data.completedTasks.length}`,
    `Subtasks Completed: ${data.completedSubtasks.length}`,
    `Total Focus Time: ${formatTime(data.totalTimeSpent)}`,
  ];

  summaryData.forEach(line => {
    doc.text(line, margin + 5, yPos);
    yPos += 7;
  });

  yPos += 8;

  if (data.completedTasks.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Completed Tasks', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    data.completedTasks.forEach((task, index) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${task.title}`, margin + 5, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);

      const details = [
        `   Priority: ${task.priority.toUpperCase()}`,
        task.timeSpent ? `   Time Spent: ${formatTime(task.timeSpent)}` : null,
      ].filter(Boolean) as string[];

      details.forEach(detail => {
        doc.text(detail, margin + 5, yPos);
        yPos += 5;
      });

      if (task.subtasks && task.subtasks.length > 0) {
        const completedSubtasks = task.subtasks.filter(s => s.isCompleted);
        if (completedSubtasks.length > 0) {
          doc.text(`   Subtasks (${completedSubtasks.length}/${task.subtasks.length}):`, margin + 5, yPos);
          yPos += 5;

          completedSubtasks.forEach(subtask => {
            if (yPos > pageHeight - 20) {
              doc.addPage();
              yPos = margin;
            }
            const subtaskText = subtask.timeSpent
              ? `     • ${subtask.title} (${formatTime(subtask.timeSpent)})`
              : `     • ${subtask.title}`;
            doc.text(subtaskText, margin + 5, yPos);
            yPos += 5;
          });
        }
      }

      doc.setTextColor(0, 0, 0);
      yPos += 3;
    });
  }

  if (data.completedSubtasks.length > 0) {
    yPos += 5;

    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Additional Completed Subtasks', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    data.completedSubtasks.forEach((item, index) => {
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${item.subtask.title}`, margin + 5, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);

      doc.text(`   Parent Task: ${item.parentTask.title}`, margin + 5, yPos);
      yPos += 5;

      doc.text(`   Parent Progress: ${item.completionPercentage}%`, margin + 5, yPos);
      yPos += 5;

      if (item.subtask.timeSpent) {
        doc.text(`   Time Spent: ${formatTime(item.subtask.timeSpent)}`, margin + 5, yPos);
        yPos += 5;
      }

      doc.setTextColor(0, 0, 0);
      yPos += 3;
    });
  }

  yPos += 10;
  if (yPos > pageHeight - 30) {
    doc.addPage();
    yPos = margin;
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on ${format(new Date(), 'PPpp')}`, margin, yPos);

  const fileName = `daily-report-${format(data.date, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};
