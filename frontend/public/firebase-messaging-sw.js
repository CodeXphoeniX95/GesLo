importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC2qUvFN306gufchGDHBjdgncIhUb0APk8",
  authDomain: "gesli-8b429.firebaseapp.com",
  projectId: "gesli-8b429",
  storageBucket: "gesli-8b429.firebasestorage.app",
  messagingSenderId: "408540523248",
  appId: "1:408540523248:web:172ddc8c35850c908af035"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notification reçue en arrière-plan ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'GesLo Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Vous avez une nouvelle alerte GesLo.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Ouvrir GesLo' }
    ]
  };

  // Mettre à jour la pastille/badge rouge sur l'icône de l'application (Badging API PWA)
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch((err) => console.error('Erreur setAppBadge:', err));
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Effacer la pastille/badge quand l'utilisateur clique sur la notification
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch((err) => console.error('Erreur clearAppBadge:', err));
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
