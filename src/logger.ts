import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export const logAction = async (action: string, details: string) => {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'logs'), {
      uid: user?.uid || 'anonymous',
      action,
      timestamp: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error("Logging failed:", error);
  }
};
