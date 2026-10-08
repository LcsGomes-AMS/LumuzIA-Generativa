// The same encoder protects text and quoted HTML attributes.
export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

// Run only registered functions; attributes never contain executable code.
export function bindActions(actions, root = document) {
    root.addEventListener("click", event => {
        const target = event.target.closest?.("[data-action]");
        if (!target || !root.contains(target) || target.disabled) return;
        const action = target.dataset.action;
        if (!Object.hasOwn(actions, action)) return;
        event.preventDefault();
        let args = [];
        if (target.hasAttribute("data-id")) {
            const rawId = target.dataset.id;
            const id = Number(rawId);
            if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)) return;
            args.push(id);
            if (target.hasAttribute("data-mode")) {
                if (!["guardar", "retirar"].includes(target.dataset.mode)) return;
                args.push(target.dataset.mode);
            }
        } else if (target.hasAttribute("data-args")) {
            try { args = JSON.parse(target.dataset.args); } catch { return; }
            if (!Array.isArray(args) || !args.every(arg => typeof arg === "string")) return;
        }
        Promise.resolve(actions[action](...args)).catch(() => {
            console.error("N\u00e3o foi poss\u00edvel concluir a a\u00e7\u00e3o.");
        });
    });
}

export function safePhotoUrl(value) {
    if (typeof value !== "string" || value.length > 1000000) return null;
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return value;
    try {
        const url = new URL(value);
        if (url.protocol === "https:" && !url.username && !url.password &&
            (url.hostname === "lh3.googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"))) return url.href;
    } catch {}
    return null;
}
