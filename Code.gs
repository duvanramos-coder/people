function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dashboard PQRSF | People BPO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Fetches data from the PQRSF sheet
 * Spreadsheet ID: 148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w
 */
function getPQRSFData() {
  try {
    const CONFIG = {
      SPREADSHEET_ID: '148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w',
      SHEET_NAME: 'PQRSF'
    };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error('Hoja "PQRSF" no encontrada.');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // No data or only headers

    const headers = data[0];
    const rows = data.slice(1);

    // Column Mappings (0-indexed)
    // B -> 1, C -> 2, D -> 3, F -> 5, G -> 6, H -> 7, I -> 8, J -> 9, K -> 10, L -> 11, M -> 12, N -> 13

    return rows.map((row, index) => {
      // Helper to format date if it's a Date object
      const formatDate = (val) => {
        if (val instanceof Date) {
          return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        return val;
      };

      const estado = row[9] ? row[9].toString().trim() : "";
      const canal = row[10] ? row[10].toString().trim() : "";
      const efectividad = row[11] ? row[11].toString().trim() : "";

      const isManaged = estado !== "" && canal !== "" && efectividad !== "";

      return {
        id: index + 2, // Row number in sheet
        recibidoPeople: formatDate(row[1]),
        radicado: row[2] ? row[2].toString().trim() : "",
        fechaCofrem: formatDate(row[3]),
        nombre: row[5] ? row[5].toString().trim() : "",
        telefono: row[6] ? row[6].toString().trim() : "",
        correo: row[7] ? row[7].toString().trim() : "",
        empresa: row[8] ? row[8].toString().trim() : "",
        estado: estado,
        canal: canal,
        efectividad: efectividad,
        requiereOtraSolucion: row[12] ? row[12].toString().trim() : "",
        seEncontroPqrs: row[13] ? row[13].toString().trim() : "",
        isManaged: isManaged
      };
    }).filter(item => item.radicado !== ""); // Ensure we have a radicado

  } catch (error) {
    Logger.log('Error fetching data: ' + error.message);
    throw new Error('Error al cargar datos: ' + error.message);
  }
}
