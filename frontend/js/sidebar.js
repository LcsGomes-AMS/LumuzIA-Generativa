// sidebar.js — menu hamburguer + active link automático
(function () {

    // ─── 1. Marca o link ativo com base na URL atual ─────────────────────────
    var current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar a, aside a').forEach(function (a) {
        var href = a.getAttribute('href');
        if (href === current) {
            a.classList.add('active');
        }
    });

    // ─── 2. Botão hamburguer (criado dinamicamente) ──────────────────────────
    var btn = document.createElement('button');
    btn.id = 'hamburger';
    btn.className = 'hamburger';
    btn.setAttribute('aria-label', 'Abrir menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    document.body.prepend(btn);

    // ─── 3. Overlay ──────────────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    var sidebar = document.querySelector('.sidebar, aside');
    if (!sidebar) return;

    function openMenu() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        btn.classList.add('is-active');
        btn.setAttribute('aria-label', 'Fechar menu');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        btn.classList.remove('is-active');
        btn.setAttribute('aria-label', 'Abrir menu');
        document.body.style.overflow = '';
    }

    btn.addEventListener('click', function () {
        sidebar.classList.contains('open') ? closeMenu() : openMenu();
    });

    overlay.addEventListener('click', closeMenu);

    sidebar.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
    });

})();
