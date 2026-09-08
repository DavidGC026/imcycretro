<?php
declare(strict_types=1);

// Reenvía registros a la hoja de cálculo de Google. Sirve para poblarla la
// primera vez y para recuperar los envíos que hayan fallado, porque el Apps
// Script actualiza la fila que ya tenga ese ID en lugar de duplicarla.
//
//   php scripts/sync-sheet.php                 todos los registros
//   php scripts/sync-sheet.php --desde=2026-09-01   solo desde esa fecha (CDMX)
//   php scripts/sync-sheet.php --solo-completos     omite quienes no terminaron
//
// Usa EXP_IMCYC_CONFIG para apuntar a otra configuración.

require_once __DIR__ . '/../backend/bootstrap.php';
require_once __DIR__ . '/../backend/sheet-sync.php';

const BATCH_SIZE = 100;

$options = getopt('', ['desde::', 'solo-completos']);
if (sheetSyncSettings() === null) {
    fwrite(STDERR, "La configuración no tiene sheet_webhook_url ni sheet_webhook_token.\n");
    exit(1);
}

$conditions = [];
$parameters = [];
if (isset($options['desde'])) {
    $since = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $options['desde'] . ' 00:00:00', new DateTimeZone('America/Mexico_City'));
    if (!$since) {
        fwrite(STDERR, "La fecha de --desde debe tener el formato AAAA-MM-DD.\n");
        exit(1);
    }
    $conditions[] = 'created_at >= ?';
    $parameters[] = $since->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}
if (isset($options['solo-completos'])) $conditions[] = 'completed_at IS NOT NULL';
$where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';

$statement = database()->prepare('SELECT id, full_name, email, company, service, application, clarity, service_rating, unique_code, created_at, completed_at, opinion_consent, opinion_consent_at, opinion_consent_text FROM registrations' . $where . ' ORDER BY id');
$statement->execute($parameters);

$batch = [];
$sent = 0;
$failed = 0;

function flushBatch(array $batch, int &$sent, int &$failed): void
{
    if (!$batch) return;
    try {
        $sent += sendRegistrationsToSheet($batch);
    } catch (Throwable $error) {
        $failed += count($batch);
        fwrite(STDERR, 'Lote de ' . count($batch) . " registros no enviado: " . $error->getMessage() . "\n");
    }
}

while ($registration = $statement->fetch()) {
    $batch[] = $registration;
    if (count($batch) >= BATCH_SIZE) {
        flushBatch($batch, $sent, $failed);
        $batch = [];
    }
}
flushBatch($batch, $sent, $failed);

echo "Registros enviados a la hoja: $sent\n";
if ($failed > 0) {
    echo "Registros no enviados: $failed. Vuelve a ejecutar el script para reintentarlos.\n";
    exit(1);
}
