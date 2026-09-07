<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/administrators.php';
require_once __DIR__ . '/registrations.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

try {
    beginSession();
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $getActions = ['session', 'registration.current', 'admin.registrations', 'admin.users'];
    $postActions = ['login', 'logout', 'registration.save', 'registration.reset', 'survey.submit', 'admin.users.create', 'admin.users.password'];
    if (!is_string($action) || !in_array($action, array_merge($getActions, $postActions), true)) throw new HttpError(404, 'Ruta no encontrada.');
    $expectedMethod = in_array($action, $getActions, true) ? 'GET' : 'POST';
    if ($method !== $expectedMethod) {
        header('Allow: ' . $expectedMethod);
        throw new HttpError(405, 'Método no permitido.');
    }
    $body = [];
    if ($method === 'POST') {
        requireWriteAccess();
        $body = readBody();
    }
    if ($action === 'registration.reset') {
        unset($_SESSION['registration_id']);
        respond(['reset' => true]);
    }
    respond(match ($action) {
        'session' => sessionStatus(),
        'login' => login($body),
        'logout' => logout(),
        'registration.current' => currentRegistration(),
        'registration.save' => saveIdentity($body),
        'survey.submit' => submitSurvey($body),
        'admin.registrations' => listRegistrations($_GET),
        'admin.users' => listAdministrators(),
        'admin.users.create' => createAdministrator($body),
        'admin.users.password' => changeAdministratorPassword($body),
    });
} catch (HttpError $error) {
    respond(['error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log('EXP IMCYC: ' . get_class($error) . ': ' . $error->getMessage());
    respond(['error' => 'No pudimos guardar o consultar la información. Intenta nuevamente.'], 500);
}
