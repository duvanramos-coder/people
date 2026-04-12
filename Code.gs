const SPREADSHEET_ID = '1C4f1DBu2VW9fJPISnzH0icsELR3146gIS3c-rKG5Vtg';

/**
 * Carga la interfaz principal.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('People BPO - Gestión Operativa')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Valida credenciales contra la hoja ASESORES.
 */
function login(usuario, password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('ASESORES');
    if (!sh) throw new Error('No se encontró la hoja ASESORES');

    const data = sh.getDataRange().getValues();
    // Headers: Usuario (A), Correo (B), Canal (C), Contraseña (D), Nombre (E)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(usuario).toLowerCase() && String(data[i][3]) === String(password)) {
        return {
          success: true,
          user: {
            id: data[i][0],
            nombre: data[i][4],
            correo: data[i][1],
            canal: data[i][2]
          }
        };
      }
    }
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  } catch (e) {
    throw new Error('Error en login: ' + e.message);
  }
}

/**
 * Guarda una nueva radicación en la hoja GESTIONES.
 */
function guardarRadicacion(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('GESTIONES');
    if (!sh) throw new Error('No se encontró la hoja GESTIONES');

    // Validación de duplicados (C: Funcionaria, D: Radicado)
    if (data.radicado) {
      const vals = sh.getRange("D2:D" + Math.max(sh.getLastRow(), 2)).getValues().flat();
      if (vals.includes(String(data.radicado).trim())) {
        throw new Error('El radicado ya existe en el sistema.');
      }
    }

    // Fecha: Si no viene, usar actual.
    const fecha = data.fecha ? new Date(data.fecha) : new Date();

    // Mapeo: A: Fecha, B: Libre, C: Funcionaria, D: Radicado, E: Devuelto, F: Observación, G: SNC Proceso, H: SNC Solucionado
    const fila = [
      fecha,
      '', // Libre
      data.funcionaria,
      data.radicado,
      data.devuelto ? 'Sí' : 'No',
      data.observacion,
      data.sncProceso ? 'SI' : '',
      '' // SNC Solucionado (Fecha)
    ];

    sh.appendRow(fila);
    return { success: true };
  } catch (e) {
    throw new Error('Error al guardar: ' + e.message);
  }
}

/**
 * Obtiene el resumen del día actual para una funcionaria.
 */
function obtenerResumenHoy(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('GESTIONES');
    if (!sh) return { efectivos: 0, devueltos: 0, total: 0 };

    const data = sh.getDataRange().getValues();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let efectivos = 0;
    let devueltos = 0;

    // A: Fecha, C: Funcionaria, E: Devuelto
    for (let i = 1; i < data.length; i++) {
      const fCase = new Date(data[i][0]);
      fCase.setHours(0, 0, 0, 0);

      if (fCase.getTime() === hoy.getTime() && String(data[i][2]).toLowerCase() === String(usuario).toLowerCase()) {
        if (data[i][4] === 'No') efectivos++;
        else if (data[i][4] === 'Sí') devueltos++;
      }
    }

    return {
      efectivos: efectivos,
      devueltos: devueltos,
      total: efectivos + devueltos
    };
  } catch (e) {
    return { efectivos: 0, devueltos: 0, total: 0 };
  }
}

/**
 * Obtiene el historial reciente de radicados.
 */
function obtenerHistorial(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('GESTIONES');
    if (!sh) return [];

    const data = sh.getDataRange().getValues();
    const res = [];

    // Filtrar y ordenar por fecha DESC (últimos 20)
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][2]).toLowerCase() === String(usuario).toLowerCase()) {
        res.push({
          fecha: Utilities.formatDate(new Date(data[i][0]), "GMT-5", "yyyy-MM-dd HH:mm"),
          radicado: data[i][3],
          devuelto: data[i][4],
          observacion: data[i][5],
          snc: data[i][6],
          solucionado: data[i][7]
        });
        if (res.length >= 20) break;
      }
    }
    return res;
  } catch (e) {
    return [];
  }
}

/**
 * Obtiene notificaciones para la asesora.
 */
function obtenerNotificaciones(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('NOTIFICACIONES');
    if (!sh) return [];

    const data = sh.getDataRange().getValues();
    const res = [];
    // A: Funcionaria, B: Fecha, C: Radicado, D: Mensaje, E: Estado, F: Recibido
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(usuario).toLowerCase() && !data[i][5]) {
        res.push({
          id: i + 1,
          fecha: Utilities.formatDate(new Date(data[i][1]), "GMT-5", "yyyy-MM-dd"),
          radicado: data[i][2],
          mensaje: data[i][3],
          estado: data[i][4]
        });
      }
    }
    return res;
  } catch (e) {
    return [];
  }
}

/**
 * Marca una notificación como recibida.
 */
function marcarRecibido(rowId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('NOTIFICACIONES');
    sh.getRange(rowId, 6).setValue(new Date()); // F: Recibido
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Busca un SNC por radicado.
 */
function buscarSNC(radicado) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('GESTIONES');
    const data = sh.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][3]).trim() === String(radicado).trim()) {
        return {
          row: i + 1,
          radicado: data[i][3],
          funcionaria: data[i][2],
          estado: data[i][7] ? 'Solucionado' : (data[i][6] === 'SI' ? 'En proceso' : 'Sin SNC'),
          fecha: Utilities.formatDate(new Date(data[i][0]), "GMT-5", "yyyy-MM-dd"),
          observacion: data[i][5],
          canClose: data[i][6] === 'SI' && !data[i][7]
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Marca un SNC como solucionado.
 */
function marcarSolucionado(rowId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('GESTIONES');
    sh.getRange(rowId, 8).setValue(new Date()); // H: SNC Solucionado
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Envía un mensaje al chat.
 */
function enviarMensajeChat(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('CHAT');
    sh.appendRow([new Date(), data.usuario, data.mensaje, data.destinatario || 'TODOS']);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Obtiene mensajes del chat.
 */
function obtenerChat(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('CHAT');
    if (!sh) return [];

    const data = sh.getDataRange().getValues();
    const res = [];
    // A: Fecha, B: Usuario, C: Mensaje, D: Destinatario
    for (let i = Math.max(1, data.length - 50); i < data.length; i++) {
      const msg = data[i];
      if (msg[3] === 'TODOS' || msg[3] === usuario || msg[1] === usuario) {
        res.push({
          fecha: Utilities.formatDate(new Date(msg[0]), "GMT-5", "HH:mm"),
          usuario: msg[1],
          mensaje: msg[2],
          esPrivado: msg[3] !== 'TODOS'
        });
      }
    }
    return res;
  } catch (e) {
    return [];
  }
}
