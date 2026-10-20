<?php
declare(strict_types=1);

require dirname(__DIR__) . '/backend/cms-bridge.php';

$checks = 0;
function bridgeCheck(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function bridgeRejects(callable $operation, int $status): void
{
    try { $operation(); }
    catch (HttpError $error) { bridgeCheck($error->status === $status, 'Unexpected rejection status.'); return; }
    throw new RuntimeException('An invalid bridge request was accepted.');
}
function signedHeaders(string $body, string $secret, int $timestamp, ?string $nonce = null): array
{
    $nonce ??= bin2hex(random_bytes(32));
    return [
        'REQUEST_METHOD' => 'POST', 'HTTP_X_IMCYC_CMS_TIMESTAMP' => (string) $timestamp,
        'HTTP_X_IMCYC_CMS_NONCE' => $nonce,
        'HTTP_X_IMCYC_CMS_SIGNATURE' => hash_hmac('sha256', $timestamp . "\n" . $nonce . "\n" . $body, $secret),
    ];
}

$directory = sys_get_temp_dir() . '/imcyc-cms-bridge-test-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
$settings = ['secret' => bin2hex(random_bytes(32)), 'nonce_path' => $directory . '/nonces'];
$body = '{"action":"sheet.status","params":{}}';
$now = time();
$previousConfig = getenv('EXP_IMCYC_CMS_CONFIG');
try {
    putenv('EXP_IMCYC_CMS_CONFIG=' . $directory . '/missing.php');
    bridgeRejects(fn() => cmsBridgeSettings(), 503);
    $configFile = $directory . '/bridge.php';
    file_put_contents($configFile, '<?php return ' . var_export($settings, true) . ';');
    chmod($configFile, 0600);
    putenv('EXP_IMCYC_CMS_CONFIG=' . $configFile);
    bridgeCheck(cmsBridgeSettings() === $settings, 'Private bridge settings load independently.');
    chmod($configFile, 0644);
    clearstatcache(true, $configFile);
    bridgeRejects(fn() => cmsBridgeSettings(), 503);
    chmod($configFile, 0600);
    clearstatcache(true, $configFile);
    $headers = signedHeaders($body, $settings['secret'], $now);
    authenticateCmsBridge($headers, $body, $settings, $now);
    $nonceFile = $settings['nonce_path'] . '/' . hash('sha256', $headers['HTTP_X_IMCYC_CMS_NONCE']);
    bridgeCheck(is_file($nonceFile), 'A valid request claims its nonce.');
    bridgeCheck((fileperms($nonceFile) & 0077) === 0, 'Nonce files are private.');
    bridgeCheck((fileperms($settings['nonce_path']) & 0077) === 0, 'Nonce directory is private.');
    bridgeRejects(fn() => authenticateCmsBridge($headers, $body, $settings, $now), 409);
    bridgeCheck(session_status() === PHP_SESSION_NONE && session_id() === '', 'Bridge authentication must not open participant/admin sessions.');
    bridgeRejects(fn() => authenticateCmsBridge([], $body, $settings, $now), 405);
    bridgeRejects(fn() => authenticateCmsBridge(['REQUEST_METHOD' => 'POST'], $body, $settings, $now), 401);
    foreach ([-61, 61] as $offset) bridgeRejects(fn() => authenticateCmsBridge(signedHeaders($body, $settings['secret'], $now + $offset), $body, $settings, $now), 401);
    foreach ([-60, 60] as $offset) authenticateCmsBridge(signedHeaders($body, $settings['secret'], $now + $offset), $body, $settings, $now);
    $wrongSignature = signedHeaders($body, 'a-different-fictitious-signing-secret', $now);
    bridgeRejects(fn() => authenticateCmsBridge($wrongSignature, $body, $settings, $now), 401);
    bridgeCheck(!file_exists($settings['nonce_path'] . '/' . hash('sha256', $wrongSignature['HTTP_X_IMCYC_CMS_NONCE'])), 'Invalid signatures must not fill the replay cache.');
    $exactBodyHeaders = signedHeaders($body, $settings['secret'], $now);
    bridgeRejects(fn() => authenticateCmsBridge($exactBodyHeaders, $body . "\n", $settings, $now), 401);
    authenticateCmsBridge($exactBodyHeaders, $body, $settings, $now);
    $unsafeNonce = signedHeaders($body, $settings['secret'], $now);
    $unsafeNonce['HTTP_X_IMCYC_CMS_NONCE'] = '../unsafe';
    bridgeRejects(fn() => authenticateCmsBridge($unsafeNonce, $body, $settings, $now), 401);
    bridgeRejects(fn() => authenticateCmsBridge($headers, str_repeat('x', CMS_BRIDGE_MAX_BODY + 1), $settings, $now), 413);
    bridgeCheck(cmsBridgeEnvelope($body) === ['sheet.status', []], 'Bridge envelope accepts the agreed action/params contract.');
    foreach (['login', 'logout', 'admin.users', 'registration.save', 'survey.submit'] as $action) {
        bridgeRejects(fn() => cmsBridgeEnvelope(json_encode(['action' => $action, 'params' => new stdClass()])), 404);
    }
    bridgeRejects(fn() => cmsBridgeEnvelope('[]'), 404);
    bridgeRejects(fn() => cmsBridgeEnvelope('{'), 400);
    bridgeRejects(fn() => cmsBridgeEnvelope('{"action":"registrations.list","params":[]}'), 422);
    foreach ([0, -1, '1', 1.5, null, []] as $id) bridgeRejects(fn() => cmsBridgeRegistrationId(['id' => $id]), 422);
    bridgeCheck(cmsBridgeRegistrationId(['id' => 1]) === 1, 'Bridge identifiers must be positive JSON integers.');
    $expiredFile = $settings['nonce_path'] . '/' . str_repeat('f', 64);
    file_put_contents($expiredFile, 'expired'); chmod($expiredFile, 0600); touch($expiredFile, $now - 181);
    authenticateCmsBridge(signedHeaders($body, $settings['secret'], $now), $body, $settings, $now);
    bridgeCheck(!file_exists($expiredFile) && file_exists($nonceFile), 'Cleanup only removes old nonces beyond the replay window.');
    echo "$checks bridge validations passed.\n";
} finally {
    if ($previousConfig === false) putenv('EXP_IMCYC_CMS_CONFIG'); else putenv('EXP_IMCYC_CMS_CONFIG=' . $previousConfig);
    foreach (glob($settings['nonce_path'] . '/*') ?: [] as $file) unlink($file);
    if (is_dir($settings['nonce_path'])) rmdir($settings['nonce_path']);
    if (is_file($configFile)) unlink($configFile);
    rmdir($directory);
}
