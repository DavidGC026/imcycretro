<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/backend/bootstrap.php';
require dirname(__DIR__) . '/backend/migrations.php';
migrateKitBenefit(database());
echo "Configuración del obsequio lista; los registros existentes se conservaron.\n";
