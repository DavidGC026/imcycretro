/**
 * Recibe los registros de la experiencia IMCYC y los mantiene en esta hoja.
 *
 * Instalación, dentro de la hoja de cálculo destino:
 *   1. Extensiones > Apps Script y pega este archivo completo.
 *   2. Sustituye TOKEN por una cadena larga y aleatoria; la misma debe quedar
 *      en /etc/exp-imcyc/config.php del servidor, en 'sheet_webhook_token'.
 *   3. Implementar > Nueva implementación > Aplicación web.
 *      Ejecutar como: yo. Con acceso a: cualquier usuario.
 *   4. Copia la URL /exec y guárdala en 'sheet_webhook_url' del servidor.
 *   5. Archivo > Configuración: zona horaria Ciudad de México, para que las
 *      fechas se muestren en la hora local.
 *
 * Cada registro se identifica por su ID, así que reenviar el mismo registro
 * actualiza su fila en lugar de duplicarla.
 */

const TOKEN = 'PEGA_AQUI_EL_MISMO_TOKEN_DEL_SERVIDOR';
const SHEET_NAME = 'Registros';

const COLUMNS = [
  { header: 'ID de registro', field: 'id', type: 'number', width: 110 },
  { header: 'Nombre completo', field: 'nombre', type: 'text', width: 220 },
  { header: 'Correo electrónico', field: 'correo', type: 'text', width: 240 },
  { header: 'Empresa', field: 'empresa', type: 'text', width: 220 },
  { header: 'Estado', field: 'estado', type: 'text', width: 170 },
  { header: 'Servicio', field: 'servicio', type: 'text', width: 160 },
  { header: 'Aplicación del conocimiento', field: 'aplicacion', type: 'text', width: 420 },
  { header: 'Claridad del instructor', field: 'claridad', type: 'text', width: 150 },
  { header: 'Calificación del servicio (0 a 5)', field: 'calificacion', type: 'number', width: 150 },
  { header: 'Folio del kit', field: 'folio', type: 'text', width: 210 },
  { header: 'Fecha de alta', field: 'alta', type: 'date', width: 160 },
  { header: 'Fecha de emisión del kit', field: 'emision', type: 'date', width: 160 },
  { header: 'Uso de la opinión como testimonio', field: 'testimonio', type: 'text', width: 210 },
  { header: 'Fecha de la decisión', field: 'testimonioFecha', type: 'date', width: 160 },
  { header: 'Texto de la autorización', field: 'testimonioTexto', type: 'text', width: 320 },
];

const DATE_FORMAT = 'dd/mm/yyyy hh:mm:ss';

function doPost(request) {
  try {
    const payload = JSON.parse(request.postData.contents);
    if (payload.token !== TOKEN) return respond({ ok: false, error: 'Token inválido.' });
    const registros = payload.registros;
    if (!Array.isArray(registros)) return respond({ ok: false, error: 'Sin registros.' });

    // El bloqueo evita que dos envíos simultáneos escriban en la misma fila.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return respond({ ok: true, filas: writeRegistrations(registros) });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return respond({ ok: false, error: String(error) });
  }
}

function writeRegistrations(registros) {
  const sheet = sheetWithHeader();
  const rowById = existingRowsById(sheet);
  let written = 0;
  registros.forEach(function (registro) {
    const row = COLUMNS.map(function (column) { return cellValue(registro[column.field], column.type); });
    const target = rowById[registro.id] || sheet.getLastRow() + 1;
    writeRow(sheet, target, row);
    rowById[registro.id] = target;
    written += 1;
  });
  return written;
}

function writeRow(sheet, rowNumber, values) {
  const range = sheet.getRange(rowNumber, 1, 1, COLUMNS.length);
  // El formato se fija antes de escribir: en una celda de texto, una respuesta
  // que empiece con "=" se guarda tal cual en lugar de evaluarse como fórmula.
  range.setNumberFormats([COLUMNS.map(numberFormat)]);
  range.setValues([values]);
  range.setVerticalAlignment('top');
}

function numberFormat(column) {
  if (column.type === 'date') return DATE_FORMAT;
  if (column.type === 'number') return '0';
  return '@';
}

function cellValue(value, type) {
  if (value === null || value === undefined) return '';
  if (type === 'date') return new Date(value);
  if (type === 'number') return value;
  return String(value);
}

function existingRowsById(sheet) {
  const rows = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return rows;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  ids.forEach(function (cells, index) {
    const id = Number(cells[0]);
    if (id) rows[id] = index + 2;
  });
  return rows;
}

function sheetWithHeader() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() > 0) return sheet;

  const header = sheet.getRange(1, 1, 1, COLUMNS.length);
  header.setValues([COLUMNS.map(function (column) { return column.header; })]);
  header.setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#007DA5').setWrap(true);
  COLUMNS.forEach(function (column, index) { sheet.setColumnWidth(index + 1, column.width); });
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  return sheet;
}

function respond(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
