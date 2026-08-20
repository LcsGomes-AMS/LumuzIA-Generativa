<?php
// ==========================================
// BACKEND PHP - Processa as requisições AJAX
// ==========================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'generate';

    // 1. Checa se o Ollama está rodando no servidor
    if ($action === 'check_status') {
        $ch = curl_init('http://127.0.0.1:11434/api/tags');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($code === 200 && $res) {
            $data = json_decode($res, true);
            $models = array_map(fn($m) => $m['name'], $data['models'] ?? []);
            echo json_encode(['online' => true, 'models' => $models]);
        } else {
            echo json_encode(['online' => false, 'models' => []]);
        }
        exit;
    }

    // 2. Envia pergunta para o Ollama
    if ($action === 'generate') {
        $model  = !empty($input['model'])  ? $input['model']  : 'llama3.2:1b';
        $system = !empty($input['system']) ? $input['system'] : '';
        $prompt = !empty($input['prompt']) ? $input['prompt'] : '';

        if (empty($prompt)) {
            echo json_encode(['success' => false, 'error' => 'Por favor, digite uma pergunta.']);
            exit;
        }

        $payload = [
            'model'  => $model,
            'prompt' => $prompt,
            'stream' => false
        ];

        if (!empty($system)) {
            $payload['system'] = $system;
        }

        $startTime = microtime(true);

        $ch = curl_init('http://127.0.0.1:11434/api/generate');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);

        $response  = curl_exec($ch);
        $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr   = curl_error($ch);
        curl_close($ch);

        $duration = round(microtime(true) - $startTime, 2);

        if ($httpCode === 200 && $response) {
            $json = json_decode($response, true);
            echo json_encode([
                'success'  => true,
                'resposta' => $json['response'] ?? 'Sem resposta.',
                'tempo'    => $duration . 's',
                'raw'      => $json
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error'   => $curlErr ?: "Ollama respondeu com Erro HTTP $httpCode",
                'tempo'   => $duration . 's'
            ]);
        }
        exit;
    }
}
?>

<!-- ========================================== -->
<!-- FRONTEND HTML / CSS / JAVASCRIPT          -->
<!-- ========================================== -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧪 Laboratório de Testes Ollama IA</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --border: #334155;
            --accent: #3b82f6;
            --accent-hover: #2563eb;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --success: #22c55e;
            --danger: #ef4444;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { background-color: var(--bg); color: var(--text); padding: 20px; min-height: 100vh; display: flex; justify-content: center; }
        
        .container { width: 100%; max-width: 850px; }
        
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border); }
        h1 { font-size: 1.4rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        
        .badge { font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .badge.online { background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid var(--success); }
        .badge.offline { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid var(--danger); }
        .badge.loading { background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid #eab308; }

        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        
        .form-group { margin-bottom: 15px; }
        label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        input, select, textarea { 
            width: 100%; background: #0f172a; border: 1px solid var(--border); 
            color: var(--text); padding: 12px; border-radius: 8px; font-size: 0.95rem; outline: none;
            transition: border-color 0.2s;
        }
        input:focus, select:focus, textarea:focus { border-color: var(--accent); }
        textarea { resize: vertical; min-height: 70px; }

        button { 
            width: 100%; background: var(--accent); color: white; border: none; 
            padding: 14px; border-radius: 8px; font-size: 1rem; font-weight: 600; 
            cursor: pointer; transition: background 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px;
        }
        button:hover { background: var(--accent-hover); }
        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .response-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .time-tag { font-size: 0.8rem; background: #334155; padding: 2px 8px; border-radius: 4px; color: var(--text-muted); }

        .response-box { 
            background: #0f172a; border: 1px solid var(--border); border-radius: 8px; 
            padding: 15px; min-height: 120px; white-space: pre-wrap; line-height: 1.6; font-size: 0.95rem;
        }

        details { margin-top: 15px; }
        summary { cursor: pointer; font-size: 0.85rem; color: var(--text-muted); font-weight: 600; }
        pre { background: #090d16; padding: 12px; border-radius: 6px; font-size: 0.8rem; margin-top: 8px; overflow-x: auto; color: #a5f3fc; }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>🧪 Testador de IA Ollama</h1>
        <div id="status-badge" class="badge loading">🟡 Checando servidor...</div>
    </header>

    <!-- Formulário de Teste -->
    <div class="card">
        <div class="form-group">
            <label for="model">Modelo Instalado</label>
            <select id="model">
                <option value="llama3.2:1b">llama3.2:1b (Padrão)</option>
            </select>
        </div>

        <div class="form-group">
            <label for="system">Instrução do Sistema (System Prompt) - Opcional</label>
            <textarea id="system" placeholder="Ex: Você é LumuzIA, uma assistente financeira amigável...">Você é LumuzIA, uma assistente virtual de IA especializada em finanças pessoais e investimentos.</textarea>
        </div>

        <div class="form-group">
            <label for="prompt">Sua Pergunta / Prompt</label>
            <textarea id="prompt" placeholder="Digite sua pergunta para a IA..."></textarea>
        </div>

        <button id="btn-submit" onclick="enviarTeste()">
            🚀 Enviar Pergunta
        </button>
    </div>

    <!-- Área da Resposta -->
    <div class="card" id="resposta-card" style="display: none;">
        <div class="response-header">
            <label>Resposta da IA</label>
            <span id="tempo-resposta" class="time-tag">⏱️ 0s</span>
        </div>
        <div id="resposta-box" class="response-box"></div>

        <details>
            <summary>🔍 Ver JSON Bruto de Debug</summary>
            <pre id="json-raw"></pre>
        </details>
    </div>
</div>

<script>
    // Executa ao carregar a página
    document.addEventListener('DOMContentLoaded', checarStatus);

    // 1. Checa se o Ollama está respondendo
    async function checarStatus() {
        const badge = document.getElementById('status-badge');
        const selectModel = document.getElementById('model');

        try {
            const res = await fetch('index.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_status' })
            });
            const data = await res.json();

            if (data.online) {
                badge.className = 'badge online';
                badge.innerHTML = '🟢 Ollama Conectado (127.0.0.1)';

                // Atualiza o select com modelos instalados
                if (data.models && data.models.length > 0) {
                    selectModel.innerHTML = '';
                    data.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.textContent = m;
                        selectModel.appendChild(opt);
                    });
                }
            } else {
                badge.className = 'badge offline';
                badge.innerHTML = '🔴 Ollama Indisponível';
            }
        } catch (e) {
            badge.className = 'badge offline';
            badge.innerHTML = '🔴 Erro de conexão com o PHP';
        }
    }

    // 2. Envia a pergunta
    async function enviarTeste() {
        const btn = document.getElementById('btn-submit');
        const promptInput = document.getElementById('prompt');
        const systemInput = document.getElementById('system');
        const modelSelect = document.getElementById('model');

        const respostaCard = document.getElementById('resposta-card');
        const respostaBox  = document.getElementById('resposta-box');
        const tempoTag     = document.getElementById('tempo-resposta');
        const jsonRaw      = document.getElementById('json-raw');

        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert('Por favor, digite uma pergunta.');
            return;
        }

        // Estado de Carregamento
        btn.disabled = true;
        btn.innerHTML = '⏳ Processando resposta...';
        respostaCard.style.display = 'block';
        respostaBox.innerHTML = '<i>Processando com o modelo local...</i>';
        tempoTag.textContent = '⏱️ Calculando...';
        jsonRaw.textContent = '';

        try {
            const res = await fetch('index.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate',
                    model: modelSelect.value,
                    system: systemInput.value.trim(),
                    prompt: prompt
                })
            });

            const data = await res.json();

            if (data.success) {
                respostaBox.textContent = data.resposta;
                tempoTag.textContent = `⚡ Resposta em ${data.tempo}`;
                jsonRaw.textContent = JSON.stringify(data.raw, null, 2);
            } else {
                respostaBox.innerHTML = `<span style="color: var(--danger)">Erro: ${data.error}</span>`;
                tempoTag.textContent = `⏱️ Falhou (${data.tempo})`;
            }

        } catch (err) {
            respostaBox.innerHTML = `<span style="color: var(--danger)">Erro de Comunicação com o servidor PHP.</span>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🚀 Enviar Pergunta';
        }
    }
</script>

</body>
</html>