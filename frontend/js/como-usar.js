function filtrarGuia(termo) {
    const query = (termo || "").toLowerCase().trim();
    document.querySelectorAll(".guia-card, .source-card, .video-section-block").forEach(card => {
        card.style.display = !query || card.innerText.toLowerCase().includes(query) ? "" : "none";
    });
}

let videosSalvos = {};
let chaveVideos;
const videosProntos = import("./session.js").then(async ({ requireUser }) => {
    const user = await requireUser();
    chaveVideos = "lumuzia-videos:" + user.uid;
    try { videosSalvos = JSON.parse(localStorage.getItem(chaveVideos) || "{}"); }
    catch { videosSalvos = {}; }
    if (!videosSalvos || typeof videosSalvos !== "object") videosSalvos = {};
    for (const [id, url] of Object.entries(videosSalvos)) {
        try { mostrarVideo(id, normalizarVideo(url)); }
        catch { delete videosSalvos[id]; }
    }
}).catch(error => console.error("Erro ao carregar preferências de vídeo:", error));

function normalizarVideo(raw) {
    const value = String(raw || "").trim();
    let id = value;
    if (!/^[\w-]{11}$/.test(value)) {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");
        if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
        else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
            id = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
        } else throw new Error("Use um link ou ID válido do YouTube.");
    }
    if (!/^[\w-]{11}$/.test(id || "")) throw new Error("Use um link ou ID válido do YouTube.");
    return "https://www.youtube-nocookie.com/embed/" + id;
}

function mostrarVideo(containerId, url) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.dataset.videoUrl = url;
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = container.dataset.videoTitle || "Vídeo Tutorial LumuzIA";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    container.replaceChildren(iframe);
}

async function abrirVideoModal(titulo, desc, containerId) {
    await videosProntos;
    const container = document.getElementById(containerId);
    const configured = videosSalvos[containerId] || container?.dataset.videoUrl || container?.dataset.videoId;
    if (!configured) {
        await configurarUrlVideo(containerId);
        return;
    }
    document.getElementById("modalVideoTitulo").textContent = titulo || "Assistir Tutorial";
    document.getElementById("modalVideoDesc").textContent = desc || "";
    document.getElementById("modalVideoIframe").src = normalizarVideo(configured);
    document.getElementById("videoModal").classList.add("active");
}

function fecharVideoModal() {
    document.getElementById("videoModal").classList.remove("active");
    document.getElementById("modalVideoIframe").removeAttribute("src");
}

async function configurarUrlVideo(containerId) {
    await videosProntos;
    if (!document.getElementById(containerId)) return;
    document.getElementById("targetContainerId").value = containerId;
    document.getElementById("inputVideoUrl").value = videosSalvos[containerId] || "";
    document.getElementById("configUrlModal").classList.add("active");
    document.getElementById("inputVideoUrl").focus();
}

function fecharConfigModal() {
    document.getElementById("configUrlModal").classList.remove("active");
}

async function salvarConfigUrl() {
    await videosProntos;
    const id = document.getElementById("targetContainerId").value;
    try {
        const url = normalizarVideo(document.getElementById("inputVideoUrl").value);
        mostrarVideo(id, url);
        videosSalvos[id] = url;
        try { localStorage.setItem(chaveVideos, JSON.stringify(videosSalvos)); }
        catch { alert("Vídeo configurado. O navegador não permitiu salvar o link para a próxima visita."); }
        fecharConfigModal();
    } catch (error) { alert(error.message); }
}

window.addEventListener("click", event => {
    if (event.target === document.getElementById("videoModal")) fecharVideoModal();
    if (event.target === document.getElementById("configUrlModal")) fecharConfigModal();
});
window.addEventListener("keydown", event => {
    if (event.key === "Escape") { fecharVideoModal(); fecharConfigModal(); }
});
