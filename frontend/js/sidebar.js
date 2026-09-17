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

    // ─── 2. Mobile Topbar (Criado dinamicamente) ─────────────────────────
    var mobileTopbar = document.createElement('div');
    mobileTopbar.className = 'mobile-topbar';

    var btn = document.createElement('button');
    btn.id = 'hamburger';
    btn.className = 'hamburger';
    btn.setAttribute('aria-label', 'Abrir menu');
    btn.innerHTML = '<span></span><span></span><span></span>';

    var mobileLogo = document.createElement('img');
    mobileLogo.src = 'img/LumuzIA.png';
    mobileLogo.className = 'mobile-logo';
    mobileLogo.alt = 'LumuzIA';

    // Tentar pegar o título da página atual
    var pageTitle = document.createElement('h1');
    pageTitle.className = 'mobile-title';
    var mainH1 = document.querySelector('main h1');
    if (mainH1) {
        pageTitle.textContent = mainH1.textContent;
        // Esconder o h1 original no mobile
        mainH1.classList.add('hide-on-mobile');
    }

    mobileTopbar.appendChild(btn);
    mobileTopbar.appendChild(mobileLogo);
    mobileTopbar.appendChild(pageTitle);
    
    document.body.prepend(mobileTopbar);

    // ─── 3. Overlay ──────────────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // ─── 5. Padronizar Datas ──────────────────────────────────────────
    document.querySelectorAll('input[type="date"]').forEach(function(input) {
        if (!input.value) {
            var today = new Date();
            var id = (input.id || "").toLowerCase();
            
            // Se for data de INÍCIO de filtro (ex: filtroInicio, filtroGastoInicio)
            if (id.includes('inicio') || id.includes('inicial') || id.includes('min')) {
                // Setar para o PRIMEIRO dia do mês atual
                var firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                firstDay.setMinutes(firstDay.getMinutes() - firstDay.getTimezoneOffset());
                input.value = firstDay.toISOString().split('T')[0];
            } 
            // Se for data FINAL (ex: filtroFim, filtroGastoFim)
            else if (id.includes('fim') || id.includes('final') || id.includes('max')) {
                // Setar para o ÚLTIMO dia do mês atual
                var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                lastDay.setMinutes(lastDay.getMinutes() - lastDay.getTimezoneOffset());
                input.value = lastDay.toISOString().split('T')[0];
            }
            // Para outros (ex: dataCompra, dataAtual, pcDataPrimeira)
            else {
                today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
                input.value = today.toISOString().split('T')[0];
            }
        }
    });

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
