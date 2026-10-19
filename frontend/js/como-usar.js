import { bindActions } from "./security.js";

function filtrarGuia(termo) {
    const query = (termo || "").toLowerCase().trim();
    const cards = document.querySelectorAll(".guia-card, .source-card, .video-section-block, .calc-card");
    cards.forEach(card => {
        card.style.display = !query || card.innerText.toLowerCase().includes(query) ? "" : "none";
    });
    document.querySelectorAll(".content-section").forEach(section => {
        if (!query) {
            section.style.display = "";
            return;
        }
        const items = section.querySelectorAll(".guia-card, .source-card, .video-section-block, .calc-card");
        const hasVisible = Array.from(items).some(item => item.style.display !== "none");
        section.style.display = hasVisible ? "" : "none";
    });
}

function normalizarVideo(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    let id = value;
    if (!/^[\w-]{11}$/.test(value)) {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use um link HTTPS do YouTube.");
        const host = url.hostname.replace(/^www\./, "");
        if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
        else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
            id = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
        } else throw new Error("Use um link ou ID válido do YouTube.");
    }
    if (!/^[\w-]{11}$/.test(id || "")) throw new Error("Use um link ou ID válido do YouTube.");
    const embed = new URL("https://www.youtube.com/embed/" + id);
    embed.searchParams.set("rel", "0");
    if (/^https?:$/.test(window.location?.protocol || "")) {
        embed.searchParams.set("origin", window.location.origin);
    }
    return embed.href;
}

function abrirVideoModal(titulo, desc, containerId) {
    const container = containerId ? document.getElementById(containerId) : null;
    const configured = container?.dataset.videoUrl || container?.dataset.videoId || "";
    const iframe = document.getElementById("modalVideoIframe");
    document.getElementById("modalVideoTitulo").textContent = titulo || "Assistir Tutorial";
    document.getElementById("modalVideoDesc").textContent = desc || "";
    if (iframe) {
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        try {
            const embedUrl = configured ? normalizarVideo(configured) : "";
            if (embedUrl) iframe.src = embedUrl;
            else iframe.removeAttribute("src");
        } catch {
            iframe.removeAttribute("src");
        }
    }
    document.getElementById("videoModal")?.classList.add("active");
}

function fecharVideoModal() {
    document.getElementById("videoModal")?.classList.remove("active");
    document.getElementById("modalVideoIframe")?.removeAttribute("src");
}

window.addEventListener("click", event => {
    if (event.target === document.getElementById("videoModal")) fecharVideoModal();
});
window.addEventListener("keydown", event => {
    if (event.key === "Escape") fecharVideoModal();
});

document.getElementById("buscaGuia")?.addEventListener("input", event => filtrarGuia(event.target.value));
bindActions({ abrirVideoModal, fecharVideoModal });
