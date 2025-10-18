import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"

// Skeleton for a single Task Card
const TaskCardSkeleton = () => (
  <Card className="min-h-[120px]">
    <div className="p-5 flex items-start gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  </Card>
)

// Skeleton for the Tasks Page
export const TasksPageSkeleton = () => {
  const isMobile = useIsMobile()
  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6">
      <div className="text-center space-y-2 mb-6">
        <Skeleton className="h-9 w-48 mx-auto" />
        <Skeleton className="h-5 w-64 mx-auto" />
      </div>
      {isMobile ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-3">
            <TaskCardSkeleton />
            <TaskCardSkeleton />
            <TaskCardSkeleton />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              <TaskCardSkeleton />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Skeleton for a Stat Card on the Dashboard
const StatCardSkeleton = () => (
  <Card className="shadow-elegant">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-12 w-12 rounded-lg" />
    </CardContent>
  </Card>
)

// Skeleton for the Dashboard Page
export const DashboardSkeleton = () => (
  <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-5 w-60" />
      </div>
      <Skeleton className="h-10 w-32 hidden md:block" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
    <Card className="shadow-elegant">
      <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
      <CardContent><Skeleton className="h-40 w-full" /></CardContent>
    </Card>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="shadow-elegant">
          <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="h-[500px] space-y-2">
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="shadow-elegant">
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="h-[600px]"><Skeleton className="h-full w-full" /></CardContent>
        </Card>
      </div>
    </div>
  </div>
)

// Skeleton for a single Contact List Item
export const ContactListItemSkeleton = () => (
  <div className="p-4 rounded-lg border bg-background flex items-center justify-between">
    <div>
      <Skeleton className="h-5 w-40 mb-2" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <Skeleton className="h-5 w-5" />
  </div>
);


// Skeleton for Sales Tracker Page
export const SalesTrackerSkeleton = () => (
  <div className="p-4 md:p-6 h-full flex flex-col">
    <div className="flex gap-2 mb-4">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-24" />
    </div>
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <ContactListItemSkeleton key={i} />
      ))}
    </div>
  </div>
)

// Skeleton for Meetly Page
export const MeetlyPageSkeleton = () => (
  <div className="container max-w-7xl mx-auto p-6 space-y-12">
    <div className="text-center space-y-6">
      <Skeleton className="h-20 w-20 rounded-3xl mx-auto" />
      <div>
        <Skeleton className="h-10 w-48 mx-auto mb-2" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="lg:col-span-2">
        <Skeleton className="h-[600px] rounded-2xl" />
      </div>
    </div>
  </div>
)

// Skeleton for Analytics Page
export const AnalyticsPageSkeleton = () => (
  <div className="container max-w-7xl mx-auto p-6 space-y-8">
    <Skeleton className="h-12 w-64 mb-4" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="h-80 rounded-2xl" />
      <div className="lg:col-span-2">
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
    <Skeleton className="h-48 w-full rounded-2xl" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  </div>
)

// Skeleton for Leaderboard
export const LeaderboardSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-12 rounded-full" />
        </div>
      ))}
    </CardContent>
  </Card>
);