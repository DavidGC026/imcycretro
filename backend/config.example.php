<?php
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'exp_imcyc',
    'db_user' => 'exp_imcyc_app',
    'db_password' => 'CONFIGURAR_FUERA_DEL_BUILD',
    'app_origin' => 'https://grabador.imcyc.com',
    'cookie_path' => '/exp-imcyc/',
    'cookie_secure' => true,
    'session_path' => '/var/lib/exp-imcyc/sessions',
    'rate_limit_secret' => 'GENERAR_CON_RANDOM_BYTES_32',
    // Copia en Google Sheets; en blanco desactiva el envío sin afectar el registro.
    'sheet_webhook_url' => '',
    'sheet_webhook_token' => '',
];
