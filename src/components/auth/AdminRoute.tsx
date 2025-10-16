import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoading } from "@/components/ui/loading-states";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <PageLoading />;
  }

  if (!userProfile || userProfile.role !== 'admin') {
    // Redirect non-admin users to the dashboard
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;