const SPREADSHEET_ID = '1WJpdXTfiwdtof5l7Twb8LqbNWZ9sfAzD-IJeWCmU5zw';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistema de Turnos - Virtual Ramos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function obtenerUsuarios() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Agentes');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return data.map(r => r[0]);
}

function validarLogin(usuario, contraseña) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Agentes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === usuario && data[i][2].toString() === contraseña.toString()) {
      return {
        success: true,
        nombre: data[i][1],
        canal: data[i][3]
      };
    }
  }
  return { success: false };
}

function obtenerTurnos(usuario) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Turnos');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const userTurnos = data.slice(1).filter(row => row[11] === usuario);

  const formattedTurnos = userTurnos.map(row => {
    const fechaOriginal = row[4]; // Columna E
    let fechaObj;

    if (fechaOriginal instanceof Date) {
      fechaObj = fechaOriginal;
    } else {
      // Intentar parsear DD/MM/YYYY
      const parts = fechaOriginal.split('/');
      if (parts.length === 3) {
        fechaObj = new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        fechaObj = new Date(fechaOriginal);
      }
    }

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaNombre = diasSemana[fechaObj.getDay()];
    const fechaFormateada = Utilities.formatDate(fechaObj, Session.getScriptTimeZone(), 'dd/MM/yyyy');

    return {
      dia: diaNombre,
      fecha: fechaFormateada,
      fechaRaw: fechaObj.getTime(), // Para ordenar
      horario: row[5],
      almuerzo: row[6],
      breakMañana: row[7],
      breakTarde: row[8],
      observacion: row[9],
      asistencia: row[10]
    };
  });

  // Ordenar por fecha ascendente
  formattedTurnos.sort((a, b) => a.fechaRaw - b.fechaRaw);

  return formattedTurnos;
}
