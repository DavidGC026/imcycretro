<?php
declare(strict_types=1);

require_once __DIR__ . '/sheet-sync.php';

function saveIdentity(array $body): array
{
    [$name, $company, $email] = validateIdentity($body);
    rateLimit('registration', $_SERVER['REMOTE_ADDR'] ?? 'unknown', 120, 3600);
    $connection = database();
    $existingId = $_SESSION['registration_id'] ?? null;
    if ($existingId !== null) {
        $statement = $connection->prepare('SELECT completed_at FROM registrations WHERE id = ?');
        $statement->execute([$existingId]);
        $existing = $statement->fetch();
        if ($existing && $existing['completed_at'] !== null) {
            throw new HttpError(409, 'Este registro ya tiene un kit. Reinicia para registrar a otra persona.');
        }
        if ($existing) {
            $statement = $connection->prepare('UPDATE registrations SET full_name = ?, company = ?, email = ? WHERE id = ?');
            $statement->execute([$name, $company, $email, $existingId]);
            return ['saved' => true];
        }
    }
    $statement = $connection->prepare('INSERT INTO registrations (full_name, company, email) VALUES (?, ?, ?)');
    $statement->execute([$name, $company, $email]);
    $_SESSION['registration_id'] = (int) $connection->lastInsertId();
    return ['saved' => true];
}

function submitSurvey(array $body): array
{
    [$service, $application, $clarity, $rating, $opinionConsent] = validateSurvey($body);
    if (empty($_SESSION['registration_id'])) throw new HttpError(409, 'Ingresa tus datos antes de responder la encuesta.');
    $connection = database();
    $connection->beginTransaction();
    try {
        $statement = $connection->prepare('SELECT unique_code, completed_at FROM registrations WHERE id = ? FOR UPDATE');
        $statement->execute([$_SESSION['registration_id']]);
        $registration = $statement->fetch();
        if (!$registration) throw new HttpError(409, 'Tu registro no está disponible. Ingresa tus datos nuevamente.');
        // Un reintento de red conserva el folio y las respuestas originales.
        if ($registration['completed_at'] === null) {
            $registration['unique_code'] = 'IMCYC-' . strtoupper(bin2hex(random_bytes(8)));
            $registration['completed_at'] = gmdate('Y-m-d H:i:s');
            $statement = $connection->prepare('UPDATE registrations SET service = ?, application = ?, clarity = ?, service_rating = ?, unique_code = ?, discount_text = ?, completed_at = ?, opinion_consent = ?, opinion_consent_at = ?, opinion_consent_text = ? WHERE id = ?');
            $statement->execute([$service, $application, $clarity, $rating, $registration['unique_code'], DISCOUNT_TEXT, $registration['completed_at'],
                $opinionConsent === null ? null : (int) $opinionConsent,
                $opinionConsent === null ? null : $registration['completed_at'],
                $opinionConsent === null ? null : OPINION_CONSENT_TEXT, $_SESSION['registration_id']]);
        }
        $connection->commit();
        // La copia en la hoja ocurre con el registro ya guardado: si Google falla,
        // el participante conserva su folio y scripts/sync-sheet.php lo recupera.
        pushRegistrationToSheet((int) $_SESSION['registration_id']);
        return ['code' => $registration['unique_code'], 'issuedAt' => str_replace(' ', 'T', $registration['completed_at']) . 'Z'];
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
}

/**
 * Borra un registro desde el panel y quita su fila de la hoja. La base manda:
 * si la hoja no responde, el registro se borra igual y queda una fila huérfana
 * que la recarga completa limpia.
 */
function deleteRegistration(array $body): array
{
    requireAdmin();
    $id = $body['id'] ?? null;
    if (!is_int($id) || $id < 1) throw new HttpError(422, 'Registro no válido.');
    $connection = database();
    $statement = $connection->prepare('SELECT full_name FROM registrations WHERE id = ?');
    $statement->execute([$id]);
    $registration = $statement->fetch();
    if (!$registration) throw new HttpError(404, 'Ese registro ya no existe.');

    $statement = $connection->prepare('DELETE FROM registrations WHERE id = ?');
    $statement->execute([$id]);
    return ['deleted' => true, 'name' => $registration['full_name'], 'sheetUpdated' => removeRegistrationFromSheet($id)];
}

function reloadRegistrationsSheet(): array
{
    requireAdmin();
    if (sheetSyncSettings() === null) throw new HttpError(409, 'La hoja de cálculo no está configurada en este servidor.');
    try {
        return ['rows' => reloadSheet()];
    } catch (Throwable $error) {
        error_log('EXP IMCYC hoja: recarga desde el panel: ' . $error->getMessage());
        throw new HttpError(502, 'No pudimos actualizar la hoja de cálculo. Intenta nuevamente.');
    }
}

function currentRegistration(): array
{
    if (empty($_SESSION['registration_id'])) return ['registration' => null];
    $statement = database()->prepare('SELECT id, full_name, email, company, service, application, clarity, service_rating, unique_code, created_at, completed_at, opinion_consent, opinion_consent_at, opinion_consent_text FROM registrations WHERE id = ?');
    $statement->execute([$_SESSION['registration_id']]);
    $row = $statement->fetch();
    return ['registration' => $row ? serializeRegistration($row) : null];
}

function listRegistrations(array $query): array
{
    requireAdmin();
    [$where, $parameters] = registrationFilters($query);
    $pageValue = $query['page'] ?? '1';
    if (!is_string($pageValue) || !ctype_digit($pageValue) || strlen($pageValue) > 7) throw new HttpError(422, 'Página no válida.');
    $pageSize = 25;
    $connection = database();
    $statement = $connection->prepare('SELECT COUNT(*) FROM registrations' . $where);
    $statement->execute($parameters);
    $total = (int) $statement->fetchColumn();
    $page = max(1, min((int) $pageValue, max(1, (int) ceil($total / $pageSize))));
    $offset = ($page - 1) * $pageSize;
    $statement = $connection->prepare('SELECT id, full_name, email, company, service, application, clarity, service_rating, unique_code, created_at, completed_at, opinion_consent, opinion_consent_at, opinion_consent_text FROM registrations' . $where . " ORDER BY created_at DESC, id DESC LIMIT $pageSize OFFSET $offset");
    $statement->execute($parameters);
    $registrations = array_map('serializeRegistration', $statement->fetchAll());
    $stats = $connection->query('SELECT COUNT(*) AS total, COUNT(completed_at) AS completed, AVG(service_rating) AS average_rating FROM registrations')->fetch();
    return [
        'registrations' => $registrations, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize,
        'stats' => [
            'total' => (int) $stats['total'], 'completed' => (int) $stats['completed'],
            'pending' => (int) $stats['total'] - (int) $stats['completed'],
            'averageRating' => $stats['average_rating'] === null ? null : round((float) $stats['average_rating'], 1),
        ],
    ];
}
