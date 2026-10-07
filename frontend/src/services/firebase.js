import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC2qUvFN306gufchGDHBjdgncIhUb0APk8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gesli-8b429.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gesli-8b429",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gesli-8b429.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "408540523248",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:408540523248:web:172ddc8c35850c908af035"
};

const app = initializeApp(firebaseConfig);

let messaging = null;

export const initMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
    console.warn('⚠️ Firebase Messaging n’est pas supporté par ce navigateur.');
  } catch (err) {
    console.error('Erreur initialisation Firebase Messaging:', err);
  }
  return null;
};

export const requestNotificationPermission = async (vapidKey) => {
  try {
    const msg = await initMessaging();
    if (!msg) return null;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Autorisation des notifications accordée.');
      const tokenOptions = vapidKey ? { vapidKey } : undefined;
      const currentToken = await getToken(msg, tokenOptions);
      if (currentToken) {
        console.log('🔔 Token FCM Firebase :', currentToken);
        return currentToken;
      }
      console.warn('⚠️ Aucun jeton d enregistrement FCM disponible.');
    } else {
      console.warn('⚠️ Permission de notification refusée par l utilisateur.');
    }
  } catch (err) {
    console.error('Erreur lors de la demande d autorisation de notification:', err);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    initMessaging().then((msg) => {
      if (msg) {
        onMessage(msg, (payload) => {
          console.log('📬 Notification reçue au premier plan:', payload);
          resolve(payload);
        });
      }
    });
  });

export default app;
