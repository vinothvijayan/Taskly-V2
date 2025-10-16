import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Contact, processAnalytics, AnalyticsData } from "@/lib/sales-tracker-data";
import { BarChart3, Phone, TrendingUp, Clock, Users } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon: Icon, color }) => (
  <Card className="shadow-sm border-2">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <div className={`p-2 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
    </CardContent>
  </Card>
);

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

interface AnalyticsTabContentProps {
  data: AnalyticsData;
  onDateClick: (date: string) => void;
}

const AnalyticsTabContent: React.FC<AnalyticsTabContentProps> = ({ data, onDateClick }) => {
  const sortedDates = Object.keys(data.tableData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Calls" value={data.totalCalls.toString()} icon={Phone} color="text-blue-500" />
        <StatCard title="Interested" value={data.interested.toString()} subValue={`${data.totalCalls > 0 ? ((data.interested / data.totalCalls) * 100).toFixed(1) : 0}%`} icon={TrendingUp} color="text-green-500" />
        <StatCard title="Total Duration" value={formatDuration(data.totalDuration)} icon={Clock} color="text-purple-500" />
        <StatCard title="Avg Duration" value={`${Math.round(data.avgDuration / 60)}m ${data.avgDuration % 60}s`} icon={Users} color="text-orange-500" />
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Daily Call Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="text-center font-semibold">Interested</TableHead>
                  <TableHead className="text-center font-semibold">Not Interested</TableHead>
                  <TableHead className="text-center font-semibold">Follow Up</TableHead>
                  <TableHead className="text-center font-semibold">Send Details</TableHead>
                  <TableHead className="text-center font-semibold">Callback</TableHead>
                  <TableHead className="text-center font-semibold">Not Picked</TableHead>
                  <TableHead className="text-center font-bold">Total Calls</TableHead>
                  <TableHead className="text-right font-semibold">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDates.map(date => {
                  const stats = data.tableData[date];
                  return (
                    <TableRow key={date} onClick={() => onDateClick(date)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-md bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 font-medium">
                          {stats.interested}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-md bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 font-medium">
                          {stats.notInterested}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
                          {stats.followUp}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-medium">
                          {stats.sendDetails}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-md bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 font-medium">
                          {stats.callback}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-md bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 font-medium">
                          {stats.notPicked}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-lg">{stats.totalCalls}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatDuration(stats.duration)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface AnalyticsViewProps {
  contacts: Contact[];
  onDateClick: (date: string, filter: 'New Call' | 'Follow-up' | 'all') => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ contacts, onDateClick }) => {
  const newCallsData = processAnalytics(contacts, 'New Call');
  const followupCallsData = processAnalytics(contacts, 'Follow-up');
  const consolidatedData = processAnalytics(contacts, 'all');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Tabs defaultValue="new-calls" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid bg-muted p-1 h-auto">
          <TabsTrigger value="new-calls" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            New Calls
          </TabsTrigger>
          <TabsTrigger value="follow-up" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Follow-up Calls
          </TabsTrigger>
          <TabsTrigger value="consolidated" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Consolidated Report
          </TabsTrigger>
        </TabsList>
        <TabsContent value="new-calls">
          <AnalyticsTabContent data={newCallsData} onDateClick={(date) => onDateClick(date, 'New Call')} />
        </TabsContent>
        <TabsContent value="follow-up">
          <AnalyticsTabContent data={followupCallsData} onDateClick={(date) => onDateClick(date, 'Follow-up')} />
        </TabsContent>
        <TabsContent value="consolidated">
          <AnalyticsTabContent data={consolidatedData} onDateClick={(date) => onDateClick(date, 'all')} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};