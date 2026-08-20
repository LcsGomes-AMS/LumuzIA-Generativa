import {
  verifyPasswordResetCode,
  confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "./config.js";



const resetForm = document.getElementById("resetForm");
const msg = document.getElementById("msg");
const successBlock = document.getElementById("successBlock");
const invalidBlock = document.getElementById("invalidBlock");
const resetBtn = document.getElementById("resetBtn");

// Pega o código (oobCode) que o Firebase colocou na URL do e-mail
const params = new URLSearchParams(window.location.search);
const oobCode = params.get("oobCode");
const mode = params.get("mode");

let validEmail = null;

async function init() {
  if (mode !== "resetPassword" || !oobCode) {
    showInvalid();
    return;
  }

  try {
    // Confirma que o código ainda é válido e pega o e-mail associado
    validEmail = await verifyPasswordResetCode(auth, oobCode);
  } catch (error) {
    console.error(error);
    showInvalid();
  }
}

function showInvalid() {
  resetForm.style.display = "none";
  invalidBlock.style.display = "block";
}

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    msg.textContent = "As senhas não coincidem.";
    msg.className = "msg error";
    return;
  }

  resetBtn.disabled = true;
  resetBtn.textContent = "Salvando...";

  try {
    await confirmPasswordReset(auth, oobCode, newPassword);
    resetForm.style.display = "none";
    successBlock.style.display = "block";
    msg.textContent = "";
  } catch (error) {
    console.error(error);
    if (error.code === "auth/weak-password") {
      msg.textContent = "Escolha uma senha mais forte (mínimo 6 caracteres).";
    } else if (error.code === "auth/expired-action-code" || error.code === "auth/invalid-action-code") {
      showInvalid();
    } else {
      msg.textContent = "Não foi possível redefinir a senha. Tente novamente.";
    }
    msg.className = "msg error";
  } finally {
    resetBtn.disabled = false;
    resetBtn.textContent = "Salvar nova senha";
  }
});

init();