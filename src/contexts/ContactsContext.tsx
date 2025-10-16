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
            const callHistoryArray: CallLog[] = contactData.callHistory 
              ? Object.entries(contactData.callHistory as Record<string, any>)
                  .map(([key, value]) => ({ ...(value as object), originalIndex: key }))
                  .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((log: any, index: number, array: any[]) => ({
                    ...log,
                    type: index === array.length - 1 ? 'New Call' : 'Follow-up',
                  }))
              : [];

            const latestCall = callHistoryArray[0] || null;

            return {
              id: phone,
              name: contactData.name || 'N/A',
              phone: contactData.phoneNumber || phone,
              status: latestCall?.feedback || 'No History',
              lastContacted: latestCall?.timestamp || new Date().toISOString(),
              callCount: contactData.callCount || 0,
              callHistory: callHistoryArray,
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