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
                  // Filter out any logs that might have a missing or invalid timestamp.
                  .filter(log => log.timestamp && typeof log.timestamp === 'string' && !isNaN(new Date(log.timestamp).getTime()))
              : [];

            // Sort once: oldest to newest to determine the "New Call"
            const sortedHistory = callHistoryWithOriginalIndex.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Assign types based on the sorted order
            const historyWithTypes = sortedHistory.map((log, index) => ({
                ...log,
                type: index === 0 ? 'New Call' : 'Follow-up' as 'New Call' | 'Follow-up'
            }));

            // Reverse the array for display (newest first)
            const finalCallHistory = historyWithTypes.reverse();

            const latestCall = finalCallHistory[0] || null; // The first item is now the newest

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