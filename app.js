import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {getDatabase,ref,push,set,remove,onValue,serverTimestamp,query,orderByChild,get} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js';
import {getMessaging,getToken,onMessage} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging.js';

const firebaseConfig={apiKey:'AIzaSyBWv09xGRux29JoEZb1k26F545lMYE98A',authDomain:'chat-privado-b263d.firebaseapp.com',projectId:'chat-privado-b263d',databaseURL:'https://chat-privado-b263d-default-rtdb.firebaseio.com',storageBucket:'chat-privado-b263d.firebasestorage.app',messagingSenderId:'103339133634',appId:'1:103339133634:web:59277533c9d3b9b3ab095b'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id);
const emojis=['😀','😂','😍','🥰','😘','😭','😎','🤩','😡','👍','👎','❤️','💚','💙','💯','🔥','🎉','🤣','😊','😉','😢','😮','🤔','🙏','👏','🙌','✨','⚽','🎮','🚀','👋','💬'];
const VAPID_KEY='BGehgLzoPFGieqq9VEVFqn43_q8oiwg1FWaiAbU-6boWlL09bBQPI5WKvuzqTOvUevPmcq6tK6ewuXltWX07B24';

let currentContact=null,stopContacts=null,stopMessages=null,replyTo=null,longPressTimer=null,ignoreClickUntil=0;
let unreadStops=new Map(), unreadCounts=new Map(), initialUnreadReady=new Set();

const errText=e=>{const c=e?.code||'';if(c.includes('invalid-credential'))return'Correo o contraseña incorrectos';if(c.includes('email-already-in-use'))return'Ese correo ya tiene una cuenta';if(c.includes('weak-password'))return'La contraseña debe tener al menos 6 caracteres';return e?.message||'Ocurrió un error'};
const showErr=x=>$('err').textContent=typeof x==='string'?x:errText(x);
const chatId=(a,b)=>[a,b].sort().join('_');
const nameFor=u=>u?.name||u?.email?.split('@')[0]||'Contacto';
const initials=n=>(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';

function showView(v){$('auth').classList.toggle('hidden',v!=='auth');$('contactsView').classList.toggle('hidden',v!=='contacts');$('chatView').classList.toggle('hidden',v!=='chat')}

async function login(){const email=$('email').value.trim(),pass=$('pass').value;if(!email||!pass)return showErr('Escribe tu correo y contraseña');showErr('');$('login').disabled=true;$('login').textContent='Entrando…';try{await signInWithEmailAndPassword(auth,email,pass)}catch(e){showErr(e);$('login').disabled=false;$('login').textContent='Entrar'}}
async function register(){const name=$('name').value.trim(),email=$('email').value.trim().toLowerCase(),pass=$('pass').value;if(!name)return showErr('Escribe tu nombre');if(!email||!pass)return showErr('Escribe tu correo y una contraseña');showErr('');$('register').disabled=true;$('register').textContent='Creando…';try{const cred=await createUserWithEmailAndPassword(auth,email,pass);await set(ref(db,'users/'+cred.user.uid),{email:cred.user.email,name:name});$('name').value=''}catch(e){showErr(e);$('register').disabled=false;$('register').textContent='Crear cuenta'}}

function setupEmoji(){$('emojiPanel').innerHTML=emojis.map(e=>`<button type="button">${e}</button>`).join('');$('emoji').onclick=()=>{$('emojiPanel').classList.toggle('hidden')};$('emojiPanel').onclick=e=>{if(e.target.tagName==='BUTTON'){const t=$('text'),s=t.selectionStart??t.value.length,en=t.selectionEnd??s,v=e.target.textContent;t.value=t.value.slice(0,s)+v+t.value.slice(en);t.selectionStart=t.selectionEnd=s+v.length;t.focus()}}}
function showToast(t){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),1800)}

async function addContact(){const email=$('contactEmail').value.trim().toLowerCase();$('addMsg').textContent='';if(!email)return $('addMsg').textContent='Escribe un correo';if(email===auth.currentUser?.email?.toLowerCase())return $('addMsg').textContent='No puedes agregarte a ti mismo';$('confirmAdd').disabled=true;$('confirmAdd').textContent='Buscando…';try{const snap=await get(query(ref(db,'users'),orderByChild('email')));let found=null;snap.forEach(c=>{const u=c.val()||{};if((u.email||'').toLowerCase()===email)found={uid:c.key,...u}});if(!found)throw new Error('No se encontró una cuenta con ese correo');const me=auth.currentUser.uid;const myUser=await getUser(me);const myEmail=String(myUser?.email||auth.currentUser?.email||'').trim().toLowerCase();const myName=nameFor(myUser);const contactEmailValue=String(found.email||email).trim().toLowerCase();const contactName=nameFor(found);const mineForContact={uid:me,email:myEmail,name:myName};const contactForMe={uid:found.uid,email:contactEmailValue,name:contactName};if(!mineForContact.uid||!mineForContact.email||!contactForMe.uid||!contactForMe.email)throw new Error('Faltan datos de la cuenta. Vuelve a iniciar sesión.');await Promise.all([set(ref(db,`contacts/${me}/${found.uid}`),contactForMe),set(ref(db,`contacts/${found.uid}/${me}`),mineForContact)]);$('addBox').classList.add('hidden');$('contactEmail').value='';showToast('Contacto agregado')}catch(e){$('addMsg').textContent=e.message||'No se pudo agregar'}finally{$('confirmAdd').disabled=false;$('confirmAdd').textContent='Agregar'}}

async function getUser(uid){const s=await get(ref(db,'users/'+uid));return s.exists()?s.val():{email:auth.currentUser?.email||'',name:auth.currentUser?.email?.split('@')[0]||'Usuario'}}

function unreadStorageKey(uid){return `rcchat_lastread_${uid}`}
function getLastRead(uid){return localStorage.getItem(unreadStorageKey(uid))||''}
function setLastRead(uid,key){if(key)localStorage.setItem(unreadStorageKey(uid),key);else localStorage.removeItem(unreadStorageKey(uid))}
function updateContactBadge(uid,count){unreadCounts.set(uid,count);const el=document.querySelector(`.contact[data-uid="${CSS.escape(uid)}"]`);if(!el)return;let b=el.querySelector('.unread');if(count>0){if(!b){b=document.createElement('span');b.className='unread';el.appendChild(b)}b.textContent=count>99?'99+':String(count)}else if(b)b.remove()}
function clearUnread(uid,lastKey){if(lastKey)setLastRead(uid,lastKey);unreadCounts.set(uid,0);updateContactBadge(uid,0)}

function watchUnreadForContact(uid){
  if(unreadStops.has(uid))return;
  const id=chatId(auth.currentUser.uid,uid);
  const stop=onValue(ref(db,`chats/${id}/messages`),snap=>{
    const lastRead=getLastRead(uid);
    let count=0,lastKey='';
    snap.forEach(c=>{
      lastKey=c.key;
      const m=c.val()||{};
      if(m.uid!==auth.currentUser.uid && (!lastRead || c.key>lastRead)) count++;
    });
    if(!initialUnreadReady.has(uid)){
      initialUnreadReady.add(uid);
      if(!lastRead && lastKey && count>0){
        setLastRead(uid,lastKey);
        count=0;
      }
    }
    if(currentContact?.uid===uid){
      if(snap.exists() && lastKey) clearUnread(uid,lastKey);
      else clearUnread(uid);
      return;
    }
    updateContactBadge(uid,count);
  });
  unreadStops.set(uid,stop);
}

function stopUnreadWatchers(){
  unreadStops.forEach(stop=>stop());
  unreadStops.clear();
  unreadCounts.clear();
  initialUnreadReady.clear();
}

function loadContacts(){
  if(stopContacts)stopContacts();
  stopUnreadWatchers();
  stopContacts=onValue(ref(db,'contacts/'+auth.currentUser.uid),snap=>{
    const box=$('contacts');box.innerHTML='';let n=0;
    snap.forEach(c=>{
      const u=c.val()||{};n++;
      const el=document.createElement('div');el.className='contact';el.dataset.uid=u.uid||c.key;
      const av=document.createElement('div');av.className='avatar';av.textContent=initials(nameFor(u));
      const info=document.createElement('div');info.className='info';
      const nm=document.createElement('div');nm.className='name';nm.textContent=nameFor(u);
      const em=document.createElement('div');em.className='email';em.textContent=u.email||'';
      info.append(nm,em);el.append(av,info);
      el.onclick=()=>openChat(u.uid||c.key,u);
      box.appendChild(el);
      watchUnreadForContact(u.uid||c.key);
    });
    if(!n)box.innerHTML='<div class="empty">👥<br><br>No tienes contactos todavía.<br>Pulsa ＋ para agregar uno.</div>';
  },e=>{$('contacts').innerHTML='<div class="empty">⚠️<br>'+e.message+'</div>'});
}

async function ensureChat(id){const r=ref(db,'chats/'+id);const s=await get(r);if(!s.exists())await set(r,{members:{[auth.currentUser.uid]:true,[currentContact.uid]:true}});else if(!s.child('members').child(auth.currentUser.uid).exists()||!s.child('members').child(currentContact.uid).exists())throw new Error('Chat no autorizado')}

function openChat(uid,u){
  currentContact={uid,...u};
  $('chatAvatar').textContent=initials(nameFor(u));$('chatName').textContent=nameFor(u);
  showView('chat');replyTo=null;updateReplyBar();clearUnread(uid);
  listenMessages();
}

function listenMessages(){
  if(stopMessages)stopMessages();
  const id=chatId(auth.currentUser.uid,currentContact.uid);
  stopMessages=onValue(query(ref(db,`chats/${id}/messages`),orderByChild('time')),snap=>{
    const box=$('messages');box.innerHTML='';let lastKey='';
    snap.forEach(c=>{lastKey=c.key;renderMessage(c.key,c.val()||{},box)});
    if(lastKey)clearUnread(currentContact.uid,lastKey);
    box.scrollTop=box.scrollHeight;
  },e=>{$('messages').innerHTML='<div class="empty">⚠️<br>'+e.message+'</div>'});
}

function renderMessage(key,m,box){
  const mine=m.uid===auth.currentUser.uid,wrap=document.createElement('div');wrap.className='bubblewrap '+(mine?'mine':'theirs');wrap.dataset.key=key;wrap.dataset.text=m.text||'';
  const bubble=document.createElement('div');bubble.className='bubble';
  if(m.replyTo?.text){const q=document.createElement('div');q.className='replyquote';q.textContent='↩ '+m.replyTo.text;bubble.appendChild(q)}
  const span=document.createElement('span');span.textContent=m.text||'';bubble.appendChild(span);
  const meta=document.createElement('span');meta.className='meta';meta.textContent=m.time?new Date(m.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'…';
  if(mine){const ck=document.createElement('span');ck.className='checks';ck.textContent=' ✓✓';meta.appendChild(ck)}bubble.appendChild(meta);
  const actions=document.createElement('div');actions.className='swipe-actions';const rb=document.createElement('button');rb.type='button';rb.textContent='↩ Responder';rb.onclick=()=>{setReply(key,m);resetSwipe(wrap)};actions.appendChild(rb);wrap.append(bubble,actions);attachSwipe(wrap);attachLongPress(wrap);box.appendChild(wrap);
}

function setReply(key,m){replyTo={key,text:m.text||'',uid:m.uid};updateReplyBar();$('text').focus()}
function updateReplyBar(){if(replyTo){$('replyBar').classList.remove('hidden');$('replyText').textContent='↩ '+replyTo.text}else{$('replyBar').classList.add('hidden');$('replyText').textContent=''}}
function resetSwipe(el){el.style.transform='translateX(0)';el.querySelector('.swipe-actions').style.display='none'}
function attachSwipe(el){let start=0,moved=false;el.addEventListener('touchstart',e=>{start=e.touches[0].clientX;moved=false},{passive:true});el.addEventListener('touchmove',e=>{const dx=e.touches[0].clientX-start;if(dx<0){moved=true;el.style.transform=`translateX(${Math.max(dx,-120)}px)`}},{passive:true});el.addEventListener('touchend',()=>{const dx=parseFloat((el.style.transform.match(/-?[\d.]+/)||['0'])[0]);if(dx<-55){el.querySelector('.swipe-actions').style.display='flex'}else resetSwipe(el);if(moved)ignoreClickUntil=Date.now()+300})}
function attachLongPress(el){el.addEventListener('touchstart',e=>{clearTimeout(longPressTimer);longPressTimer=setTimeout(()=>{ignoreClickUntil=Date.now()+700;showDeleteMenu(el,e.touches[0].clientX,e.touches[0].clientY)},600)},{passive:true});['touchend','touchcancel','touchmove'].forEach(ev=>el.addEventListener(ev,()=>clearTimeout(longPressTimer),{passive:true}))}
function showDeleteMenu(w,x,y){document.querySelector('.context')?.remove();const menu=document.createElement('div');menu.className='context';menu.style.left=Math.min(x,innerWidth-155)+'px';menu.style.top=Math.min(y,innerHeight-65)+'px';const del=document.createElement('button');del.type='button';del.textContent='🗑️ Eliminar';del.onclick=()=>{menu.remove();deleteMessage(w.dataset.key)};menu.appendChild(del);document.body.appendChild(menu);setTimeout(()=>document.addEventListener('click',()=>menu.remove(),{once:true}),0)}
async function deleteMessage(key){const id=chatId(auth.currentUser.uid,currentContact.uid);if(!confirm('¿Eliminar este mensaje para todos?'))return;try{const s=await get(ref(db,`chats/${id}/messages/${key}`));if(!s.exists())return;if(s.val().uid!==auth.currentUser.uid)return showToast('Solo puedes eliminar tus propios mensajes');await remove(ref(db,`chats/${id}/messages/${key}`))}catch(e){showToast('No se pudo eliminar')}}

async function setupNotifications(){
  if(!('Notification' in window)){console.log('Este navegador no soporta notificaciones');return}
  try{
    if(Notification.permission==='default')await Notification.requestPermission();
    if(Notification.permission!=='granted')return;
    const swReg=await navigator.serviceWorker.register('./firebase-messaging-sw.js');
    const messaging=getMessaging(app);
    const token=await getToken(messaging,{vapidKey:VAPID_KEY,serviceWorkerRegistration:swReg});
    if(token && auth.currentUser){
      await set(ref(db,`users/${auth.currentUser.uid}/fcmTokens/${token}`),{createdAt:Date.now(),userAgent:navigator.userAgent});
      console.log('FCM token registrado');
    }
    onMessage(messaging,payload=>{
      const title=payload?.notification?.title||payload?.data?.title||'R&C Chat';
      const body=payload?.notification?.body||payload?.data?.body||'Nuevo mensaje';
      if(document.visibilityState==='visible'){
        showToast(`🔔 ${title}: ${body}`);
      }
    });
  }catch(e){console.warn('Notificaciones:',e)}
}

$('addContact').onclick=()=>{$('addMsg').textContent='';$('contactEmail').value='';$('addBox').classList.remove('hidden');setTimeout(()=>$('contactEmail').focus(),50)};
$('cancelAdd').onclick=()=>$('addBox').classList.add('hidden');$('confirmAdd').onclick=addContact;$('contactEmail').onkeydown=e=>{if(e.key==='Enter')addContact()};
$('login').onclick=login;$('register').onclick=register;$('pass').onkeydown=e=>{if(e.key==='Enter')login()};
$('back').onclick=()=>{if(stopMessages){stopMessages();stopMessages=null}currentContact=null;showView('contacts');loadContacts()};
$('cancelReply').onclick=()=>{replyTo=null;updateReplyBar()};
$('contactsMenu').onclick=()=>signOut(auth);

$('composer').onsubmit=async e=>{
  e.preventDefault();const text=$('text').value.trim();if(!text||!currentContact)return;
  const id=chatId(auth.currentUser.uid,currentContact.uid);
  try{await ensureChat(id);const data={uid:auth.currentUser.uid,text,time:serverTimestamp(),replyTo:replyTo?{key:replyTo.key,text:replyTo.text,uid:replyTo.uid}:null};await push(ref(db,`chats/${id}/messages`),data);$('text').value='';$('text').style.height='44px';replyTo=null;updateReplyBar();$('emojiPanel').classList.add('hidden');$('text').focus()}catch(e){showToast(e.message||'No se pudo enviar')}
};

$('text').oninput=()=>{const t=$('text');t.style.height='44px';t.style.height=Math.min(t.scrollHeight,120)+'px'};
$('text').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit()}};
setupEmoji();

onAuthStateChanged(auth,async user=>{
  if(!user){
    if(stopContacts){stopContacts();stopContacts=null}
    if(stopMessages){stopMessages();stopMessages=null}
    stopUnreadWatchers();
    showView('auth');return;
  }
  showView('contacts');
  try{
    const s=await get(ref(db,'users/'+user.uid));
    if(!s.exists())await set(ref(db,'users/'+user.uid),{email:user.email,name:user.email.split('@')[0]});
  }catch(e){console.warn(e)}
  loadContacts();
  setupNotifications();
});
