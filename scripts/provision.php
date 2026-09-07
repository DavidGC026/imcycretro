<?php
declare(strict_types=1);

// Ejecutar por SSH como root. No imprime contraseñas ni las escribe en el build.
umask(0077);
$configPath = '/etc/exp-imcyc/config.php';
$credentialsPath = '/root/exp-imcyc.credentials';
$root = new PDO('mysql:unix_socket=/run/mysqld/mysqld.sock;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$existingConfig = is_file($configPath);
if ($existingConfig) {
    $config = require $configPath;
} else {
    $databaseExists = $root->query("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'exp_imcyc'")->fetchColumn();
    $userExists = $root->query("SELECT COUNT(*) FROM mysql.user WHERE User = 'exp_imcyc_app'")->fetchColumn();
    if ($databaseExists || $userExists) throw new RuntimeException('La base o el usuario ya existen sin configuración de esta aplicación. Revisar antes de continuar.');
    $config = [
        'db_host' => '127.0.0.1', 'db_port' => 3306, 'db_name' => 'exp_imcyc',
        'db_user' => 'exp_imcyc_app', 'db_password' => bin2hex(random_bytes(24)),
        'app_origin' => 'https://grabador.imcyc.com', 'cookie_path' => '/exp-imcyc/',
        'cookie_secure' => true, 'session_path' => '/var/lib/exp-imcyc/sessions',
        'rate_limit_secret' => bin2hex(random_bytes(32)),
    ];
    if (!is_dir(dirname($configPath))) mkdir(dirname($configPath), 0750, true);
    file_put_contents($configPath, "<?php\nreturn " . var_export($config, true) . ";\n", LOCK_EX);
}
chmod(dirname($configPath), 0750);
chgrp(dirname($configPath), 'www-data');
chmod($configPath, 0640);
chgrp($configPath, 'www-data');

$root->exec('CREATE DATABASE IF NOT EXISTS exp_imcyc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$password = $root->quote($config['db_password']);
$root->exec("CREATE USER IF NOT EXISTS 'exp_imcyc_app'@'localhost' IDENTIFIED BY $password");
$root->exec("GRANT SELECT, INSERT, UPDATE, DELETE ON exp_imcyc.* TO 'exp_imcyc_app'@'localhost'");
$root->exec('USE exp_imcyc');
$root->exec(file_get_contents(dirname(__DIR__) . '/backend/schema.sql'));

$credentials = is_file($credentialsPath) ? json_decode(file_get_contents($credentialsPath), true, 32, JSON_THROW_ON_ERROR) : [];
$adminExists = $root->query("SELECT COUNT(*) FROM administrators WHERE username = 'admin'")->fetchColumn();
if (!$adminExists) {
    $credentials['admin_password'] ??= bin2hex(random_bytes(12));
    // Guardar primero permite recuperar la clave aunque se interrumpa la creación.
    $credentials = [...$credentials, 'panel_url' => 'https://grabador.imcyc.com/exp-imcyc/panel/', 'admin_user' => 'admin', 'db_name' => $config['db_name'], 'db_user' => $config['db_user'], 'db_password' => $config['db_password']];
    file_put_contents($credentialsPath, json_encode($credentials, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX);
    chmod($credentialsPath, 0600);
    $statement = $root->prepare('INSERT INTO administrators (username, password_hash) VALUES (?, ?)');
    $statement->execute(['admin', password_hash($credentials['admin_password'], PASSWORD_DEFAULT)]);
}

if (!is_dir($config['session_path'])) mkdir($config['session_path'], 0700, true);
chmod(dirname($config['session_path']), 0750);
chown(dirname($config['session_path']), 'www-data');
chgrp(dirname($config['session_path']), 'www-data');
chmod($config['session_path'], 0700);
chown($config['session_path'], 'www-data');
chgrp($config['session_path'], 'www-data');

$app = new PDO('mysql:host=127.0.0.1;dbname=exp_imcyc;charset=utf8mb4', $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
echo 'Base exp_imcyc y usuario exp_imcyc_app configurados. Registros: ' . $app->query('SELECT COUNT(*) FROM registrations')->fetchColumn() . PHP_EOL;
echo "Credenciales guardadas en /root/exp-imcyc.credentials (0600).\n";
