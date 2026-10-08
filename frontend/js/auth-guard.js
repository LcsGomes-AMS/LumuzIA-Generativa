// Executado no head; o conteúdo só aparece depois de confirmar a sessão.
(function () {
    const root = document.documentElement;
    const lock = () => root.setAttribute("data-auth-pending", "");
    const unlock = () => root.removeAttribute("data-auth-pending");
    const redirect = () => {
        lock();
        window.location.replace("./cad.html");
    };

    let activeUid = null;
    lock();
    window.addEventListener("pagehide", lock);

    import("./session.js")
        .then(({ auth, onAuthStateChanged, endSession }) => {
            onAuthStateChanged(auth, (user) => {
                if (!user) {
                    redirect();
                } else if (user.isAnonymous) {
                    lock();
                    void endSession();
                } else if (activeUid && activeUid !== user.uid) {
                    lock();
                    window.location.reload();
                } else {
                    activeUid = user.uid;
                    unlock();
                }
            }, redirect);

            // Recria o DOM ao voltar pelo histórico, evitando dados de uma conta anterior.
            window.addEventListener("pageshow", (event) => {
                if (event.persisted) {
                    lock();
                    window.location.reload();
                }
            });
        })
        .catch(redirect);
})();
