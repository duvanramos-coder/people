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
    if (data[i][4].toLowerCase() === usuario.toLowerCase() && data[i][3] == password) {
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
    'No',
    data.observacion,
    data.sncProceso ? 'SI' : '',
    ''
  ]);

  return { success: true };
}

// ================= UTILS =================
function normalize(str) {
  if (!str) return "";
  return str.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

// ================= RESUMEN =================
function obtenerResumenHoy(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
    const data = sh.getDataRange().getValues();
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const uNorm = normalize(usuario);

    let efectivos = 0, devueltos = 0;

    for (let i = 1; i < data.length; i++) {
      try {
        const f = new Date(data[i][0]); f.setHours(0,0,0,0);
        if (f.getTime() === hoy.getTime() && normalize(data[i][2]) === uNorm) {
          const status = normalize(data[i][4]);
          if (status === 'no') efectivos++;
          else if (status === 'si') devueltos++;
        }
      } catch(e) {}
    }

    return { efectivos, devueltos, total: efectivos + devueltos };
  } catch(e) {
    return { efectivos: 0, devueltos: 0, total: 0 };
  }
}

// ================= HISTORIAL =================
function obtenerHistorial(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
    const data = sh.getDataRange().getValues();
    const res = [];
    const uNorm = normalize(usuario);

    for (let i = data.length - 1; i > 0; i--) {
      if (normalize(data[i][2]) === uNorm) {
        let fStr = data[i][0];
        try {
          const d = new Date(data[i][0]);
          if (!isNaN(d.getTime())) fStr = Utilities.formatDate(d, "GMT-5", "dd/MM/yyyy");
        } catch(e) {}

        res.push({
          fecha: fStr,
          radicado: data[i][3],
          devuelto: data[i][4]
        });
        if (res.length >= 10) break;
      }
    }
    return res;
  } catch(e) {
    return [];
  }
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
// ================= NOTIFICACIONES =================
function obtenerNotificaciones(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Notificaciones');
    if (!sh) return [];
    const data = sh.getDataRange().getValues();
    const uNorm = normalize(usuario);
    const res = [];

    for (let i = 1; i < data.length; i++) {
      if (normalize(data[i][0]) === uNorm && !data[i][5]) {
        let fStr = data[i][1];
        try {
          const d = new Date(data[i][1]);
          if (!isNaN(d.getTime())) fStr = Utilities.formatDate(d, "GMT-5", "dd/MM/yyyy");
        } catch(e) {}

        res.push({
          id: i + 1,
          radicado: data[i][2],
          mensaje: data[i][3],
          fecha: fStr
        });
      }
    }
    return res;
  } catch (e) { return []; }
}

function marcarRecibido(id) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Notificaciones');
    sh.getRange(id, 6).setValue(new Date());
    return true;
  } catch (e) { return false; }
}

// ================= CHAT =================
function enviarMensajeChat(data) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('CHAT');
    sh.appendRow([new Date(), data.usuario, data.mensaje, data.destinatario || 'TODOS']);
    return true;
  } catch (e) { return false; }
}

function obtenerChat(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('CHAT');
    const data = sh.getDataRange().getValues();
    const uNorm = normalize(usuario);
    const res = [];

    for (let i = Math.max(1, data.length - 50); i < data.length; i++) {
      const dest = data[i][3];
      if (dest === 'TODOS' || normalize(data[i][1]) === uNorm || normalize(dest) === uNorm) {
        let fStr = data[i][0];
        try {
          const d = new Date(data[i][0]);
          if (!isNaN(d.getTime())) fStr = Utilities.formatDate(d, "GMT-5", "HH:mm");
        } catch(e) {}

        res.push({
          usuario: data[i][1],
          mensaje: data[i][2],
          fecha: fStr,
          esPrivado: dest !== 'TODOS'
        });
      }
    }
    return res;
  } catch (e) { return []; }
}
