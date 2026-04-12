function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('REGISTRA TU PQRSF REALIZADO');
}

function guardarPQRSF(datos) {

  const spreadsheetId = "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w";
  const hoja = SpreadsheetApp.openById(spreadsheetId)
  .getSheetByName("PQRSF Creados");

  const radicadoNuevo = datos.radicado;
  const ultimaFila = hoja.getLastRow();

  if (ultimaFila > 1) {

    const radicados = hoja.getRange(2,3,ultimaFila-1,1).getValues();

    for (let i = 0; i < radicados.length; i++) {

      if (radicados[i][0] == radicadoNuevo) {

        const agenteExistente = hoja.getRange(i+2,2).getValue();

        return {
          estado:"duplicado",
          agente:agenteExistente
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

  return {
    estado:"ok"
  };

}

const SPREADSHEET_ID = "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w";

function getAgentes() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Agentes");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
  return data.map(row => row[0]).filter(name => name && name.trim() !== "");
}

function getHistorial(agente) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("PQRSF Creados");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getDataRange().getValues();
  const history = data.slice(1)
    .filter(row => row[1] === agente)
    .reverse()
    .slice(0, 20)
    .map(row => ({
      fecha: row[0],
      radicado: row[2],
      clasificacion: row[4],
      caso: row[3]
    }));

  return history;
}

function getMensajes(usuario) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("CHAT");
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[3] === "TODOS" || row[3] === usuario || row[1] === usuario)
    .map(row => ({
      fecha: row[0],
      usuario: row[1],
      mensaje: row[2],
      destinatario: row[3]
    }));
}

function enviarMensaje(datos) {
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
}

function getNotificaciones(usuario) {
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
      fecha: row[1],
      radicado: row[2],
      mensaje: row[3],
      estado: row[4],
      recibido: row[5]
    }))
    .filter(n => n.funcionaria === usuario && !n.recibido);
}

function marcarNotificacionRecibida(id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Notificaciones");
  sheet.getRange(id, 6).setValue(new Date());
  return { estado: "ok" };
}
