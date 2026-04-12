const SPREADSHEET_ID = '1C4f1DBu2VW9fJPISnzH0icsELR3146gIS3c-rKG5Vtg';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('People BPO - Gestión Operativa')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ================= LOGIN =================
function obtenerUsuarios() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ASESORES');
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  return data.slice(1).map(r => ({ id: r[4], nombre: r[4] })).filter(u => u.id);
}

function login(usuario, password) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ASESORES');
  const data = sh.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][4] && data[i][4].toString().trim().toLowerCase() === usuario.trim().toLowerCase() && data[i][3] == password) {
      return { success: true, user: { id: data[i][4], nombre: data[i][4] } };
    }
  }
  return { success: false, message: 'Usuario o contraseña incorrectos.' };
}

// ================= RADICACIÓN =================
function guardarRadicacion(data) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
  const datos = sh.getDataRange().getValues();

  // 🔥 FIX FECHA (ERROR 1)
  let fecha;
  if (data.fecha) {
    const partes = data.fecha.split('-'); // yyyy-mm-dd
    fecha = new Date(partes[0], partes[1] - 1, partes[2]); // SIN desfase
  } else {
    fecha = new Date();
  }

  let filaEncontrada = -1;

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][3]).trim() === String(data.radicado).trim()) {
      filaEncontrada = i + 1;
      break;
    }
  }

  if (filaEncontrada !== -1) {
    if (data.sncProceso) {
      sh.getRange(filaEncontrada, 1).setValue(fecha);
      sh.getRange(filaEncontrada, 5).setValue('NA');
      sh.getRange(filaEncontrada, 7).setValue('SI');
      return { success: true, updated: true };
    }

    throw new Error('El radicado ya existe en el sistema.');
  }

  sh.appendRow([
    fecha,
    '',
    data.funcionaria,
    data.radicado,
    data.devuelto ? 'Si' : 'No', // FIXED: Use data.devuelto
    data.observacion,
    data.sncProceso ? 'SI' : '',
    ''
  ]);

  return { success: true };
}

// ================= RESUMEN =================
function obtenerResumenHoy(usuario) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
  const data = sh.getDataRange().getValues();
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  let efectivos = 0, devueltos = 0;
  const userLower = usuario.trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const f = new Date(data[i][0]); f.setHours(0,0,0,0);
    const rowUser = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
    if (f.getTime() === hoy.getTime() && rowUser === userLower) {
      const status = data[i][4] ? data[i][4].toString().trim() : "";
      if (status === 'No') efectivos++;
      else if (status === 'Si' || status === 'Sí') devueltos++;
    }
  }

  return { efectivos, devueltos, total: efectivos + devueltos };
}

// ================= HISTORIAL =================
function obtenerHistorial(usuario) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
  const data = sh.getDataRange().getValues();
  const res = [];
  const userLower = usuario.trim().toLowerCase();

  for (let i = data.length - 1; i > 0; i--) {
    const rowUser = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
    if (rowUser === userLower) {
      res.push({
        fecha: data[i][0],
        radicado: data[i][3],
        devuelto: data[i][4]
      });
      if (res.length >= 10) break;
    }
  }
  return res;
}

// ================= SNC =================
function buscarSNC(radicado) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
  const data = sh.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] == radicado) {
      return {
        row: i + 1,
        radicado: data[i][3],
        funcionaria: data[i][2], // 🔥 FIX ERROR 2
        observacion: data[i][5] || '',
        estado: data[i][7] ? 'Solucionado' : (data[i][6] === 'SI' ? 'En proceso' : 'Sin SNC'),
        canClose: data[i][6] === 'SI' && !data[i][7]
      };
    }
  }
  return null;
}

// ================= BUSQUEDA GENERAL =================
function buscarGeneral(radicado) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
  const data = sh.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] == radicado) {
      return {
        funcionaria: data[i][2],
        fecha: data[i][0],
        observacion: data[i][5] || ''
      };
    }
  }
  return null;
}

// ================= SOLUCIONAR SNC =================
function marcarSolucionado(rowId) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');

  sh.getRange(rowId, 8).setValue(new Date());
  sh.getRange(rowId, 5).setValue('No');
  sh.getRange(rowId, 7).setValue('');

  return true;
}

// ================= STUBS FOR MISSING FUNCTIONS =================
function obtenerNotificaciones(usuario) {
  return [];
}

function marcarRecibido(id) {
  return true;
}

function obtenerChat(usuario) {
  return [];
}

function enviarMensajeChat(data) {
  return true;
}
