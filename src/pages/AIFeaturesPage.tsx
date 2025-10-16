"use client";

import MainLayout from "@/components/layout/MainLayout";

const AIFeaturesPage = () => {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-4xl font-bold mb-4">AI Features</h1>
        <p className="text-xl text-muted-foreground">
          This is where your "AI like Bolt" functionalities will live.
        </p>
        <p className="text-md text-muted-foreground mt-2">
          We'll build out specific AI-powered UI components here.
        </p>
      </div>
    </MainLayout>
  );
};

export default AIFeaturesPage;