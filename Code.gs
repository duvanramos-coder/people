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
    const sheet = ss.getSheetByName('Usuarios');
    const data = sheet.getDataRange().getValues();

    // Headers: Asesor, Correo, Canal, Contraseña
    // Índices: 0: Asesor, 1: Correo, 2: Canal, 3: Contraseña
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === email && String(data[i][3]) === String(password)) {
        return {
          nombre: data[i][0],
          email: data[i][1],
          canal: data[i][2],
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
    const usersSheet = ss.getSheetByName('Usuarios');
    const userData = usersSheet.getDataRange().getValues();

    let nombreAsesor = '';
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][1] === email) {
        nombreAsesor = userData[i][0];
        break;
      }
    }

    if (!nombreAsesor) return [];

    const shiftsSheet = ss.getSheetByName('Turnos');
    const shiftsData = shiftsSheet.getDataRange().getValues();
    const headers = shiftsData[0];
    const filteredShifts = [];

    // Headers esperados: Nombre, Campaña, Subcampaña, Semana, Fecha, Horario, Almuerzo, Breaks, Observación
    for (let i = 1; i < shiftsData.length; i++) {
      if (shiftsData[i][0] === nombreAsesor) {
        const shift = {};
        headers.forEach((header, index) => {
          let value = shiftsData[i][index];
          // Formatear fecha si es objeto Date
          if (value instanceof Date) {
            value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
          }
          shift[header.toLowerCase().replace(/ /g, '_')] = value;
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
