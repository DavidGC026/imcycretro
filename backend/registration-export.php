<?php
declare(strict_types=1);

use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\DateTimeCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\CellVerticalAlignment;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\AutoFilter;
use OpenSpout\Writer\XLSX\Entity\SheetView;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Properties;
use OpenSpout\Writer\XLSX\Writer;

function exportRegistrations(array $query): never
{
    requireAdmin();
    [$where, $parameters] = registrationFilters($query);
    require_once __DIR__ . '/vendor/autoload.php';
    session_write_close();

    // Los archivos con datos personales viven en un directorio privado y se eliminan al terminar.
    $directory = config()['session_path'] . '/export-' . bin2hex(random_bytes(16));
    if (!mkdir($directory, 0700)) throw new RuntimeException('Cannot create export directory.');
    $path = $directory . '/registros.xlsx';
    try {
        $count = writeRegistrationWorkbook($path, $directory, registrationExportRows($where, $parameters));
        $date = new DateTimeImmutable('now', new DateTimeZone('America/Mexico_City'));
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="registros-imcyc-' . $date->format('Ymd-His') . '.xlsx"');
        header('Content-Length: ' . filesize($path));
        header('X-Export-Count: ' . $count);
        readfile($path);
    } finally {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            if ($file->isDir()) rmdir($file->getPathname());
            else unlink($file->getPathname());
        }
        rmdir($directory);
    }
    exit;
}

function registrationExportRows(string $where, array $parameters): Generator
{
    $connection = database();
    $connection->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
    $statement = null;
    try {
        $statement = $connection->prepare('SELECT id, full_name, email, company, service, application, clarity, service_rating, unique_code, created_at, completed_at, opinion_consent, opinion_consent_at, opinion_consent_text FROM registrations' . $where . ' ORDER BY created_at DESC, id DESC');
        $statement->execute($parameters);
        while ($registration = $statement->fetch()) yield $registration;
    } finally {
        $statement?->closeCursor();
        $connection->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
    }
}

function writeRegistrationWorkbook(string $path, string $temporaryDirectory, iterable $registrations): int
{
    $columns = [
        ['ID de registro', 16], ['Nombre completo', 30], ['Correo electrónico', 36], ['Empresa', 30],
        ['Estado', 26], ['Servicio', 24], ['Aplicación del conocimiento', 60],
        ['Claridad del instructor', 22], ['Calificación del servicio (0 a 5)', 22], ['Folio del kit', 31],
        ['Fecha de alta (CDMX)', 23], ['Fecha de emisión del kit (CDMX)', 25],
        ['Uso de la opinión como testimonio', 30], ['Fecha de la decisión (CDMX)', 25], ['Texto de la autorización', 55],
    ];
    $options = new Options();
    $options->setTempFolder($temporaryDirectory);
    $options->setProperties(new Properties(title: 'Registros de la comunidad IMCYC', creator: 'IMCYC', lastModifiedBy: 'IMCYC'));
    $options->DEFAULT_ROW_STYLE = (new Style())->setFontName('Arial')->setFontSize(10)->setShouldWrapText()->setCellVerticalAlignment(CellVerticalAlignment::TOP);
    foreach ($columns as $index => [, $width]) $options->setColumnWidth($width, $index + 1);
    $writer = new Writer($options);
    $writer->openToFile($path);
    $count = 0;
    try {
        $sheet = $writer->getCurrentSheet();
        $sheet->setName('Registros');
        $sheet->setSheetView((new SheetView())->setFreezeRow(2)->setFreezeColumn('B'));
        $headerStyle = (new Style())->setFontBold()->setFontColor('FFFFFF')->setBackgroundColor('007DA5')->setShouldWrapText();
        $writer->addRow(Row::fromValues(array_column($columns, 0), $headerStyle)->setHeight(32));
        foreach ($registrations as $registration) {
            $writer->addRow(registrationExportRow($registration));
            $count++;
        }
        $sheet->setAutoFilter(new AutoFilter(0, 1, count($columns) - 1, $count + 1));
    } finally {
        $writer->close();
    }
    return $count;
}

function registrationExportRow(array $registration): Row
{
    $values = [
        (string) $registration['id'], $registration['full_name'], $registration['email'], $registration['company'],
        $registration['completed_at'] ? 'Encuesta completa' : 'Solo datos de contacto',
        $registration['service'], $registration['application'], $registration['clarity'],
        $registration['service_rating'] === null ? null : (int) $registration['service_rating'],
        $registration['unique_code'],
    ];
    // El texto del participante nunca se interpreta como una fórmula, ni aunque empiece con '='.
    $cells = array_map(static fn ($value) => is_string($value) ? new StringCell($value, null) : Cell::fromValue($value), $values);
    $dateStyle = (new Style())->setFormat('dd/mm/yyyy hh:mm:ss');
    foreach (['created_at', 'completed_at'] as $field) {
        $cells[] = registrationDateCell($registration[$field], $dateStyle);
    }
    $consent = $registration['opinion_consent'];
    $cells[] = new StringCell($consent === null ? 'Sin autorización registrada' : ((bool) $consent ? 'Autorizó' : 'No autorizó'), null);
    $cells[] = registrationDateCell($registration['opinion_consent_at'], $dateStyle);
    $cells[] = $registration['opinion_consent_text'] === null ? Cell::fromValue(null) : new StringCell($registration['opinion_consent_text'], null);
    return new Row($cells);
}

function registrationDateCell(?string $value, Style $style): Cell
{
    if ($value === null) return Cell::fromValue(null);
    $date = (new DateTimeImmutable($value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('America/Mexico_City'));
    return new DateTimeCell($date, $style);
}
