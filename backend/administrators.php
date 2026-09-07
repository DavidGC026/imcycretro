<?php
declare(strict_types=1);

function confirmAdministratorPassword(array $admin, array $body): void
{
    rateLimit('admin-credentials', (string) $admin['id'], 20, 900);
    $password = $body['currentPassword'] ?? null;
    if (!is_string($password) || strlen($password) > 1024 || !password_verify($password, $admin['password_hash'])) {
        throw new HttpError(422, 'Tu contraseña actual es incorrecta. Revisa la contraseña de la cuenta con la que iniciaste sesión.');
    }
}

function listAdministrators(): array
{
    $current = requireAdmin();
    $rows = database()->query('SELECT id, username, created_at FROM administrators ORDER BY username, id')->fetchAll();
    $users = array_map(static fn(array $row): array => [
        'id' => (int) $row['id'], 'username' => $row['username'],
        'created_at' => str_replace(' ', 'T', $row['created_at']) . 'Z',
        'isCurrent' => (int) $row['id'] === (int) $current['id'],
    ], $rows);
    return ['users' => $users];
}

function createAdministrator(array $body): array
{
    $admin = requireAdmin();
    $username = validateAdministratorUsername($body);
    $password = validateNewPassword($body);
    confirmAdministratorPassword($admin, $body);
    $hash = password_hash($password, PASSWORD_ARGON2ID);
    try {
        $statement = database()->prepare('INSERT INTO administrators (username, password_hash) VALUES (?, ?)');
        $statement->execute([$username, $hash]);
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? null) === 1062) throw new HttpError(409, 'Ese nombre de usuario ya está registrado. Elige otro.');
        throw $error;
    }
    return ['created' => true, 'username' => $username];
}

function changeAdministratorPassword(array $body): array
{
    $admin = requireAdmin();
    $id = $body['id'] ?? null;
    if (!is_int($id) || $id <= 0) throw new HttpError(422, 'Selecciona un usuario válido.');
    $password = validateNewPassword($body);
    confirmAdministratorPassword($admin, $body);
    $connection = database();
    $statement = $connection->prepare('SELECT id, username, password_hash FROM administrators WHERE id = ?');
    $statement->execute([$id]);
    $target = $statement->fetch();
    if (!$target) throw new HttpError(404, 'El usuario ya no está disponible. Actualiza el listado.');
    if (password_verify($password, $target['password_hash'])) throw new HttpError(422, 'Elige una contraseña diferente a la anterior.');
    $hash = password_hash($password, PASSWORD_ARGON2ID);
    $statement = $connection->prepare('UPDATE administrators SET password_hash = ? WHERE id = ? AND password_hash = ?');
    $statement->execute([$hash, $id, $target['password_hash']]);
    if ($statement->rowCount() !== 1) throw new HttpError(409, 'La contraseña cambió durante esta operación. Intenta nuevamente.');

    if ($id === (int) $admin['id']) {
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        $_SESSION['admin_signature'] = hash('sha256', $hash);
    }
    return ['changed' => true, 'csrf' => $_SESSION['csrf'], 'username' => $target['username']];
}
