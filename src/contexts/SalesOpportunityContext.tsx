import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, arrayUnion, writeBatch, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Opportunity, Note, Contact } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface SalesOpportunityContextType {
  opportunities: Opportunity[];
  loading: boolean;
  addOpportunity: (data: Omit<Opportunity, "id" | "teamId" | "createdBy" | "createdAt">) => Promise<void>;
  updateOpportunity: (id: string, data: Partial<Opportunity>) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;
  addNoteToOpportunity: (opportunityId: string, noteContent: string) => Promise<void>;
  addOpportunitiesFromContacts: (contacts: Contact[]) => Promise<void>;
}

const SalesOpportunityContext = createContext<SalesOpportunityContextType | undefined>(undefined);

export function SalesOpportunityProvider({ children }: { children: ReactNode }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !userProfile?.teamId) {
      setOpportunities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const opportunitiesQuery = query(
      collection(db, 'teams', userProfile.teamId, 'opportunities'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(opportunitiesQuery, (snapshot) => {
      const oppsList: Opportunity[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opportunity));
      setOpportunities(oppsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching opportunities:", error);
      toast({ title: "Error", description: "Could not load sales opportunities.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userProfile?.teamId, toast]);

  const addOpportunity = async (data: Omit<Opportunity, "id" | "teamId" | "createdBy" | "createdAt">) => {
    if (!user || !userProfile?.teamId) return;

    try {
      const newOpportunity = {
        ...data,
        teamId: userProfile.teamId,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        notes: [],
      };
      await addDoc(collection(db, 'teams', userProfile.teamId, 'opportunities'), newOpportunity);
      toast({ title: "Opportunity created!" });
    } catch (error) {
      console.error("Error adding opportunity:", error);
      toast({ title: "Error", description: "Could not create opportunity.", variant: "destructive" });
    }
  };

  const addOpportunitiesFromContacts = async (contacts: Contact[]) => {
    if (!user || !userProfile?.teamId || contacts.length === 0) return;

    try {
      const opportunitiesCollectionRef = collection(db, 'teams', userProfile.teamId, 'opportunities');
      const querySnapshot = await getDocs(opportunitiesCollectionRef);
      const existingOpportunities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opportunity));
      
      const openOpportunitiesMap = new Map(
        existingOpportunities
          .filter(opp => opp.stage !== 'Closed Won' && opp.stage !== 'Closed Lost')
          .map(opp => [opp.contact, opp])
      );

      const batch = writeBatch(db);
      let newCount = 0;
      let updatedCount = 0;

      contacts.forEach(contact => {
        const existingOpp = openOpportunitiesMap.get(contact.name);

        if (existingOpp) {
          // It exists, check if it needs updating
          const needsUpdate = existingOpp.title !== contact.name || existingOpp.phone !== contact.phone;
          if (needsUpdate) {
            const oppRef = doc(opportunitiesCollectionRef, existingOpp.id);
            batch.update(oppRef, { title: contact.name, phone: contact.phone });
            updatedCount++;
          }
        } else {
          // It doesn't exist, create it
          const newOppRef = doc(opportunitiesCollectionRef);
          const opportunityData: Omit<Opportunity, "id"> = {
            title: contact.name,
            contact: contact.name,
            phone: contact.phone,
            value: 0,
            closeDate: new Date().toISOString(),
            stage: 'Interested Lead' as const,
            teamId: userProfile.teamId!,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
            notes: [],
          };
          batch.set(newOppRef, opportunityData);
          newCount++;
        }
      });

      if (newCount === 0 && updatedCount === 0) {
        toast({ title: "Leads are up to date!", description: "No new 'Interested' contacts to sync." });
        return;
      }

      await batch.commit();
      
      let description = "";
      if (newCount > 0) description += `${newCount} new lead(s) added. `;
      if (updatedCount > 0) description += `${updatedCount} existing lead(s) updated.`;
      
      toast({ title: "Leads Synced Successfully!", description: description.trim() });

    } catch (error) {
      console.error("Error syncing opportunities from contacts:", error);
      toast({ title: "Error", description: "Could not sync new leads.", variant: "destructive" });
    }
  };

  const updateOpportunity = async (id: string, data: Partial<Opportunity>) => {
    if (!user || !userProfile?.teamId) return;

    const originalOpportunities = opportunities;
    const opportunityToUpdate = originalOpportunities.find(o => o.id === id);
    if (!opportunityToUpdate) return;

    const updatedOpportunity = { ...opportunityToUpdate, ...data };
    const newOpportunities = originalOpportunities.map(o => o.id === id ? updatedOpportunity : o);
    
    setOpportunities(newOpportunities);

    try {
      const oppRef = doc(db, 'teams', userProfile.teamId, 'opportunities', id);
      await updateDoc(oppRef, data);
    } catch (error) {
      console.error("Error updating opportunity:", error);
      toast({ title: "Update Failed", description: "Could not save changes. Reverting.", variant: "destructive" });
      setOpportunities(originalOpportunities);
    }
  };

  const deleteOpportunity = async (id: string) => {
    if (!user || !userProfile?.teamId) return;

    try {
      const oppRef = doc(db, 'teams', userProfile.teamId, 'opportunities', id);
      await deleteDoc(oppRef);
      toast({ title: "Opportunity deleted", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      toast({ title: "Error", description: "Could not delete opportunity.", variant: "destructive" });
    }
  };

  const addNoteToOpportunity = async (opportunityId: string, noteContent: string) => {
    if (!user || !userProfile?.teamId || !noteContent.trim()) return;

    const newNote: Note = {
      id: `note-${Date.now()}`,
      content: noteContent.trim(),
      authorId: user.uid,
      authorName: userProfile.displayName || user.email || "Unknown User",
      createdAt: new Date().toISOString(),
    };

    try {
      const oppRef = doc(db, 'teams', userProfile.teamId, 'opportunities', opportunityId);
      await updateDoc(oppRef, {
        notes: arrayUnion(newNote)
      });
    } catch (error) {
      console.error("Error adding note:", error);
      toast({ title: "Error", description: "Could not add note.", variant: "destructive" });
    }
  };

  const value = { opportunities, loading, addOpportunity, updateOpportunity, deleteOpportunity, addNoteToOpportunity, addOpportunitiesFromContacts };

  return (
    <SalesOpportunityContext.Provider value={value}>
      {children}
    </SalesOpportunityContext.Provider>
  );
}

export function useSalesOpportunity() {
  const context = useContext(SalesOpportunityContext);
  if (context === undefined) {
    throw new Error("useSalesOpportunity must be used within a SalesOpportunityProvider");
  }
  return context;
}