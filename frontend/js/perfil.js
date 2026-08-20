import { auth, db } from "./config.js";
import { onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { verificarParcelasPendentes } from "./notifications.js";

const loading = document.getElementById("lzLoading");
const profileBox = document.getElementById("lzProfile");
const avatar = document.getElementById("lzAvatar");
const avatarEditBtn = document.getElementById("lzAvatarEditBtn");
const avatarRemoveBtn = document.getElementById("lzAvatarRemoveBtn");
const avatarInput = document.getElementById("lzAvatarInput");
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

function renderAvatar(photoBase64, name, email) {
  if (photoBase64) {
    avatar.innerHTML = `<img src="${photoBase64}" alt="Foto de perfil">`;
    avatarRemoveBtn.style.display = "flex";
  } else {
    avatar.textContent = initialsOf(name, email);
    avatarRemoveBtn.style.display = "none";
  }
}

function compressImageToBase64(file, maxSize = 300, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => (img.src = e.target.result);
    reader.onerror = reject;
    img.onerror = reject;

    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    reader.readAsDataURL(file);
  });
}

let currentUserData = {};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    localStorage.removeItem("userId");
    window.location.href = "cad.html";
    return;
  }

  localStorage.setItem("userId", user.uid);

  verificarParcelasPendentes();

  const providerId = user.providerData[0]?.providerId || "password";
  const displayName = user.displayName || "";

  const userRef = doc(db, "usuarios", user.uid);
  const userSnap = await getDoc(userRef);
  currentUserData = userSnap.exists() ? userSnap.data() : {};

  renderAvatar(currentUserData.photoURL, displayName, user.email);
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

avatarEditBtn.addEventListener("click", () => avatarInput.click());

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showMsg("Selecione um arquivo de imagem válido.", "error");
    avatarInput.value = "";
    return;
  }

  const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_ORIGINAL_SIZE) {
    showMsg("Imagem muito grande. Escolha um arquivo de até 10MB.", "error");
    avatarInput.value = "";
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  avatarEditBtn.classList.add("uploading");
  try {
    const base64Image = await compressImageToBase64(file);

    const userRef = doc(db, "usuarios", user.uid);
    await setDoc(userRef, { photoURL: base64Image }, { merge: true });
    currentUserData.photoURL = base64Image;

    renderAvatar(base64Image, user.displayName, user.email);
    showMsg("Foto de perfil atualizada com sucesso.", "info");
  } catch (err) {
    console.error(err);
    showMsg("Não foi possível salvar a foto. Tente novamente.", "error");
  } finally {
    avatarEditBtn.classList.remove("uploading");
    avatarInput.value = "";
  }
});

avatarRemoveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const confirmar = confirm("Remover sua foto de perfil?");
  if (!confirmar) return;

  avatarRemoveBtn.disabled = true;
  try {
    const userRef = doc(db, "usuarios", user.uid);
    await setDoc(userRef, { photoURL: null }, { merge: true });
    currentUserData.photoURL = null;

    renderAvatar(null, user.displayName, user.email);
    showMsg("Foto de perfil removida.", "info");
  } catch (err) {
    console.error(err);
    showMsg("Não foi possível remover a foto. Tente novamente.", "error");
  } finally {
    avatarRemoveBtn.disabled = false;
  }
});

saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const newName = editName.value.trim();

  saveBtn.disabled = true;
  try {
    await updateProfile(user, { displayName: newName });

    const userRef = doc(db, "usuarios", user.uid);
    await setDoc(userRef, { displayName: newName, email: user.email }, { merge: true });

    nameEl.textContent = newName || user.email;
    renderAvatar(currentUserData.photoURL, newName, user.email);
    showMsg("Perfil atualizado com sucesso.", "info");
  } catch (err) {
    showMsg("Não foi possível salvar.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem("userId");
  await signOut(auth);
  window.location.href = "cad.html";
});