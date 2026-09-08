<?php
declare(strict_types=1);
require dirname(__DIR__) . '/backend/vendor/autoload.php';
require dirname(__DIR__) . '/backend/registration-export.php';

writeRegistrationWorkbook($argv[1], dirname($argv[1]), [[
    'id' => '9007199254740993', 'full_name' => 'María Hernández',
    'company' => '@IMCYC', 'email' => 'maria@example.com', 'service' => 'Certificación',
    'application' => "=SUM(1,2)\nJosé & María <concreto>", 'clarity' => 'Buena',
    'service_rating' => 0, 'unique_code' => 'IMCYC-TEST',
    'created_at' => '2026-09-08 01:30:00', 'completed_at' => '2026-09-08 02:15:00',
    'opinion_consent' => true, 'opinion_consent_at' => '2026-09-08 02:15:00',
    'opinion_consent_text' => 'Autorizo el uso de mi opinión como testimonio',
]]);
