import { auth } from "./config.js";
import { onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const loading = document.getElementById("lzLoading");
const profileBox = document.getElementById("lzProfile");
const avatar = document.getElementById("lzAvatar");
const nameEl = document.getElementById("lzName");
const emailEl = document.getElementById("lzEmail");
const providerEl = document.getElementById("lzProvider");
const createdEl = document.getElementById("lzCreated");
const editName = document.getElementById("lzEditName");
const saveBtn = document.getElementById("lzSaveBtn");
const logoutBtn = document.getElementById("lzLogoutBtn");
const msg = document.getElementById("lzMsg");

function showMsg(text, type = "info") {
  msg.textContent = text;
  msg.className = `lz-msg show ${type}`;
  setTimeout(() => (msg.className = "lz-msg"), 3000);
}

function initialsOf(name, email) {
  const base = (name || email || "?").trim();
  const parts = base.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function providerLabel(id) {
  return id === "google.com" ? "Google" : "E-mail e senha";
}

// Se não estiver logado, manda de volta para o login
onAuthStateChanged(auth, (user) => {
  if (!user) {
    localStorage.removeItem("userId"); // Limpa o ID se deslogar
    window.location.href = "cad.html";
    return;
  }

  // >>> AQUI ESTÁ A CHAVE DO MISTÉRIO <<<
  // Salva o UID do Firebase no localStorage do navegador do usuário
  localStorage.setItem("userId", user.uid);

  const providerId = user.providerData[0]?.providerId || "password";
  const displayName = user.displayName || "";

  avatar.textContent = initialsOf(displayName, user.email);
  nameEl.textContent = displayName || user.email;
  emailEl.textContent = user.email;
  providerEl.textContent = providerLabel(providerId);
  createdEl.textContent = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("pt-BR")
    : "-";
  editName.value = displayName;

  loading.style.display = "none";
  profileBox.style.display = "block";
});

saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const newName = editName.value.trim();

  saveBtn.disabled = true;
  try {
    await updateProfile(user, { displayName: newName });
    nameEl.textContent = newName || user.email;
    avatar.textContent = initialsOf(newName, user.email);
    showMsg("Perfil atualizado com sucesso.", "info");
  } catch (err) {
    showMsg("Não foi possível salvar.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

// Sair: desconecta do Firebase, limpa o localStorage e volta para o login
logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem("userId");
  await signOut(auth);
  window.location.href = "cad.html";
});