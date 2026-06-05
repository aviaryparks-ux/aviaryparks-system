importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyCwFnS1_lDGdY8E72d-RikRaHSnvjLEJ6w",
  authDomain: "aviary-parks-system.firebaseapp.com",
  projectId: "aviary-parks-system",
  storageBucket: "aviary-parks-system.firebasestorage.app",
  messagingSenderId: "563254318213",
  appId: "1:563254318213:web:562063b16fb85cee0e85ec",
  measurementId: "G-2EYXMW6W1E"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  
  const notificationTitle = payload.notification?.title || "Notifikasi Baru";
  const notificationOptions = {
    body: payload.notification?.body || "Anda memiliki pesan baru.",
    icon: "/images/myaviary-logo.png",
    badge: "/images/myaviary-logo.png",
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
