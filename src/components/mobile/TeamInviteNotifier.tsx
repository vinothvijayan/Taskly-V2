// src/components/mobile/TeamInviteNotifier.tsx

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface TeamInvite {
  id: string;
  teamName: string;
  inviterName: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date | string;
}

/**
 * A headless component that monitors for new team invites and sends 
 * local notifications to the user when they receive team invitations.
 */
export function TeamInviteNotifier() {
  const { user } = useAuth();
  const [notifiedInviteIds, setNotifiedInviteIds] = useState<Set<string>>(new Set());
  
  // This would connect to your actual team invite service/context
  const [invites, setInvites] = useState<TeamInvite[]>([]);

  useEffect(() => {
    const checkForNewInvites = async () => {
      // Guard clauses
      if (!Capacitor.isNativePlatform() || !user) {
        return;
      }

      // Check notification permissions
      const permissionStatus = await LocalNotifications.checkPermissions();
      if (permissionStatus.display !== 'granted') {
        console.log('Notification permission not granted, skipping team invite check.');
        return;
      }

      // Filter for new pending invites for the current user
      const newInvitesToNotify = invites.filter(invite => {
        const isForCurrentUser = invite.inviteeId === user.uid;
        const isPending = invite.status === 'pending';
        const isRecent = invite.createdAt && (Date.now() - new Date(invite.createdAt).getTime() < 300000); // Within last 5 minutes
        const hasNotBeenNotified = !notifiedInviteIds.has(invite.id);
        
        return isForCurrentUser && isPending && isRecent && hasNotBeenNotified;
      });

      if (newInvitesToNotify.length === 0) {
        return;
      }

      console.log(`Found ${newInvitesToNotify.length} new team invite(s) to notify about.`);

      // Prepare notifications
      const notifications = newInvitesToNotify.map(invite => ({
        id: Math.floor(Math.random() * 1000000),
        title: 'New Team Invitation',
        body: `${invite.inviterName} invited you to join "${invite.teamName}"`,
        schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
        channelId: 'app_main_channel',
        extra: {
          type: 'team_invite',
          inviteId: invite.id,
          teamName: invite.teamName,
          inviterId: invite.inviterId
        }
      }));

      try {
        await LocalNotifications.schedule({ notifications });
        
        setNotifiedInviteIds(prevIds => {
          const newIds = new Set(prevIds);
          newInvitesToNotify.forEach(invite => newIds.add(invite.id));
          return newIds;
        });

      } catch (error) {
        console.error('Failed to schedule team invite notifications:', error);
      }
    };

    checkForNewInvites();
  }, [invites, user, notifiedInviteIds]);

  // In a real implementation, you would subscribe to team invites here
  // For example, using Firebase real-time listeners
  useEffect(() => {
    if (!user) return;

    // TODO: Replace with actual team invite subscription
    // Example:
    // const unsubscribe = onSnapshot(
    //   query(invitesCollection, where('inviteeId', '==', user.uid)),
    //   (snapshot) => {
    //     const newInvites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    //     setInvites(newInvites);
    //   }
    // );
    // return unsubscribe;
  }, [user]);

  return null;
}