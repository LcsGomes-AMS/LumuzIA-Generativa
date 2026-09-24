<?php
// Permite requisições vindas do Render ou de qualquer outra origem (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Define tempo limite de execução do PHP para cobrir os 3 minutos de requisição
set_time_limit(200);
ini_set('max_execution_time', '200');

// Trata a requisição Preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$ollamaHost = "http://127.0.0.1:11434";

// ==========================================
// FUNÇÕES AUXILIARES DE MEMÓRIA E CACHE
// ==========================================

/**
 * Lê estatísticas de memória do Linux (/proc/meminfo)
 */
function getSystemMemoryStats() {
    $data = @file_get_contents('/proc/meminfo');
    if (!$data) {
        return ['total_mb' => 0, 'available_mb' => 0, 'used_percent' => 0];
    }
    preg_match('/MemTotal:\s+(\d+)/', $data, $mTotal);
    preg_match('/MemAvailable:\s+(\d+)/', $data, $mAvail);
    $totalKb = (int)($mTotal[1] ?? 0);
    $availKb = (int)($mAvail[1] ?? 0);
    $usedKb  = $totalKb - $availKb;
    $usedPercent = $totalKb > 0 ? round(($usedKb / $totalKb) * 100, 2) : 0;
    return [
        'total_mb'     => round($totalKb / 1024, 2),
        'available_mb' => round($availKb / 1024, 2),
        'used_percent' => $usedPercent
    ];
}

/**
 * Descarrega modelos inativos da memória do Ollama sem interromper o serviço
 */
function clearOllamaMemoryCache($ollamaHost) {
    $ch = curl_init("$ollamaHost/api/ps");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $res = curl_exec($ch);
    curl_close($ch);

    $cleared = [];
    if ($res) {
        $json = json_decode($res, true);
        $models = $json['models'] ?? [];
        foreach ($models as $m) {
            $modelName = $m['name'] ?? ($m['model'] ?? '');
            if (!empty($modelName)) {
                $chU = curl_init("$ollamaHost/api/generate");
                curl_setopt($chU, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chU, CURLOPT_POST, true);
                curl_setopt($chU, CURLOPT_POSTFIELDS, json_encode([
                    'model' => $modelName,
                    'keep_alive' => 0
                ]));
                curl_setopt($chU, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                curl_setopt($chU, CURLOPT_TIMEOUT, 10);
                curl_exec($chU);
                curl_close($chU);
                $cleared[] = $modelName;
            }
        }
    }
    return $cleared;
}

// Lê o corpo da requisição JSON
$inputRaw = file_get_contents("php://input");
$data = json_decode($inputRaw, true) ?: [];
$action = $data['action'] ?? '';

// ==========================================
// 1. AÇÃO: CHECK_STATUS
// ==========================================
if ($action === 'check_status') {
    $ch = curl_init("$ollamaHost/api/tags");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $json = json_decode($response, true);
        $models = array_map(function($m) { return $m['name']; }, $json['models'] ?? []);
        
        echo json_encode([
            'online' => true,
            'models' => $models,
            'memory' => getSystemMemoryStats()
        ]);
    } else {
        echo json_encode([
            'online' => false,
            'error' => 'Ollama não está respondendo na porta 11434 local',
            'memory' => getSystemMemoryStats()
        ]);
    }
    exit();
}

// ==========================================
// 2. AÇÃO: CLEAR_CACHE (Limpeza explícita ou por limite)
// ==========================================
if ($action === 'clear_cache') {
    $maxMemoryPercent = (float)($data['max_memory_percent'] ?? 70.0);
    $force = !empty($data['force']);
    $memBefore = getSystemMemoryStats();

    $shouldClean = $force || ($memBefore['used_percent'] >= $maxMemoryPercent);
    $clearedModels = [];

    if ($shouldClean) {
        $clearedModels = clearOllamaMemoryCache($ollamaHost);
        // Pequena pausa para o sistema desalocar
        usleep(500000);
    }

    $memAfter = getSystemMemoryStats();

    echo json_encode([
        'success'           => true,
        'action_performed'  => $shouldClean ? 'cache_cleared' : 'threshold_not_reached',
        'limit_percent'     => $maxMemoryPercent,
        'memory_before'     => $memBefore,
        'memory_after'      => $memAfter,
        'models_cleared'    => $clearedModels
    ]);
    exit();
}

// ==========================================
// 3. AÇÃO: GENERATE (Processa a resposta sem afetar o pensamento, e limpa se exceder o limite)
// ==========================================
if ($action === 'generate') {
    $model  = $data['model']  ?? 'llama3.2:1b';
    $system = $data['system'] ?? '';
    $prompt = $data['prompt'] ?? '';
    $maxMemoryPercent = (float)($data['max_memory_percent'] ?? 70.0);
    $autoClean = isset($data['auto_clean']) ? (bool)$data['auto_clean'] : true;

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
    $memBefore = getSystemMemoryStats();

    // 1. Processa a requisição completa no Ollama (pensamento ocorre sem nenhuma interrupção)
    $ch = curl_init("$ollamaHost/api/generate");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 180); // 3 minutos

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    $duration = round(microtime(true) - $startTime, 2) . 's';

    // 2. Após o pensamento ter sido finalizado com sucesso, verificamos o uso de memória
    $cacheCleaned = false;
    $clearedModels = [];
    $memDuring = getSystemMemoryStats();

    if ($autoClean && ($memDuring['used_percent'] >= $maxMemoryPercent)) {
        // Se ultrapassou o limite máximo permitido, limpa o cache de modelos da memória
        $clearedModels = clearOllamaMemoryCache($ollamaHost);
        $cacheCleaned = true;
        usleep(500000);
    }

    $memAfter = getSystemMemoryStats();

    if ($httpCode === 200 && $response) {
        $resData = json_decode($response, true);
        echo json_encode([
            'success'        => true,
            'resposta'       => $resData['response'] ?? '',
            'tempo'          => $duration,
            'cache_cleaned'  => $cacheCleaned,
            'limit_percent'  => $maxMemoryPercent,
            'models_cleared' => $clearedModels,
            'memory'         => [
                'before' => $memBefore,
                'during' => $memDuring,
                'after'  => $memAfter
            ],
            'raw'            => $resData
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error'   => $curlErr ?: "Erro HTTP $httpCode do Ollama local.",
            'tempo'   => $duration,
            'memory'  => $memAfter
        ]);
    }
    exit();
}

// Ação não informada ou inválida
echo json_encode([
    'success' => false, 
    'error' => 'Ação não reconhecida. Use action="generate", "check_status" ou "clear_cache".'
]);