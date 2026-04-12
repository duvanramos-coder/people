/**
 * CONFIGURACIÓN GLOBAL
 * No modificar los nombres de las hojas ni el ID a menos que sea necesario.
 */
const CONFIG = {
  SPREADSHEET_ID: "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w",
  SHEETS: {
    PQRSF: "PQRSF Creados",
    AGENTES: "Agentes",
    CHAT: "CHAT",
    NOTIFICACIONES: "Notificaciones"
  },
  TIMEZONE: "GMT-5"
};

/**
 * Función principal para servir la aplicación.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('REGISTRA TU PQRSF REALIZADO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * REGLA DE ORO: Conserva la lógica de registro existente.
 */
function guardarPQRSF(datos) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const hoja = ss.getSheetByName(CONFIG.SHEETS.PQRSF);

    const radicadoNuevo = datos.radicado;
    const ultimaFila = hoja.getLastRow();

    if (ultimaFila > 1) {
      const radicados = hoja.getRange(2, 3, ultimaFila - 1, 1).getValues();

      for (let i = 0; i < radicados.length; i++) {
        if (radicados[i][0] == radicadoNuevo) {
          const agenteExistente = hoja.getRange(i + 2, 2).getValue();
          return {
            estado: "duplicado",
            agente: agenteExistente
          };
        }
      }
    }

    hoja.appendRow([
      new Date(),
      datos.agente,
      datos.radicado,
      datos.caso,
      datos.clasificacion,
      datos.dirige
    ]);

    return { estado: "ok" };
  } catch(e) {
    console.log("Error en guardarPQRSF: " + e.message);
    return { estado: "error", error: e.message };
  }
}

/**
 * HELPERS Y FUNCIONES DE SOPORTE
 */
function formatDate(date) {
  if (!date || !(date instanceof Date)) return date;
  return Utilities.formatDate(date, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
}

function getAgentes() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.AGENTES);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    return data.map(row => row[0]).filter(name => name && name.trim() !== "");
  } catch(e) {
    console.log("Error en getAgentes: " + e.message);
    return [];
  }
}

function getHistorial(agente) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const startRow = Math.max(2, lastRow - 50);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 5).getValues();

    return data
      .filter(row => row[1] === agente)
      .reverse()
      .slice(0, 10)
      .map(row => ({
        fecha: formatDate(row[0]),
        radicado: row[2]
      }));
  } catch(e) {
    console.log("Error en getHistorial: " + e.message);
    return [];
  }
}

function getMensajes(usuario) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CHAT);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const startRow = Math.max(2, lastRow - 50);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 4).getValues();

    return data
      .filter(row => row[3] === "TODOS" || row[3] === usuario || row[1] === usuario)
      .map(row => ({
        fecha: formatDate(row[0]),
        usuario: row[1],
        mensaje: row[2],
        destinatario: row[3]
      }));
  } catch(e) {
    console.log("Error en getMensajes: " + e.message);
    return [];
  }
}

function enviarMensaje(datos) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.CHAT);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.CHAT);
      sheet.appendRow(["Fecha", "Usuario", "Mensaje", "Destinatario"]);
    }
    sheet.appendRow([
      new Date(),
      datos.usuario,
      datos.mensaje,
      datos.destinatario || "TODOS"
    ]);
    return { estado: "ok" };
  } catch(e) {
    console.log("Error en enviarMensaje: " + e.message);
    return { estado: "error", error: e.message };
  }
}

function getNotificaciones(usuario) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICACIONES);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getDataRange().getValues();
    return data.slice(1)
      .map((row, index) => ({
        id: index + 2,
        funcionaria: row[0],
        fecha: formatDate(row[1]),
        radicado: row[2],
        mensaje: row[3],
        estado: row[4],
        recibido: row[5]
      }))
      .filter(n => n.funcionaria === usuario && !n.recibido);
  } catch(e) {
    console.log("Error en getNotificaciones: " + e.message);
    return [];
  }
}

function marcarNotificacionRecibida(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICACIONES);
    sheet.getRange(id, 6).setValue(new Date());
    return { estado: "ok" };
  } catch(e) {
    console.log("Error en marcarNotificacionRecibida: " + e.message);
    return { estado: "error", error: e.message };
  }
}
