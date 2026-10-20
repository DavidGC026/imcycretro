<?php
// Install a private copy outside the document root. An empty signing secret
// intentionally disables the bridge; use a new independent random secret.
return [
    'secret' => '',
    'nonce_path' => '/var/lib/exp-imcyc/cms-bridge-nonces',
];
