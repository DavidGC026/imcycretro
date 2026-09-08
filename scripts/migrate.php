<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__) . '/backend/bootstrap.php';
require dirname(__DIR__) . '/backend/migrations.php';

$settings = config();
$socket = getenv('EXP_IMCYC_MYSQL_SOCKET') ?: '/run/mysqld/mysqld.sock';
$connection = new PDO('mysql:unix_socket=' . $socket . ';dbname=' . $settings['db_name'] . ';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
echo 'Columnas de autorización agregadas: ' . migrateOpinionConsent($connection) . PHP_EOL;
