const SPREADSHEET_ID = '1Mrp2jI0jCJ7NZ5Twy65Yiz17cOb2Eo_dgU6EOcTNZYs';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Du Hub | Operativo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Valida las credenciales del usuario contra la hoja "USUARIOS"
 */
function validarLogin(usuario, contrasena) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('USUARIOS');
    if (!sheet) return { success: false, message: 'Hoja USUARIOS no encontrada' };

    const data = sheet.getDataRange().getValues();

    // Columnas: A: Usuario, B: Correo, C: Canal, D: Contraseña, E: Nombre
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].toString().trim().toLowerCase() === usuario.toString().trim().toLowerCase()) {
        if (row[3] && row[3].toString().trim() === contrasena.toString().trim()) {
          return {
            success: true,
            usuario: row[0],
            nombre: row[4] || row[0]
          };
        }
      }
    }
    return { success: false, message: 'Credenciales inválidas' };
  } catch (e) {
    return { success: false, message: 'Error de servidor: ' + e.toString() };
  }
}

/**
 * Obtiene los módulos asignados al usuario y sus URLs
 */
function obtenerDatosDashboard(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userSheet = ss.getSheetByName('USUARIOS');
    const linksSheet = ss.getSheetByName('LINK APPS');

    if (!userSheet || !linksSheet) return { success: false, message: 'Hojas de datos no encontradas' };

    const userData = userSheet.getDataRange().getValues();
    const linksData = linksSheet.getDataRange().getValues();

    let userRow = null;
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][0] && userData[i][0].toString().trim().toLowerCase() === usuario.toString().trim().toLowerCase()) {
        userRow = userData[i];
        break;
      }
    }

    if (!userRow) return { success: false, message: 'Usuario no encontrado' };

    const nombre = userRow[4] || userRow[0];
    const modulosAsignados = [];
    // Los módulos empiezan en la columna F (índice 5)
    for (let j = 5; j < userRow.length; j++) {
      if (userRow[j] && userRow[j].toString().trim() !== "") {
        modulosAsignados.push(userRow[j].toString().trim());
      }
    }

    const linksMap = {};
    for (let k = 1; k < linksData.length; k++) {
      if (linksData[k][0]) {
        linksMap[linksData[k][0].toString().trim()] = linksData[k][1];
      }
    }

    const modulosFinales = modulosAsignados.map(m => {
      return {
        nombre: m,
        url: linksMap[m] || null
      };
    }).filter(m => m.url !== null);

    return {
      success: true,
      nombre: nombre,
      modulos: modulosFinales
    };
  } catch (e) {
    return { success: false, message: 'Error al cargar dashboard: ' + e.toString() };
  }
}
