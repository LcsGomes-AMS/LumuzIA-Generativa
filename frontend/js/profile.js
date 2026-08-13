import { auth, db } from "./config.js";
import { onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { verificarParcelasPendentes } from "./notifications.js";

const loadingState = document.getElementById("loadingState");
const profileContent = document.getElementById("profileContent");
const avatarInitials = document.getElementById("avatarInitials");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileProvider = document.getElementById("profileProvider");
const profileCreated = document.getElementById("profileCreated");
const editName = document.getElementById("editName");
const saveBtn = document.getElementById("saveBtn");
const logoutBtn = document.getElementById("logoutBtn");
const msg = document.getElementById("msg");

function showMsg(text, type = "info") {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
  setTimeout(() => (msg.className = "msg"), 3000);
}

function initialsOf(name, email) {
  const base = (name || email || "?").trim();
  const parts = base.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function providerLabel(providerId) {
  if (providerId === "google.com") return "Google";
  return "E-mail e senha";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  verificarParcelasPendentes();

  const providerId = user.providerData[0]?.providerId || "password";

  let profileData = {};
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) profileData = snap.data();
  } catch (e) {
    // Firestore pode não estar configurado ainda — segue só com os dados de auth
  }

  const displayName = user.displayName || profileData.name || "";

  avatarInitials.textContent = initialsOf(displayName, user.email);
  profileName.textContent = displayName || user.email;
  profileEmail.textContent = user.email;
  profileProvider.textContent = providerLabel(providerId);
  profileCreated.textContent = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("pt-BR")
    : "-";
  editName.value = displayName;

  loadingState.style.display = "none";
  profileContent.style.display = "block";
});

saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const newName = editName.value.trim();

  saveBtn.disabled = true;
  try {
    await updateProfile(user, { displayName: newName });
    await setDoc(doc(db, "users", user.uid), { name: newName }, { merge: true });
    profileName.textContent = newName || user.email;
    avatarInitials.textContent = initialsOf(newName, user.email);
    showMsg("Perfil atualizado com sucesso.", "info");
  } catch (err) {
    showMsg("Não foi possível salvar. Tente novamente.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});