function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('REGISTRA TU PQRSF REALIZADO');
}

function guardarPQRSF(datos) {
  try {
    const spreadsheetId = "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w";
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const hoja = ss.getSheetByName("PQRSF Creados");

    const radicadoNuevo = datos.radicado;
    const ultimaFila = hoja.getLastRow();

    if (ultimaFila > 1) {
      // Optimized: Only get the Radicado column
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
    return { estado: "error", error: e.message };
  }
}

const SPREADSHEET_ID = "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w";

function formatDate(date) {
  if (!date || !(date instanceof Date)) return date;
  return Utilities.formatDate(date, "GMT-5", "dd/MM/yyyy HH:mm:ss");
}

function getAgentes() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Agentes");
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("PQRSF Creados");
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Optimized: Get only necessary rows from the end
    const startRow = Math.max(2, lastRow - 50);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 5).getValues();

    const history = data
      .filter(row => row[1] === agente)
      .reverse()
      .slice(0, 10)
      .map(row => ({
        fecha: formatDate(row[0]),
        radicado: row[2],
        clasificacion: row[4],
        caso: row[3]
      }));

    return history;
  } catch(e) {
    console.log("Error en getHistorial: " + e.message);
    return [];
  }
}

function getMensajes(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("CHAT");
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Optimized: Only get last 50 messages
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("CHAT");
    if (!sheet) {
      sheet = ss.insertSheet("CHAT");
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Notificaciones");
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Notificaciones");
    sheet.getRange(id, 6).setValue(new Date());
    return { estado: "ok" };
  } catch(e) {
    console.log("Error en marcarNotificacionRecibida: " + e.message);
    return { estado: "error", error: e.message };
  }
}
