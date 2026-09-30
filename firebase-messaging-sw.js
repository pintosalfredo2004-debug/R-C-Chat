importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:'AIzaSyBWvP09xGRux29JoEZb1k26F545lMYE98A',
  authDomain:'chat-privado-b263d.firebaseapp.com',
  projectId:'chat-privado-b263d',
  databaseURL:'https://chat-privado-b263d-default-rtdb.firebaseio.com',
  storageBucket:'chat-privado-b263d.firebasestorage.app',
  messagingSenderId:'103339133634',
  appId:'1:103339133634:web:59277533c9d3b9b3ab095b'
});

const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  self.registration.showNotification(n.title||'R&C Chat',{body:n.body||'Nuevo mensaje',data:{url:'./'}});
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c)return c.focus()}
    return clients.openWindow('./');
  }));
});
