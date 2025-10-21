"use client";

import MainLayout from "@/components/layout/MainLayout";

const SettingsPage = () => {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-4xl font-bold mb-4">Settings</h1>
        <p className="text-xl text-muted-foreground">
          Manage your application settings here.
        </p>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;