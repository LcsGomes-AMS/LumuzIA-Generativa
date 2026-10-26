import { apiFetch } from "./apiClient.js";

export async function educationApi(path, data) {
    const response = await apiFetch(`/api/educacao${path}`, data === undefined ? {} : { method: "POST", body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar a educação financeira.");
    return result;
}

export async function downloadCertificate() {
    const certificate = await educationApi("/certificado", {});
    const response = await apiFetch("/api/educacao/certificado/pdf");
    if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Não foi possível baixar o certificado.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `${certificate.code}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return certificate;
}
