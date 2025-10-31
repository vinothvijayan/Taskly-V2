import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Plan } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, ClipboardList, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';

const getPublicPlanData = httpsCallable(functions, 'getPublicPlanData');

export default function PublicPlanPage() {
  const { teamId, planId } = useParams<{ teamId: string; planId: string }>();
  const [plan, setPlan] = useState<Partial<Plan> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamId && planId) {
      getPublicPlanData({ teamId, planId })
        .then(result => {
          setPlan(result.data as Partial<Plan>);
        })
        .catch(err => {
          console.error("Error fetching public plan:", err);
          setError(err.message || "Could not load the requested plan.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [teamId, planId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 text-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading plan...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Plan Not Found</h2>
        <p className="text-muted-foreground mt-2">{error || "The link may be invalid or the plan may have been deleted."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Plan</h1>
            <p className="text-sm text-muted-foreground">Shared via Taskly</p>
          </div>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{plan.title}</CardTitle>
                {plan.shortDescription && (
                  <CardDescription className="mt-2">{plan.shortDescription}</CardDescription>
                )}
              </div>
              <Badge variant="outline" className="capitalize flex-shrink-0">{plan.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              {plan.description ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.description}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">No detailed proposal has been added to this plan.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <footer className="text-center mt-6 text-sm text-muted-foreground">
          <p>Plan created on {plan.createdAt ? format(new Date(plan.createdAt), 'PPP') : 'N/A'}</p>
          <a href="/" className="text-primary hover:underline mt-2 inline-block">
            Powered by Taskly
          </a>
        </footer>
      </div>
    </div>
  );
}