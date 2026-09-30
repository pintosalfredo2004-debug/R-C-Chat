importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:'AIzaSyBWv09xGRux29JoEZb1k26F545lMYE98A',
  authDomain:'chat-privado-b263d.firebaseapp.com',
  projectId:'chat-privado-b263d',
  databaseURL:'https://chat-privado-b263d-default-rtdb.firebaseio.com',
  storageBucket:'chat-privado-b263d.firebasestorage.app',
  messagingSenderId:'103339133634',
  appId:'1:103339133634:web:59277533c9d3b9b3ab095b'
});

const messaging=firebase.messaging();

messaging.onBackgroundMessage(payload=>{
  const title=payload?.notification?.title||payload?.data?.title||'R&C Chat';
  const body=payload?.notification?.body||payload?.data?.body||'Nuevo mensaje';
  const link=payload?.fcmOptions?.link||payload?.data?.link||self.registration.scope;
  self.registration.showNotification(title,{
    body,
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    data:{link}
  });
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const link=event.notification?.data?.link||self.registration.scope;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('focus' in client){
        try{client.navigate(link)}catch(e){}
        return client.focus();
      }
    }
    if(clients.openWindow)return clients.openWindow(link);
  }));
});
