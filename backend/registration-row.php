<?php
declare(strict_types=1);

// Etiquetas y valores que comparten la exportación a Excel y la copia en la hoja
// de cálculo, para que ambas salidas describan un registro de la misma forma.

function registrationStatusLabel(array $registration): string
{
    return $registration['completed_at'] ? 'Encuesta completa' : 'Solo datos de contacto';
}

function registrationConsentLabel(?int $consent): string
{
    if ($consent === null) return 'Sin autorización registrada';
    return $consent === 1 ? 'Autorizó' : 'No autorizó';
}

function registrationUtcTimestamp(?string $value): ?string
{
    if ($value === null) return null;
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
}
