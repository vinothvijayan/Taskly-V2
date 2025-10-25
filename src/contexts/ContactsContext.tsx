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
            // 1. Get all valid call history entries from Firebase.
            const validHistory: (CallLog & { originalIndex: string })[] = contactData.callHistory 
              ? Object.entries(contactData.callHistory as Record<string, any>)
                  .map(([key, value]) => ({ 
                      ...(value as CallLog), 
                      originalIndex: key,
                      // CRITICAL FIX: Ensure duration is explicitly parsed as a number, defaulting to 0
                      duration: Number(value.duration) || 0 
                  }))
                  .filter(log => log.timestamp && typeof log.timestamp === 'string' && !isNaN(new Date(log.timestamp).getTime()))
              : [];

            if (validHistory.length === 0) {
              return {
                id: phone,
                name: contactData.name || 'N/A',
                phone: contactData.phoneNumber || phone,
                status: 'No History',
                lastContacted: new Date().toISOString(),
                callCount: contactData.callCount || 0,
                callHistory: [],
              };
            }

            // 2. Sort the history with the newest calls first. This is our final display order.
            const sortedNewestFirst = validHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // 3. The oldest call is now at the end of the array. Its index is used to identify the 'New Call'.
            const oldestCallIndex = sortedNewestFirst.length - 1;

            // 4. Map over the newest-first array to assign the correct 'type' to each call.
            const finalCallHistory: CallLog[] = sortedNewestFirst.map((log, index) => ({
                ...log,
                type: index === oldestCallIndex ? 'New Call' : 'Follow-up'
            }));

            // 5. The latest call is the first item in our sorted array.
            const latestCall = finalCallHistory[0];

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