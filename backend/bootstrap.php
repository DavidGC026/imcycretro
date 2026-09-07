<?php
declare(strict_types=1);

require_once __DIR__ . '/validation.php';

function config(): array
{
    static $config;
    if ($config === null) {
        $path = getenv('EXP_IMCYC_CONFIG') ?: '/etc/exp-imcyc/config.php';
        if (!is_readable($path)) throw new RuntimeException('Configuration unavailable.');
        $config = require $path;
    }
    return $config;
}

function database(): PDO
{
    static $connection;
    if ($connection === null) {
        $settings = config();
        $connection = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $settings['db_host'], $settings['db_port'], $settings['db_name']),
            $settings['db_user'], $settings['db_password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
        );
        $connection->exec("SET time_zone = '+00:00'");
    }
    return $connection;
}

function beginSession(): void
{
    $settings = config();
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_name('exp_imcyc_session');
    session_save_path($settings['session_path']);
    session_set_cookie_params([
        'lifetime' => 0, 'path' => $settings['cookie_path'],
        'secure' => $settings['cookie_secure'], 'httponly' => true, 'samesite' => 'Lax',
    ]);
    session_start();
    if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    if (isset($_SESSION['admin_expires']) && $_SESSION['admin_expires'] <= time()) {
        unset($_SESSION['admin_id'], $_SESSION['admin_username'], $_SESSION['admin_expires'], $_SESSION['admin_signature']);
    }
}

function respond(array $result, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function readBody(): array
{
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
        throw new HttpError(415, 'Envía la información en formato JSON.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if ($raw === false || strlen($raw) > 32768) throw new HttpError(413, 'La solicitud es demasiado grande.');
    try {
        $body = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new HttpError(400, 'La información enviada no es válida.');
    }
    if (!is_array($body) || !str_starts_with(ltrim($raw), '{')) throw new HttpError(400, 'La información enviada no es válida.');
    return $body;
}

function requireWriteAccess(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin !== null && $origin !== config()['app_origin']) throw new HttpError(403, 'Origen de solicitud no permitido.');
    $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($csrf) || !hash_equals($_SESSION['csrf'], $csrf)) {
        throw new HttpError(403, 'Tu sesión cambió. Intenta nuevamente.');
    }
}

function requireAdmin(): array
{
    $admin = authenticatedAdministrator();
    if (!$admin) throw new HttpError(401, 'Tu sesión terminó. Inicia sesión nuevamente.');
    return $admin;
}

function rateLimit(string $scope, string $identity, int $limit, int $seconds): void
{
    $connection = database();
    $bucket = hash_hmac('sha256', $scope . ':' . $identity, config()['rate_limit_secret']);
    $statement = $connection->prepare('INSERT INTO request_limits (bucket, attempts, expires_at) VALUES (?, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE attempts = IF(expires_at <= UTC_TIMESTAMP(), 1, attempts + 1),
        expires_at = IF(expires_at <= UTC_TIMESTAMP(), VALUES(expires_at), expires_at)');
    $statement->execute([$bucket, $seconds]);
    $statement = $connection->prepare('SELECT attempts FROM request_limits WHERE bucket = ?');
    $statement->execute([$bucket]);
    if ((int) $statement->fetchColumn() > $limit) {
        header('Retry-After: ' . $seconds);
        throw new HttpError(429, 'Se realizaron demasiados intentos. Espera unos minutos antes de volver a intentar.');
    }
    if (random_int(1, 100) === 1) $connection->exec('DELETE FROM request_limits WHERE expires_at < UTC_TIMESTAMP() LIMIT 1000');
}

function serializeRegistration(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['service_rating'] = $row['service_rating'] === null ? null : (int) $row['service_rating'];
    foreach (['created_at', 'completed_at'] as $key) {
        if ($row[$key] !== null) $row[$key] = str_replace(' ', 'T', $row[$key]) . 'Z';
    }
    return $row;
}
