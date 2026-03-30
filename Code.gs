/**
 * SISTEMA DE GESTIÓN DE TURNOS - PEOPLE BPO
 * Desarrollado por: Duvan Ramos 2026
 * Nivel: Senior Software Engineer
 */

const SPREADSHEET_ID = '1WJpdXTfiwdtof5l7Twb8LqbNWZ9sfAzD-IJeWCmU5zw';

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
 * Obtiene la lista de nombres de asesores para el login
 */
function getUsersList() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Agentes');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    // Col A: Nombre
    const users = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) users.push(data[i][0]);
    }
    return users.sort();
  } catch (e) {
    console.error('Error en getUsersList:', e);
    return [];
  }
}

/**
 * Verifica las credenciales del usuario
 */
function verifyLogin(name, password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Agentes');
    if (!sheet) return { success: false, message: 'No se encontró la hoja de Agentes.' };

    const data = sheet.getDataRange().getValues();

    // Col A: Nombre, Col B: Contraseña, Col C: Canal
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === name.trim() && String(data[i][1]).trim() === password.trim()) {
        return {
          success: true,
          nombre: data[i][0],
          canal: data[i][2] || 'Sin Canal'
        };
      }
    }
    return { success: false, message: 'Contraseña incorrecta.' };
  } catch (error) {
    console.error('Error en verifyLogin:', error);
    return { success: false, message: 'Error de conexión: ' + error.toString() };
  }
}

/**
 * Obtiene los turnos filtrados por el nombre del usuario
 */
function getShiftsForUser(name) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Turnos');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const headers = [
      'nombre', 'campaña', 'subcampaña', 'semana', 'fecha',
      'horario', 'almuerzo', 'break_mañana', 'break_tarde', 'observacion'
    ];

    const filteredShifts = [];
    const nameLower = name.trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const rowName = String(data[i][0]).trim().toLowerCase();
      if (rowName === nameLower) {
        const shift = {};
        // Map columns A to J (index 0 to 9)
        headers.forEach((header, index) => {
          let value = data[i][index];
          if (value instanceof Date && header === 'fecha') {
            value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
          }
          shift[header] = value || '-';
        });
        filteredShifts.push(shift);
      }
    }

    // Ordenar por fecha (asumiendo formato dd/MM/yyyy para la visualización,
    // pero idealmente se filtraría/ordenaría por el objeto Date original si fuera necesario)
    return filteredShifts;
  } catch (error) {
    console.error('Error en getShiftsForUser:', error);
    return [];
  }
}
