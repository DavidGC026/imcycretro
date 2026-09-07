<?php
// Servidor local para el build y la API PHP; admite /exp-imcyc o la raíz.
declare(strict_types=1);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if ($path === '/exp-imcyc') {
    header('Location: /exp-imcyc/', true, 308);
    return true;
}
if (str_starts_with($path, '/exp-imcyc/')) $path = substr($path, strlen('/exp-imcyc'));
if ($path === '/api/index.php') {
    require dirname(__DIR__) . '/backend/api.php';
    return true;
}
$root = realpath(dirname(__DIR__) . '/out');
$file = realpath($root . $path);
if ($file && is_dir($file)) $file = realpath($file . '/index.html');
if (!$file || !str_starts_with($file, $root . '/') || !is_file($file) || pathinfo($file, PATHINFO_EXTENSION) === 'php') {
    http_response_code(404);
    echo 'Página no encontrada';
    return true;
}
$types = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript', 'css' => 'text/css', 'png' => 'image/png', 'svg' => 'image/svg+xml', 'ttf' => 'font/ttf', 'txt' => 'text/plain'];
header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
readfile($file);
return true;
