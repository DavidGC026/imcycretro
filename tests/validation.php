<?php
declare(strict_types=1);
require dirname(__DIR__) . '/backend/validation.php';

$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejects(callable $callback): void
{
    try { $callback(); } catch (HttpError $error) {
        check($error->status === 422, 'El dato inválido debe devolver 422.');
        return;
    }
    throw new RuntimeException('Se aceptó un dato inválido.');
}
$identity = ['name' => ' María José ', 'company' => ' IMCYC ', 'email' => ' PRUEBA@EXAMPLE.COM '];
check(validateIdentity($identity) === ['María José', 'IMCYC', 'prueba@example.com'], 'Normalizar espacios, acentos y correo.');
foreach (['', 'sin-correo', 'correo@ejemplo', ['correo@ejemplo.com']] as $email) rejects(fn() => validateIdentity([...$identity, 'email' => $email]));
foreach (['', "\0Nombre", str_repeat('á', 161), 10, ['Nombre']] as $name) rejects(fn() => validateIdentity([...$identity, 'name' => $name]));
$survey = ['service' => 'Certificación', 'application' => 'Control de calidad del concreto.', 'clarity' => 'Buena', 'serviceRating' => 0];
check(validateSurvey($survey)[3] === 0, 'La calificación cero es una respuesta válida.');
foreach ([-1, 6, '0', 2.5, null, true, []] as $rating) rejects(fn() => validateSurvey([...$survey, 'serviceRating' => $rating]));
rejects(fn() => validateSurvey([...$survey, 'service' => 'Servicio no permitido']));
rejects(fn() => validateSurvey([...$survey, 'clarity' => 'Excelente']));
rejects(fn() => validateSurvey([...$survey, 'application' => str_repeat('á', 4001)]));
[$where, $parameters] = registrationFilters(['search' => "x%' OR 1=1 --", 'status' => 'completed']);
check(!str_contains($where, 'OR 1=1'), 'La búsqueda no puede convertirse en SQL.');
check(count($parameters) === 4 && str_contains($parameters[0], '\\%'), 'Escapar comodines de búsqueda.');
rejects(fn() => registrationFilters(['status' => 'hacked']));
rejects(fn() => registrationFilters(['service' => 'unknown']));
rejects(fn() => registrationFilters(['search' => []]));
echo "$checks validaciones correctas.\n";
