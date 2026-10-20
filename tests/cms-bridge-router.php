<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/exp-imcyc/api/cms.php') {
    require dirname(__DIR__) . '/public/api/cms.php';
    return true;
}
if ($path === '/exp-imcyc/api/index.php') {
    require dirname(__DIR__) . '/backend/api.php';
    return true;
}
http_response_code(404);
echo 'QA route not found';
return true;
