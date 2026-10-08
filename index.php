<?php
declare(strict_types=1);

// Ponte exclusiva entre servidores: o navegador chama apenas a API Node autenticada.
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
ini_set('display_errors', '0');
set_time_limit(60);

function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function reject(int $status, string $message): never {
    respond($status, ['success' => false, 'error' => $message]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reject(405, 'Método não permitido.');
}
if (isset($_SERVER['HTTP_ORIGIN'])) {
    reject(403, 'Acesso negado.');
}

$bridgeSecret = getenv('OLLAMA_BRIDGE_SECRET');
if (!is_string($bridgeSecret) || strlen($bridgeSecret) < 32 || strlen($bridgeSecret) > 256 ||
    preg_match('/[\x00-\x20\x7f]/', $bridgeSecret)) {
    reject(503, 'Serviço indisponível.');
}
$providedSecret = $_SERVER['HTTP_X_LUMUZ_BRIDGE_SECRET'] ?? '';
if (!is_string($providedSecret) || !hash_equals($bridgeSecret, $providedSecret)) {
    reject(401, 'Autenticação necessária.');
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (!preg_match('/^application\/json(?:\s*;[^\r\n]*)?$/i', $contentType)) {
    reject(415, 'Envie JSON válido.');
}
if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > 32768) {
    reject(413, 'Requisição muito grande.');
}
$input = fopen('php://input', 'rb');
$inputRaw = $input ? stream_get_contents($input, 32769) : false;
if ($input) fclose($input);
if ($inputRaw === false || strlen($inputRaw) > 32768) {
    reject(413, 'Requisição muito grande.');
}
try {
    $decoded = json_decode($inputRaw, false, 8, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
    reject(400, 'JSON inválido.');
}
if (!is_object($decoded)) reject(400, 'Requisição inválida.');
$data = get_object_vars($decoded);
foreach (array_keys($data) as $key) {
    if (!in_array($key, ['action', 'model', 'prompt', 'system'], true)) {
        reject(400, 'Requisição inválida.');
    }
}
$action = $data['action'] ?? null;
if (!in_array($action, ['generate', 'check_status'], true)) {
    reject(400, 'Ação inválida.');
}

$model = getenv('OLLAMA_MODEL') ?: 'llama3.2:1b';
if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._:\/-]{0,127}$/', $model)) {
    reject(503, 'Serviço indisponível.');
}
if (isset($data['model']) && (!is_string($data['model']) || $data['model'] !== $model)) {
    reject(400, 'Modelo não permitido.');
}
if ($action === 'generate') {
    $prompt = $data['prompt'] ?? null;
    $system = $data['system'] ?? '';
    if (!is_string($prompt) || trim($prompt) === '' || strlen($prompt) > 12000 ||
        !is_string($system) || strlen($system) > 8000) {
        reject(400, 'Requisição inválida.');
    }
}

// Limites independentes da API pública: orçamento global e uma geração por vez.
// Arquivos ficam no diretório temporário privado, fora da raiz publicada.
$stateDirectory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'lumuz-bridge-' . substr(hash('sha256', __FILE__), 0, 24);
if (!is_dir($stateDirectory) && !@mkdir($stateDirectory, 0700, true) && !is_dir($stateDirectory)) {
    reject(503, 'Serviço indisponível.');
}
$lock = @fopen($stateDirectory . DIRECTORY_SEPARATOR . 'request.lock', 'c+');
if (!$lock) reject(503, 'Serviço indisponível.');
@chmod($stateDirectory . DIRECTORY_SEPARATOR . 'request.lock', 0600);
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    fclose($lock);
    header('Retry-After: 5');
    reject(429, 'Tente novamente mais tarde.');
}
register_shutdown_function(static function () use ($lock): void {
    flock($lock, LOCK_UN);
    fclose($lock);
});
$quotaPath = $stateDirectory . DIRECTORY_SEPARATOR . 'quota.json';
$quotaRaw = @file_get_contents($quotaPath);
$quota = is_string($quotaRaw) ? json_decode($quotaRaw, true) : null;
$now = time();
if (!is_array($quota) || !isset($quota['started'], $quota['count']) ||
    $now - (int)$quota['started'] >= 60 || $now < (int)$quota['started']) {
    $quota = ['started' => $now, 'count' => 0];
}
if ((int)$quota['count'] >= 30) {
    header('Retry-After: ' . max(1, 60 - ($now - (int)$quota['started'])));
    reject(429, 'Tente novamente mais tarde.');
}
$quota['count'] = (int)$quota['count'] + 1;
if (@file_put_contents($quotaPath, json_encode($quota), LOCK_EX) === false) {
    reject(503, 'Serviço indisponível.');
}
@chmod($quotaPath, 0600);

if (!function_exists('curl_init')) reject(503, 'Serviço indisponível.');

// O destino é fixo. Nenhum campo do cliente pode trocar host, porta ou endpoint.
$endpoint = $action === 'check_status' ? '/api/tags' : '/api/generate';
$ch = curl_init('http://127.0.0.1:11434' . $endpoint);
if ($ch === false) reject(503, 'Serviço indisponível.');
$response = '';
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => $action === 'generate' ? 55 : 5,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_MAXREDIRS => 0,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTP,
    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP,
    CURLOPT_PROXY => '',
    CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$response): int {
        if (strlen($response) + strlen($chunk) > 262144) return 0;
        $response .= $chunk;
        return strlen($chunk);
    }
]);
if ($action === 'generate') {
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model,
            'prompt' => $prompt,
            'system' => $system,
            'stream' => false,
            'options' => ['num_predict' => 1024, 'num_ctx' => 4096]
        ], JSON_THROW_ON_ERROR)
    ]);
}
$completed = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($completed === false || $status !== 200) {
    reject(502, 'Serviço de IA indisponível.');
}
if ($action === 'check_status') {
    respond(200, ['success' => true, 'online' => true]);
}
try {
    $result = json_decode($response, true, 32, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
    reject(502, 'Resposta de IA inválida.');
}
$answer = $result['response'] ?? null;
if (!is_string($answer) || trim($answer) === '' || strlen($answer) > 64000 ||
    (function_exists('mb_strlen') && mb_strlen($answer, 'UTF-8') > 16000)) {
    reject(502, 'Resposta de IA inválida.');
}
respond(200, ['success' => true, 'resposta' => $answer]);