import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, onSnapshot, addDoc, collection } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export async function logAction(action: string, details: string, uid?: string, userEmail?: string) {
  try {
    const targetUid = uid || auth.currentUser?.uid || 'unauthenticated';
    const email = userEmail || auth.currentUser?.email || 'unknown';

    await addDoc(collection(db, 'logs'), {
      uid: targetUid,
      email: email,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Logging error:', error);
  }
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  alert: { isOpen: boolean; title: string; message: string } | null;
  showAlert: (title: string, message: string) => void;
  hideAlert: () => void;
  handleFirestoreError: (error: unknown, operationType: OperationType, path: string | null, currentUser?: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  alert: null,
  showAlert: () => {},
  hideAlert: () => {},
  handleFirestoreError: () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);

  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch(err => {
      console.error("Persistence error:", err);
    });
  }, []);

  const showAlert = (title: string, message: string) => {
    setAlertState({ isOpen: true, title, message });
  };

  const hideAlert = () => {
    setAlertState(prev => prev ? { ...prev, isOpen: false } : null);
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null, currentUser?: User | null) => {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errCode = (error as any)?.code || '';
    
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: currentUser?.uid || auth.currentUser?.uid,
        email: currentUser?.email || auth.currentUser?.email,
        emailVerified: currentUser?.emailVerified || auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));

    // Show user-friendly Japanese message for common errors
    if (errMessage.includes('permission-denied') || errMessage.includes('insufficient permissions') || errCode === 'permission-denied') {
      showAlert('アクセス拒否', '権限が不足しています。この操作を行うことはできません。');
    } else if (errMessage.includes('quota-exceeded') || errCode === 'quota-exceeded') {
      showAlert('制限超過', '利用制限（クォータ）を超えました。明日までお待ちください。');
    } else if (errMessage.includes('offline')) {
      showAlert('接続エラー', 'ネットワーク接続を確認してください。オフラインの可能性があります。');
    } else {
      showAlert('エラー', `エラーが発生しました: ${errMessage}`);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        // Start profile listener
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
          setIsAuthReady(true);
        }, (error) => {
          // If it's a permission error, it might be a race condition. 
          // We'll log it with the user object we have.
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser);
          
          // Even if it fails, we mark auth as ready to allow the app to proceed (e.g. to login or error screen)
          setLoading(false);
          setIsAuthReady(true);
        });
      } else {
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAuthReady, 
      alert: alertState, 
      showAlert, 
      hideAlert,
      handleFirestoreError,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
