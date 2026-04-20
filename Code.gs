/**
 * @OnlyCurrentDoc
 */

const SPREADSHEET_ID = "1jRbsn8D1UK-y2IStA41aE30JnLoDq3cbCOW9a8yu2w0";
const SHEET_NAME = "DATA_TIEMPO";

/**
 * Serves the HTML dashboard.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle("Dashboard de Notificaciones - TMO")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Validates user credentials.
 */
function validarLogin(usuario, password) {
  const users = {
    "Duvan.ramos": "Duvansito",
    "Monica Hernandez": "Moni10"
  };

  if (users[usuario] && users[usuario] === password) {
    return { success: true, nombre: usuario };
  }
  return { success: false };
}

/**
 * Fetches alerts from the Google Sheet.
 * Logic: Row E must be exactly "DEMORA".
 * Returns columns A (agente), C (tiempo), and G (whatsapp).
 */
function obtenerAlertas() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(SHEET_NAME);

    if (!hoja) {
      console.error("No se encontró la hoja: " + SHEET_NAME);
      return [];
    }

    const data = hoja.getDataRange().getValues();
    if (data.length <= 1) return []; // Only header or empty

    const alertas = [];

    // Start from index 1 (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const tipoAlerta = String(row[4] || "").trim().toUpperCase();

      if (tipoAlerta === "DEMORA") {
        alertas.push({
          id: i, // Use row index as a simple ID for duplicate detection
          agente: String(row[0] || "Desconocido"),
          tiempo: String(row[2] || "0"),
          whatsapp: String(row[6] || "")
        });
      }
    }

    return alertas;
  } catch (e) {
    console.error("Error en obtenerAlertas: " + e.toString());
    return [];
  }
}

/**
 * Note: This function is part of the existing flow provided by the user.
 * It is kept here as requested but remains unmodified in its core logic.
 */
const FOLDER_ID = "1qCpBDH35jWJCDuZXC7gKMRPkBQ8uq6lQ";

function cargarCSV() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!hoja) return;

  hoja.getRange("A2:C").clearContent();

  const carpeta = DriveApp.getFolderById(FOLDER_ID);
  const archivos = carpeta.getFiles();

  let lista = [];
  while (archivos.hasNext()) {
    lista.push(archivos.next());
  }

  if (lista.length === 0) return;

  // Tomar el más reciente
  lista.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  const archivo = lista[0];

  const texto = archivo.getBlob().getDataAsString("UTF-8");
  const lineas = texto.split("\n");

  let resultado = [];
  for (let linea of lineas) {
    if (linea.includes("On contact")) {
      let partes = linea.split(",");
      let nombre = partes[0] || "";
      const match = linea.match(/\d{2}:\d{2}:\d{2}/g);
      let duracion = match ? match[match.length - 1] : "";

      if (nombre && duracion) {
        resultado.push([nombre, "On contact", duracion]);
      }
    }
  }

  if (resultado.length > 0) {
    hoja.getRange(2, 1, resultado.length, 3).setValues(resultado);
  }
}
