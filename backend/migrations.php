<?php
declare(strict_types=1);

function migrateOpinionConsent(PDO $connection): int
{
    $columns = $connection->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registrations'")->fetchAll(PDO::FETCH_COLUMN);
    $definitions = [
        'opinion_consent' => 'TINYINT UNSIGNED NULL',
        'opinion_consent_at' => 'DATETIME NULL',
        'opinion_consent_text' => 'VARCHAR(200) NULL',
    ];
    $additions = [];
    foreach ($definitions as $column => $definition) {
        if (!in_array($column, $columns, true)) $additions[] = "ADD COLUMN $column $definition";
    }
    // NULL conserva la ausencia de autorización en registros históricos; no se infiere consentimiento.
    if ($additions) $connection->exec('ALTER TABLE registrations ' . implode(', ', $additions));
    return count($additions);
}
