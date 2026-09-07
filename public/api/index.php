<?php
declare(strict_types=1);

// La API y su configuración viven fuera del directorio público del build.
require getenv('EXP_IMCYC_BACKEND') ?: '/var/www/exp-imcyc-api/api.php';
