import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { useToast } from "@/hooks/use-toast";

interface ContactsContextType {
  contacts: Contact[];
  loading: boolean;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const contactsRef = ref(rtdb, 'contacts');

    const unsubscribe = onValue(contactsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const transformedContacts: Contact[] = Object.entries(data).map(([phone, contactData]: [string, any]) => {
            const callHistoryWithOriginalIndex: (CallLog & { originalIndex: string })[] = contactData.callHistory 
              ? Object.entries(contactData.callHistory as Record<string, any>)
                  .map(([key, value]) => ({ ...(value as CallLog), originalIndex: key }))
              : [];

            // Sort oldest to newest to find the first call
            const sortedOldestFirst = [...callHistoryWithOriginalIndex].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Create a map of originalIndex to type
            const typeMap = new Map<'New Call' | 'Follow-up'>();
            sortedOldestFirst.forEach((log, index) => {
                typeMap.set(log.originalIndex, index === 0 ? 'New Call' : 'Follow-up');
            });

            // Sort newest to oldest for display and finding the latest call
            const sortedNewestFirst = [...callHistoryWithOriginalIndex].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Add the type to the final, newest-first array
            const finalCallHistory: CallLog[] = sortedNewestFirst.map(log => ({
                ...log,
                type: typeMap.get(log.originalIndex) || 'Follow-up',
            }));

            const latestCall = finalCallHistory[0] || null;

            return {
              id: phone,
              name: contactData.name || 'N/A',
              phone: contactData.phoneNumber || phone,
              status: latestCall?.feedback || 'No History',
              lastContacted: latestCall?.timestamp || new Date().toISOString(),
              callCount: contactData.callCount || 0,
              callHistory: finalCallHistory,
            };
          });
          
          transformedContacts.sort((a, b) => new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime());
          setContacts(transformedContacts);
        } else {
          setContacts([]);
        }
      } catch (err) {
        console.error("Error transforming contact data:", err);
        toast({ title: "Error", description: "Failed to process contact data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Firebase read error:", err);
      toast({ title: "Error", description: "Failed to fetch contacts from Firebase.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const value = { contacts, loading };

  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (context === undefined) {
    throw new Error("useContacts must be used within a ContactsProvider");
  }
  return context;
}