<?php
declare(strict_types=1);

// Only this signed service entrypoint is public; implementation and configuration
// remain outside the static document root, independently of participant sessions.
require getenv('EXP_IMCYC_CMS_BACKEND') ?: '/var/www/exp-imcyc-api/cms-bridge.php';
runCmsBridge();
