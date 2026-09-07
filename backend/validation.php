<?php
declare(strict_types=1);

const SERVICES = ['Certificación', 'Diplomado', 'Seminario', 'Congreso', 'Lab. Concreto', 'Ensayos Aptitud'];
const DISCOUNT_TEXT = '10% DE DESCUENTO EN CUALQUIER CONSTANCIA DE APTITUD.';

final class HttpError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

function requiredText(array $body, string $key, string $label, int $maxLength): string
{
    $value = $body[$key] ?? null;
    if (!is_string($value)) {
        throw new HttpError(422, "Revisa el campo $label.");
    }
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        throw new HttpError(422, "Revisa el campo $label.");
    }
    $value = trim($value);
    $length = preg_match_all('/./us', $value);
    if ($value === '' || $length === false || $length > $maxLength) {
        throw new HttpError(422, "El campo $label es obligatorio y admite hasta $maxLength caracteres.");
    }
    return $value;
}

function validateIdentity(array $body): array
{
    $name = requiredText($body, 'name', 'nombre', 160);
    $company = requiredText($body, 'company', 'empresa', 200);
    $email = strtolower(requiredText($body, 'email', 'correo electrónico', 254));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new HttpError(422, 'Revisa el formato de tu correo electrónico.');
    }
    return [$name, $company, $email];
}

function validateSurvey(array $body): array
{
    $service = requiredText($body, 'service', 'servicio', 80);
    $application = requiredText($body, 'application', 'aplicación del conocimiento', 4000);
    $clarity = requiredText($body, 'clarity', 'claridad del instructor', 20);
    $rating = $body['serviceRating'] ?? null;
    if (!in_array($service, SERVICES, true) || !in_array($clarity, ['Regular', 'Buena', 'Mala'], true)
        || !is_int($rating) || $rating < 0 || $rating > 5) {
        throw new HttpError(422, 'Selecciona un servicio y responde todas las preguntas de la encuesta.');
    }
    return [$service, $application, $clarity, $rating];
}

function registrationFilters(array $query): array
{
    $search = $query['search'] ?? '';
    $status = $query['status'] ?? '';
    $service = $query['service'] ?? '';
    if (!is_string($search) || strlen($search) > 800 || !is_string($status) || !is_string($service)) {
        throw new HttpError(422, 'Revisa los filtros de búsqueda.');
    }
    $clauses = [];
    $parameters = [];
    if (trim($search) !== '') {
        $clauses[] = '(full_name LIKE ? OR email LIKE ? OR company LIKE ? OR unique_code LIKE ?)';
        $pattern = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($search)) . '%';
        $parameters = array_fill(0, 4, $pattern);
    }
    if ($status === 'pending') $clauses[] = 'completed_at IS NULL';
    elseif ($status === 'completed') $clauses[] = 'completed_at IS NOT NULL';
    elseif ($status !== '') throw new HttpError(422, 'Estado de registro no válido.');
    if ($service !== '') {
        if (!in_array($service, SERVICES, true)) throw new HttpError(422, 'Servicio no válido.');
        $clauses[] = 'service = ?';
        $parameters[] = $service;
    }
    return [$clauses ? ' WHERE ' . implode(' AND ', $clauses) : '', $parameters];
}

function validateAdministratorUsername(array $body): string
{
    $username = strtolower(requiredText($body, 'username', 'usuario', 100));
    if (!preg_match('/\A[a-z0-9][a-z0-9._-]{2,99}\z/', $username)) {
        throw new HttpError(422, 'El usuario debe tener de 3 a 100 caracteres: letras, números, puntos o guiones.');
    }
    return $username;
}

function validateNewPassword(array $body): string
{
    $password = $body['newPassword'] ?? null;
    $confirmation = $body['confirmPassword'] ?? null;
    if (!is_string($password) || strlen($password) > 512 || str_contains($password, "\0")) {
        throw new HttpError(422, 'La nueva contraseña debe tener entre 12 y 128 caracteres.');
    }
    $length = preg_match_all('/./us', $password);
    if ($length === false || $length < 12 || $length > 128 || trim($password) === '') {
        throw new HttpError(422, 'La nueva contraseña debe tener entre 12 y 128 caracteres.');
    }
    if (!is_string($confirmation) || !hash_equals($password, $confirmation)) {
        throw new HttpError(422, 'Las contraseñas nuevas no coinciden.');
    }
    return $password;
}
