import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ChatNotificationMode, UserPresence } from '../types/workspace.ts';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client is offline — verify Firebase configuration.');
    }
    return false;
  }
}

void testFirestoreConnection();

export async function signInWithFirebaseGoogle(): Promise<{ idToken: string; email: string | null }> {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const idToken = await result.user.getIdToken(true);
  return { idToken, email: result.user.email };
}

export async function signInWithFirebaseEmail(
  email: string,
  password: string
): Promise<{ idToken: string; email: string | null }> {
  const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  const idToken = await result.user.getIdToken(true);
  return { idToken, email: result.user.email };
}

export async function sendFirebaseReset(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth, email.trim());
}

export async function signOutFirebase(): Promise<void> {
  if (firebaseAuth.currentUser) {
    await signOut(firebaseAuth);
  }
}

export async function syncFirebaseUserProfile(params: {
  displayName: string;
  title: string;
  presence: UserPresence;
  email: string;
  chatNotificationMode: ChatNotificationMode;
  notifyOnChannelAll: boolean;
  desktopAlerts: boolean;
  timezone: string;
}): Promise<void> {
  const current = firebaseAuth.currentUser;
  if (!current || !current.emailVerified) return;

  const uid = current.uid;
  const publicRef = doc(firestoreDb, 'users', uid, 'public', 'profile');
  const privateRef = doc(firestoreDb, 'users', uid, 'private', 'info');

  try {
    const pubSnap = await getDoc(publicRef);
    if (!pubSnap.exists()) {
      await setDoc(publicRef, {
        uid,
        displayName: params.displayName.slice(0, 80),
        title: (params.title || 'Engineer').slice(0, 80),
        presence: params.presence,
        authProvider: 'firebase',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(publicRef, {
        displayName: params.displayName.slice(0, 80),
        title: (params.title || 'Engineer').slice(0, 80),
        presence: params.presence,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/public/profile`);
  }

  try {
    const privSnap = await getDoc(privateRef);
    if (!privSnap.exists()) {
      await setDoc(privateRef, {
        uid,
        email: params.email.slice(0, 160),
        chatNotificationMode: params.chatNotificationMode,
        notifyOnChannelAll: params.notifyOnChannelAll,
        desktopAlerts: params.desktopAlerts,
        timezone: params.timezone.slice(0, 64),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        chatNotificationMode: params.chatNotificationMode,
        notifyOnChannelAll: params.notifyOnChannelAll,
        desktopAlerts: params.desktopAlerts,
        timezone: params.timezone.slice(0, 64),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/info`);
  }
}

export interface FirestoreChatMessagePayload {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  mentions: string[];
  pinned: boolean;
  edited: boolean;
  parentMessageId?: string | null;
}

export async function mirrorChatMessageToFirestore(msg: FirestoreChatMessagePayload): Promise<void> {
  const current = firebaseAuth.currentUser;
  if (!current || !current.emailVerified) return;
  const channelPath = `chatChannels/${msg.channelId}`;
  const msgPath = `chatChannels/${msg.channelId}/messages/${msg.id}`;
  try {
    const channelRef = doc(firestoreDb, 'chatChannels', msg.channelId);
    const channelSnap = await getDoc(channelRef);
    if (!channelSnap.exists()) {
      await setDoc(channelRef, {
        id: msg.channelId,
        name: msg.channelId.replace(/^ch-/, ''),
        topic: 'Workspace engineering channel',
        createdBy: current.uid,
        isPrivate: false,
        createdAt: serverTimestamp(),
      });
    }
    const payload: Record<string, unknown> = {
      channelId: msg.channelId,
      authorId: current.uid,
      authorName: msg.authorName.slice(0, 80),
      body: msg.body.slice(0, 4000),
      mentions: msg.mentions.slice(0, 8),
      pinned: Boolean(msg.pinned),
      edited: Boolean(msg.edited),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (msg.parentMessageId) {
      payload.parentMessageId = msg.parentMessageId;
    }
    await setDoc(doc(firestoreDb, 'chatChannels', msg.channelId, 'messages', msg.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${channelPath} / ${msgPath}`);
  }
}

export function subscribeFirestoreChannelMessages(
  channelId: string,
  onUpdate: (count: number) => void
): Unsubscribe | null {
  const current = firebaseAuth.currentUser;
  if (!current || !current.emailVerified || !channelId) return null;
  const path = `chatChannels/${channelId}/messages`;
  const q = query(collection(firestoreDb, 'chatChannels', channelId, 'messages'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      onUpdate(snapshot.size);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
