<?php
declare(strict_types=1);

function originalKitBenefit(): array
{
    // Historical kits must never inherit a later promotion or contact change.
    return [
        'title' => 'KIT DE CONTINUIDAD',
        'benefit' => '10% DE DESCUENTO',
        'description' => 'EN CUALQUIER CONSTANCIA DE APTITUD',
        'validityDays' => 30,
        'conditions' => 'No transferible. No acumulable con otros descuentos, becas o promociones. Descuento aplicable sobre el precio lista antes de IVA.',
        'whatsapp' => '55 2104 5612',
        'email' => 'cursos@imcyc.com',
    ];
}

function validateKitBenefit(mixed $value): array
{
    if ($value instanceof stdClass) $value = get_object_vars($value);
    if (!is_array($value)) throw new HttpError(422, 'Revisa los datos del obsequio.');
    $result = [];
    foreach (['title' => [45, 'título'], 'benefit' => [70, 'beneficio'], 'description' => [140, 'descripción'],
        'conditions' => [360, 'condiciones'], 'whatsapp' => [25, 'WhatsApp'], 'email' => [120, 'correo']] as $key => [$max, $label]) {
        $text = $value[$key] ?? null;
        if (!is_string($text) || preg_match('/[\x00-\x1F\x7F]/u', $text)) throw new HttpError(422, "Revisa el campo $label.");
        $text = trim($text);
        if (($text === '' && $key !== 'description') || mb_strlen($text) > $max) {
            throw new HttpError(422, "El campo $label admite hasta $max caracteres y no puede quedar vacío.");
        }
        $result[$key] = $text;
    }
    $days = $value['validityDays'] ?? null;
    if (!is_int($days) || $days < 1 || $days > 365) throw new HttpError(422, 'La vigencia debe ser de 1 a 365 días naturales.');
    $digits = preg_replace('/\D/', '', $result['whatsapp']);
    if (!preg_match('/^[+0-9 ()-]+$/', $result['whatsapp']) || strlen($digits) < 10 || strlen($digits) > 15) {
        throw new HttpError(422, 'Escribe un WhatsApp de 10 a 15 dígitos.');
    }
    if (!filter_var($result['email'], FILTER_VALIDATE_EMAIL)) throw new HttpError(422, 'Escribe un correo electrónico válido.');
    $result['validityDays'] = $days;
    return $result;
}

function kitConfiguration(?PDO $connection = null, bool $lock = false): array
{
    $row = ($connection ?? database())->query('SELECT revision, payload, updated_at FROM kit_settings WHERE id = 1' . ($lock ? ' LOCK IN SHARE MODE' : ''))->fetch();
    if (!$row) throw new RuntimeException('Kit settings unavailable; run the migration.');
    return ['revision' => (int) $row['revision'], 'benefit' => json_decode($row['payload'], true, 32, JSON_THROW_ON_ERROR),
        'updatedAt' => str_replace(' ', 'T', $row['updated_at']) . 'Z'];
}

function saveKitConfiguration(array $body): array
{
    $benefit = validateKitBenefit($body['benefit'] ?? null);
    $revision = $body['revision'] ?? null;
    if (!is_int($revision) || $revision < 1) throw new HttpError(422, 'Recarga el obsequio antes de guardar.');
    $connection = database();
    $connection->beginTransaction();
    try {
        $statement = $connection->prepare('UPDATE kit_settings SET payload = ?, revision = revision + 1, updated_at = UTC_TIMESTAMP() WHERE id = 1 AND revision = ?');
        $statement->execute([json_encode($benefit, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $revision]);
        if ($statement->rowCount() !== 1) throw new HttpError(409, 'Otra persona cambió el obsequio. Recarga la versión guardada antes de volver a guardar.');
        $result = kitConfiguration($connection);
        $connection->commit();
        return $result;
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
}

function registrationKitBenefit(array $row): ?array
{
    if (empty($row['completed_at'])) return null;
    if (!empty($row['kit_snapshot'])) return json_decode($row['kit_snapshot'], true, 32, JSON_THROW_ON_ERROR);
    $benefit = originalKitBenefit();
    $legacy = trim($row['discount_text'] ?? '');
    if ($legacy !== '' && $legacy !== DISCOUNT_TEXT) {
        $benefit['benefit'] = $legacy;
        $benefit['description'] = '';
    }
    return $benefit;
}
