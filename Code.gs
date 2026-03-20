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

    const data = sheet.getRange("A2:A" + lastRow).getValues();
    return data.map(r => r[0]).filter(r => r !== "");
  } catch (e) {
    console.error("Error en obtenerUsuarios: " + e.message);
    return [];
  }
}

/**
 * Busca dependencias en la hoja "EXTENCIONES" por coincidencia parcial
 */
function buscarDependencias(query) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EXTENCIONES");
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    // Eliminar encabezados
    const rows = data.slice(1);

    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery === "") return [];

    const results = rows.filter(row => {
      const dependencia = String(row[0]).toLowerCase();
      const extension = String(row[1]).toLowerCase();
      const script = String(row[2]).toLowerCase();

      return dependencia.includes(lowerQuery) ||
             extension.includes(lowerQuery) ||
             script.includes(lowerQuery);
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
