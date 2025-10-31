import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Plan } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface PlannerContextType {
  plans: Plan[];
  loading: boolean;
  addPlan: (data: Omit<Plan, "id" | "teamId" | "createdBy" | "createdAt">) => Promise<void>;
  updatePlan: (id: string, data: Partial<Plan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !userProfile?.teamId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const plansQuery = query(
      collection(db, 'teams', userProfile.teamId, 'plans'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(plansQuery, (snapshot) => {
      const plansList: Plan[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
      setPlans(plansList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching plans:", error);
      toast({ title: "Error", description: "Could not load team plans.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userProfile?.teamId, toast]);

  const addPlan = async (data: Omit<Plan, "id" | "teamId" | "createdBy" | "createdAt">) => {
    if (!user || !userProfile?.teamId) return;

    try {
      const newPlan = {
        ...data,
        teamId: userProfile.teamId,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'teams', userProfile.teamId, 'plans'), newPlan);
      toast({ title: "Plan created!" });
    } catch (error) {
      console.error("Error adding plan:", error);
      toast({ title: "Error", description: "Could not create plan.", variant: "destructive" });
    }
  };

  const updatePlan = async (id: string, data: Partial<Plan>) => {
    if (!user || !userProfile?.teamId) return;

    try {
      const planRef = doc(db, 'teams', userProfile.teamId, 'plans', id);
      await updateDoc(planRef, data);
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({ title: "Update Failed", description: "Could not save changes.", variant: "destructive" });
    }
  };

  const deletePlan = async (id: string) => {
    if (!user || !userProfile?.teamId) return;

    try {
      const planRef = doc(db, 'teams', userProfile.teamId, 'plans', id);
      await deleteDoc(planRef);
      toast({ title: "Plan deleted", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({ title: "Error", description: "Could not delete plan.", variant: "destructive" });
    }
  };

  const value = { plans, loading, addPlan, updatePlan, deletePlan };

  return (
    <PlannerContext.Provider value={value}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (context === undefined) {
    throw new Error("usePlanner must be used within a PlannerProvider");
  }
  return context;
}