<?php
// Permite requisições vindas do Render ou de qualquer outra origem (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Trata a requisição Preflight (OPTIONS) enviada pelos navegadores/Axios
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Endereço local onde o serviço Ollama está rodando no servidor
$ollamaHost = "http://127.0.0.1:11434";

// Lê o corpo da requisição JSON enviada pelo Render
$inputRaw = file_get_contents("php://input");
$data = json_decode($inputRaw, true);

$action = $data['action'] ?? '';

// ==========================================
// 1. AÇÃO: CHECK_STATUS (Verifica se o Ollama está online)
// ==========================================
if ($action === 'check_status') {
    $ch = curl_init("$ollamaHost/api/tags");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $json = json_decode($response, true);
        $models = array_map(function($m) { return $m['name']; }, $json['models'] ?? []);
        
        echo json_encode([
            'online' => true,
            'models' => $models
        ]);
    } else {
        echo json_encode([
            'online' => false,
            'error' => 'Ollama não está respondendo na porta 11434 local'
        ]);
    }
    exit();
}

// ==========================================
// 2. AÇÃO: GENERATE (Processa a pergunta com a IA)
// ==========================================
if ($action === 'generate') {
    $model  = $data['model']  ?? 'llama3.2:1b';
    $system = $data['system'] ?? '';
    $prompt = $data['prompt'] ?? '';

    if (empty($prompt)) {
        echo json_encode(['success' => false, 'error' => 'O campo prompt é obrigatório.']);
        exit();
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

    // Envia a requisição para o Ollama local
    $ch = curl_init("$ollamaHost/api/generate");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    $duration = round(microtime(true) - $startTime, 2) . 's';

    if ($httpCode === 200 && $response) {
        $resData = json_decode($response, true);
        echo json_encode([
            'success'  => true,
            'resposta' => $resData['response'] ?? '',
            'tempo'    => $duration,
            'raw'      => $resData
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error'   => $curlErr ?: "Erro HTTP $httpCode do Ollama local.",
            'tempo'   => $duration
        ]);
    }
    exit();
}

// Ação não informada ou inválida
echo json_encode(['success' => false, 'error' => 'Ação não reconhecida. Use action="generate" ou action="check_status".']);