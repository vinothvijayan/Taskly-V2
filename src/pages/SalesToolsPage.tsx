import { Wrench } from 'lucide-react';

const SalesToolsPage = () => {
  return (
    <div className="container max-w-7xl mx-auto p-6 flex flex-col items-center justify-center h-full">
      <div className="text-center space-y-4">
        <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Wrench className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Sales Tools</h1>
        <p className="text-muted-foreground">This page is a placeholder for future sales tools.</p>
      </div>
    </div>
  );
};

export default SalesToolsPage;