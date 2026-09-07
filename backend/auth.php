<?php
declare(strict_types=1);

function sessionStatus(): array
{
    $admin = authenticatedAdministrator();
    return [
        'csrf' => $_SESSION['csrf'], 'authenticated' => $admin !== null,
        'username' => $admin['username'] ?? null,
    ];
}

function clearAdministratorSession(): void
{
    unset($_SESSION['admin_id'], $_SESSION['admin_username'], $_SESSION['admin_expires'], $_SESSION['admin_signature']);
}

function authenticatedAdministrator(): ?array
{
    if (empty($_SESSION['admin_id'])) return null;
    $statement = database()->prepare('SELECT id, username, password_hash FROM administrators WHERE id = ?');
    $statement->execute([$_SESSION['admin_id']]);
    $admin = $statement->fetch();
    // Cambiar la contraseña invalida las sesiones creadas con la clave anterior.
    if (!$admin || !hash_equals(hash('sha256', $admin['password_hash']), $_SESSION['admin_signature'] ?? '')) {
        clearAdministratorSession();
        return null;
    }
    return $admin;
}

function login(array $body): array
{
    $username = requiredText($body, 'username', 'usuario', 100);
    $password = $body['password'] ?? '';
    if (!is_string($password) || strlen($password) > 1024) throw new HttpError(422, 'Revisa la contraseña.');
    rateLimit('login-ip', $_SERVER['REMOTE_ADDR'] ?? 'unknown', 20, 900);
    rateLimit('login-user', strtolower($username), 10, 900);
    $statement = database()->prepare('SELECT id, username, password_hash FROM administrators WHERE username = ?');
    $statement->execute([$username]);
    $admin = $statement->fetch();
    $fallbackHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $valid = password_verify($password, $admin ? $admin['password_hash'] : $fallbackHash);
    if (!$admin || !$valid) throw new HttpError(401, 'Usuario o contraseña incorrectos.');
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['admin_expires'] = time() + 8 * 3600;
    $_SESSION['admin_signature'] = hash('sha256', $admin['password_hash']);
    return sessionStatus();
}

function logout(): array
{
    clearAdministratorSession();
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return sessionStatus();
}
