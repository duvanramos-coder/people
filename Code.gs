/**
 * CONFIGURACIÓN GLOBAL
 * No modificar los nombres de las hojas ni el ID a menos que sea necesario.
 */
const CONFIG = {
  SPREADSHEET_ID: "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w",
  SHEETS: {
    PQRSF: "PQRSF Creados",
    AGENTES: "USUARIOS",
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

function buscarPQRSF(radicado) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const searchVal = String(radicado).trim().toLowerCase();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][2]).trim().toLowerCase() === searchVal) {
        return {
          fecha: formatDate(data[i][0]),
          agente: data[i][1],
          radicado: data[i][2],
          clasificacion: data[i][4],
          dirige: data[i][5]
        };
      }
    }
    return null;
  } catch(e) {
    console.log("Error en buscarPQRSF: " + e.message);
    return null;
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
  const defaultNames = [
    "Angi Johana Banda Montes",
    "Slendy Lizzeth Pico Garcia",
    "Heillen Tatiana Rincón Lizarazo",
    "Juliana Roa Aragonez",
    "Stefania Ortega Rodríguez",
    "Hadisha Faride Bitar Lerech",
    "Bleidis Farides Cabarcas Charris",
    "Katherine Sofia Nieto Guerra"
  ];

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.AGENTES) || ss.getSheetByName("Agentes");

    if (!sheet) return defaultNames.sort();

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return defaultNames.sort();

    let data;
    // USUARIOS sheet usually has names in Column B (2), Agentes usually in Column E (5)
    if (sheet.getName() === "USUARIOS") {
      data = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    } else {
      data = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    }

    const sheetNames = data.map(row => row[0]).filter(name => name && name.trim() !== "");

    return sheetNames.length > 0 ? [...new Set(sheetNames)].sort() : defaultNames.sort();
  } catch(e) {
    console.warn("getAgentes using defaults: " + e.message);
    return defaultNames.sort();
  }
}

function getHistorial(agente) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { historial: [], hoy: 0 };

    // Obtenemos los últimos 300 registros para asegurar capturar los del día
    const startRow = Math.max(2, lastRow - 300);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 5).getValues();

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    const agentData = data.filter(row => row[1] === agente);

    const hoyCount = agentData.filter(row => {
      const d = new Date(row[0]);
      d.setHours(0,0,0,0);
      return d.getTime() === hoy.getTime();
    }).length;

    const historial = agentData
      .reverse()
      .slice(0, 10)
      .map(row => ({
        fecha: formatDate(row[0]),
        radicado: row[2]
      }));

    return {
      historial: historial,
      hoy: hoyCount
    };
  } catch(e) {
    console.log("Error en getHistorial: " + e.message);
    return { historial: [], hoy: 0 };
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
