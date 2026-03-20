/**
 * SCRIPT CONMUTADOR PEOPLE BPO
 * By Duvan Ramos 2026
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Script Conmutador People BPO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Obtiene la lista de usuarios desde la hoja "USUARIOS"
 */
function obtenerUsuarios() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("USUARIOS");
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Columna B contiene los nombres completos de los asesores
    const data = sheet.getRange("A2:B" + lastRow).getValues();
    return data.map(r => r[1] || r[0]).filter(r => r !== "");
  } catch (e) {
    console.error("Error en obtenerUsuarios: " + e.message);
    return [];
  }
}

/**
 * Normaliza una cadena eliminando tildes y convirtiendo a minúsculas
 */
function normalizeString(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Busca dependencias en la hoja "EXTENCIONES" por coincidencia parcial e insensible a tildes
 */
function buscarDependencias(query) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EXTENCIONES");
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    // Eliminar encabezados
    const rows = data.slice(1);

    const normalizedQuery = normalizeString(query);
    if (normalizedQuery === "") return [];

    const results = rows.filter(row => {
      const dependencia = normalizeString(row[0]);
      const extension = normalizeString(row[1]);
      const script = normalizeString(row[2]);

      return dependencia.includes(normalizedQuery) ||
             extension.includes(normalizedQuery) ||
             script.includes(normalizedQuery);
    }).map(row => {
      return {
        dependencia: row[0],
        extension: row[1],
        scriptBase: row[2]
      };
    });

    return results;
  } catch (e) {
    console.error("Error en buscarDependencias: " + e.message);
    return [];
  }
}
