import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getDatabase, ref, push, onValue, serverTimestamp, query, orderByChild } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWvP09xGRux29JoEZb1k26F545lMYE98A",
  authDomain: "chat-privado-b263d.firebaseapp.com",
  projectId: "chat-privado-b263d",
  databaseURL: "https://chat-privado-b263d-default-rtdb.firebaseio.com",
  storageBucket: "chat-privado-b263d.firebasestorage.app",
  messagingSenderId: "103339133634",
  appId: "1:103339133634:web:59277533c9d3b9b3ab095b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = id => document.getElementById(id);

const emojis = ["😀","😂","😍","🥰","😘","😭","😎","🤩","😡","👍","👎","❤️","💚","💙","💯","🔥","🎉","🤣","😊","😉","😢","😮","🤔","🙏","👏","🙌","✨","⚽","🎮","🚀","👋","💬"];

function errorText(e) {
  const code = e?.code || "";
  if (code.includes("invalid-credential")) return "Correo o contraseña incorrectos.";
  if (code.includes("invalid-email")) return "El correo no es válido.";
  if (code.includes("email-already-in-use")) return "Ese correo ya tiene una cuenta.";
  if (code.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (code.includes("network-request-failed")) return "No hay conexión a Internet.";
  return e?.message || String(e) || "Ocurrió un error.";
}

function showError(message) {
  $("err").textContent = message || "";
}

function setBusy(id, busy, label) {
  const b = $(id);
  b.disabled = busy;
  b.textContent = busy ? label : (id === "login" ? "Entrar" : "Crear cuenta");
}

function setupEmojiPanel() {
  const panel = $("emojiPanel");
  panel.innerHTML = emojis.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join("");
  $("emoji").addEventListener("click", () => panel.classList.toggle("hidden"));
  panel.addEventListener("click", e => {
    const btn = e.target.closest("button[data-emoji]");
    if (!btn) return;
    const input = $("text");
    const emoji = btn.dataset.emoji;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;
  });
}

async function login() {
  const email = $("email").value.trim();
  const pass = $("pass").value;
  if (!email || !pass) return showError("Escribe tu correo y contraseña.");
  showError("");
  setBusy("login", true, "Entrando…");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError(errorText(e));
    setBusy("login", false);
  }
}

async function register() {
  const email = $("email").value.trim();
  const pass = $("pass").value;
  if (!email || !pass) return showError("Escribe tu correo y una contraseña.");
  showError("");
  setBusy("register", true, "Creando…");
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError(errorText(e));
    setBusy("register", false);
  }
}

function renderMessages(snapshot) {
  const box = $("messages");
  box.innerHTML = "";
  let count = 0;
  snapshot.forEach(child => {
    count++;
    const m = child.val() || {};
    const mine = m.uid === auth.currentUser?.uid;
    const bubble = document.createElement("div");
    bubble.className = "bubble " + (mine ? "mine" : "theirs");
    const body = document.createElement("span");
    body.textContent = m.text || "";
    const meta = document.createElement("span");
    meta.className = "meta";
    const date = m.time ? new Date(m.time) : new Date();
    meta.textContent = date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) + (mine ? " ✓✓" : "");
    bubble.append(body, meta);
    box.appendChild(bubble);
  });
  if (!count) box.innerHTML = '<div class="empty">🔒<br><br>Esta conversación es privada.<br>Envía el primer mensaje.</div>';
  box.scrollTop = box.scrollHeight;
}

function listen() {
  onValue(query(ref(db, "messages"), orderByChild("time")), renderMessages, e => {
    $("messages").innerHTML = `<div class="empty">⚠️<br><br>${e.message}</div>`;
  });
}

async function sendMessage(e) {
  e.preventDefault();
  const text = $("text").value.trim();
  if (!text || !auth.currentUser) return;
  try {
    await push(ref(db, "messages"), { uid: auth.currentUser.uid, text, time: serverTimestamp() });
    $("text").value = "";
    $("emojiPanel").classList.add("hidden");
  } catch (err) {
    showError("No se pudo enviar: " + errorText(err));
  }
}

function init() {
  setupEmojiPanel();
  $("login").addEventListener("click", login);
  $("register").addEventListener("click", register);
  $("pass").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); login(); } });
  $("composer").addEventListener("submit", sendMessage);
  $("text").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("composer").requestSubmit(); } });
  onAuthStateChanged(auth, user => {
    $("auth").classList.toggle("hidden", !!user);
    $("chat").classList.toggle("hidden", !user);
    if (user) listen();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
