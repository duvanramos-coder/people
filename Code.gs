/**
 * SISTEMA DE GESTIÓN DE TURNOS - PEOPLE BPO
 * Desarrollado por: Duvan Ramos
 * Nivel: Senior Software Engineer
 */

const SPREADSHEET_ID = '1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU'; // ID de la hoja de cálculo principal

/**
 * Función principal para servir la aplicación web
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistema de Turnos | People BPO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Helper para incluir archivos HTML (CSS y JS modular)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Verifica las credenciales del usuario
 * @param {string} email
 * @param {string} password
 * @return {object|null} Datos del usuario o null si falla
 */
function verifyLogin(email, password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Agentes');
    const data = sheet.getDataRange().getValues();

    // Basado en la imagen proporcionada:
    // Index 0: Asesor (ID), 1: Nombre, 2: Contraseña, 3: Correo corporativo, 4: Canal
    for (let i = 1; i < data.length; i++) {
      if (data[i][3] === email && String(data[i][2]) === String(password)) {
        return {
          asesorId: data[i][0],
          nombre: data[i][1],
          email: data[i][3],
          canal: data[i][4],
          success: true
        };
      }
    }
    return { success: false, message: 'Credenciales inválidas' };
  } catch (error) {
    console.error('Error en verifyLogin:', error);
    return { success: false, message: 'Error de conexión con la base de datos' };
  }
}

/**
 * Obtiene los turnos filtrados por el correo del usuario
 * @param {string} email
 * @return {array} Lista de turnos
 */
function getShiftsForUser(email) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const agentsSheet = ss.getSheetByName('Agentes');
    const agentsData = agentsSheet.getDataRange().getValues();

    let nombreUsuario = '';
    for (let i = 1; i < agentsData.length; i++) {
      if (agentsData[i][3] === email) {
        nombreUsuario = agentsData[i][1]; // Col B: Nombre (ej. Angi Johana Banda Montes)
        break;
      }
    }

    if (!nombreUsuario) return [];

    const shiftsSheet = ss.getSheetByName('Turnos');
    const shiftsData = shiftsSheet.getDataRange().getValues();
    const headers = [
      'nombre', 'campaña', 'subcampaña', 'semana', 'fecha',
      'horario', 'almuerzo', 'break_mañana', 'break_tarde', 'observacion'
    ];
    const filteredShifts = [];

    // En la hoja 'Turnos' la columna A (Nombre) contiene el nombre completo del asesor
    for (let i = 1; i < shiftsData.length; i++) {
      if (shiftsData[i][0] === nombreUsuario) {
        const shift = {};
        headers.forEach((header, index) => {
          let value = shiftsData[i][index];
          // Formatear fecha si es objeto Date
          if (value instanceof Date && header === 'fecha') {
            value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
          }
          shift[header] = value || '-';
        });
        filteredShifts.push(shift);
      }
    }

    return filteredShifts;
  } catch (error) {
    console.error('Error en getShiftsForUser:', error);
    return [];
  }
}
