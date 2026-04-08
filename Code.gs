/**
 * SISTEMA DE TURNOS - People Bpo
 * By Duvan Ramos
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Cree un nuevo proyecto en script.google.com
 * 2. Copie el contenido de Code.gs, index.html y dashboard.html
 * 3. Asegúrese de que el ID de la hoja sea: 1WJpdXTfiwdtof5l7Twb8LqbNWZ9sfAzD-IJeWCmU5zw
 * 4. Implemente como Aplicación Web (Acceso: Cualquier persona)
 */

const SPREADSHEET_ID = '1WJpdXTfiwdtof5l7Twb8LqbNWZ9sfAzD-IJeWCmU5zw';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistema de Turnos - People Bpo')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    return '<!-- Error including file: ' + filename + ' -->';
  }
}

function obtenerUsuarios() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Agentes');
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    return data.map(r => r[0]);
  } catch (e) {
    console.error('Error en obtenerUsuarios: ' + e.message);
    return [];
  }
}

function validarLogin(usuario, contraseña) {
  try {
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
  } catch (e) {
    console.error('Error en validarLogin: ' + e.message);
    return { success: false, error: e.message };
  }
}

function obtenerTurnos(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Turnos');
    if (!sheet) throw new Error("Hoja 'Turnos' no encontrada");

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const userTurnos = data.slice(1).filter(row => {
      // Column L is index 11. Ensure row has enough columns and match is case-insensitive/trimmed
      if (row.length < 12) return false;
      const rowUser = String(row[11]).trim().toUpperCase();
      const searchUser = String(usuario).trim().toUpperCase();
      return rowUser === searchUser;
    });

    const formattedTurnos = userTurnos.map(row => {
      const fechaOriginal = row[4]; // Columna E
      let fechaObj = null;

      if (fechaOriginal instanceof Date) {
        fechaObj = fechaOriginal;
      } else if (typeof fechaOriginal === 'string' && fechaOriginal.trim() !== '') {
        const parts = fechaOriginal.split('/');
        if (parts.length === 3) {
          fechaObj = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          fechaObj = new Date(fechaOriginal);
        }
      }

      if (!fechaObj || isNaN(fechaObj.getTime())) {
        return {
          dia: 'N/A',
          fecha: fechaOriginal || '-',
          fechaRaw: 0,
          horario: row[5],
          almuerzo: row[6],
          breakMañana: row[7],
          breakTarde: row[8],
          observacion: row[9],
          asistencia: row[10]
        };
      }

      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const diaNombre = diasSemana[fechaObj.getDay()];
      const fechaFormateada = Utilities.formatDate(fechaObj, Session.getScriptTimeZone(), 'dd/MM/yyyy');

      return {
        dia: diaNombre,
        fecha: fechaFormateada,
        fechaRaw: fechaObj.getTime(),
        horario: row[5],
        almuerzo: row[6],
        breakMañana: row[7],
        breakTarde: row[8],
        observacion: row[9],
        asistencia: row[10]
      };
    });

    formattedTurnos.sort((a, b) => a.fechaRaw - b.fechaRaw);
    return formattedTurnos;
  } catch (e) {
    console.error('Error en obtenerTurnos: ' + e.message);
    throw new Error('No se pudieron cargar los turnos: ' + e.message);
  }
}
