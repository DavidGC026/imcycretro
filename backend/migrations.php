<?php
declare(strict_types=1);

require_once __DIR__ . '/kit-benefit.php';

function migrateKitBenefit(PDO $connection): void
{
    $connection->exec('CREATE TABLE IF NOT EXISTS kit_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY, revision INT UNSIGNED NOT NULL,
        payload LONGTEXT NOT NULL CHECK (JSON_VALID(payload)), updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $statement = $connection->prepare('INSERT IGNORE INTO kit_settings (id, revision, payload, updated_at) VALUES (1, 1, ?, UTC_TIMESTAMP())');
    $statement->execute([json_encode(originalKitBenefit(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    $columns = $connection->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registrations'")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('kit_snapshot', $columns, true)) $connection->exec('ALTER TABLE registrations ADD COLUMN kit_snapshot LONGTEXT NULL CHECK (kit_snapshot IS NULL OR JSON_VALID(kit_snapshot))');
}

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
