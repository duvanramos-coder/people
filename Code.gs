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

  let fecha;
  if (data.fecha) {
    const partes = data.fecha.split('-'); // yyyy-mm-dd
    fecha = new Date(partes[0], partes[1] - 1, partes[2]);
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
    data.devuelto ? 'Si' : 'No',
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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
      const fVal = data[i][0];
      if (!(fVal instanceof Date)) continue;
      const f = new Date(fVal); f.setHours(0,0,0,0);

      if (f.getTime() === hoy.getTime() && normalize(data[i][2]) === uNorm) {
        const est = normalize(data[i][4]);
        if (est === 'no') efectivos++;
        else if (est === 'si' || est === 'sí') devueltos++;
      }
    }
    return { efectivos, devueltos, total: efectivos + devueltos };
  } catch(e) { return { efectivos: 0, devueltos: 0, total: 0 }; }
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
        let fDisplay = data[i][0];
        if (fDisplay instanceof Date) {
          fDisplay = Utilities.formatDate(fDisplay, "GMT-5", "dd/MM/yyyy");
        }
        res.push({
          fecha: fDisplay,
          radicado: data[i][3],
          devuelto: data[i][4]
        });
        if (res.length >= 10) break;
      }
    }
    return res;
  } catch(e) { return []; }
}

// ================= SNC =================
function buscarSNC(radicado) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
  const data = sh.getDataRange().getValues();
  const rBusq = String(radicado).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim() === rBusq) {
      return {
        row: i + 1,
        radicado: data[i][3],
        funcionaria: data[i][2],
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
  const rBusq = String(radicado).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim() === rBusq) {
      let fDisplay = data[i][0];
      if (fDisplay instanceof Date) {
        fDisplay = Utilities.formatDate(fDisplay, "GMT-5", "dd/MM/yyyy");
      }
      return {
        funcionaria: data[i][2],
        fecha: fDisplay,
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
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('NOTIFICACIONES');
    if (!sh) return [];
    const data = sh.getDataRange().getValues();
    const res = [];
    const uNorm = normalize(usuario);

    for (let i = 1; i < data.length; i++) {
      if (normalize(data[i][0]) === uNorm && data[i][4] !== 'Recibido') {
        let fStr = data[i][1];
        try { if(fStr instanceof Date) fStr = Utilities.formatDate(fStr, "GMT-5", "dd/MM HH:mm"); } catch(e){}
        res.push({
          id: i + 1,
          fecha: fStr,
          radicado: data[i][2],
          mensaje: data[i][3]
        });
      }
    }
    return res;
  } catch(e) { return []; }
}

function marcarRecibido(id) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('NOTIFICACIONES');
  sh.getRange(id, 5).setValue('Recibido');
  sh.getRange(id, 6).setValue(new Date());
  return true;
}

// ================= CHAT =================
function obtenerChat(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('CHAT');
    if (!sh) return [];
    const data = sh.getDataRange().getValues();
    const res = [];
    const uNorm = normalize(usuario);

    for (let i = 1; i < data.length; i++) {
      const dest = String(data[i][2]);
      if (dest === 'TODOS' || normalize(dest) === uNorm || normalize(data[i][0]) === uNorm) {
        res.push({
          usuario: data[i][0],
          mensaje: data[i][3],
          fecha: Utilities.formatDate(new Date(data[i][1]), "GMT-5", "HH:mm"),
          esPrivado: dest !== 'TODOS'
        });
      }
    }
    return res.slice(-50);
  } catch(e) { return []; }
}

function enviarMensajeChat(data) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('CHAT');
  sh.appendRow([
    data.usuario,
    new Date(),
    data.destinatario || 'TODOS',
    data.mensaje
  ]);
  return true;
}

// ================= WFM / HORARIOS =================
function obtenerHorarioHoy(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Turnos');
    if (!sh) return null;
    const data = sh.getDataRange().getValues();
    const hoy = new Date();
    const hoyStr = Utilities.formatDate(hoy, "GMT-5", "d/M/yyyy");

    for (let i = 1; i < data.length; i++) {
      let fVal = data[i][3];
      let fStr = "";
      if (fVal instanceof Date) {
        fStr = Utilities.formatDate(fVal, "GMT-5", "d/M/yyyy");
      } else {
        fStr = String(fVal).trim();
      }

      if (data[i][0] === usuario && fStr === hoyStr) {
        if (data[i][4] === 'DESCANSO') return { descanso: true };
        return {
          jornada: data[i][4],
          almuerzo: data[i][5],
          break1: data[i][6],
          break2: data[i][7]
        };
      }
    }
    return null;
  } catch(e) { return null; }
}

function verificarHorarios(usuario) {
  try {
    const horario = obtenerHorarioHoy(usuario);
    if (!horario || horario.descanso) return;

    const hoy = new Date();
    const eventos = [];

    const parseRange = (range, label) => {
      if (!range || range === "Sin break" || range === "-" || range === "DESCANSO") return;
      const parts = range.split(" a ");
      if (parts.length !== 2) return;
      eventos.push({ time: convertirHora(parts[0]), msg: `Inicio de ${label}` });
      eventos.push({ time: convertirHora(parts[1]), msg: `Fin de ${label}` });
    };

    parseRange(horario.jornada, "Jornada");
    parseRange(horario.almuerzo, "Almuerzo");
    parseRange(horario.break1, "Break Mañana");
    parseRange(horario.break2, "Break Tarde");

    eventos.forEach(ev => {
      const diff = (ev.time.getTime() - hoy.getTime()) / 60000;
      if (diff > 0 && diff <= 2.1) {
        if (!yaNotificado(usuario, "HORARIO", ev.msg)) {
          const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('NOTIFICACIONES');
          sh.appendRow([usuario, new Date(), "HORARIO", ev.msg, "Pendiente", ""]);
        }
      }
    });
  } catch(e) {}
}

function convertirHora(horaStr) {
  const hoy = new Date();
  const match = horaStr.toLowerCase().match(/(\d+):(\d+)(am|pm)/);
  if (!match) return new Date();

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3];

  if (hours === 12 && modifier === 'am') hours = 0;
  else if (hours !== 12 && modifier === 'pm') hours += 12;

  const d = new Date(hoy.getTime());
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function yaNotificado(usuario, radicado, mensaje) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('NOTIFICACIONES');
    const data = sh.getDataRange().getValues();
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    for (let i = data.length - 1; i >= Math.max(1, data.length - 50); i--) {
      const fVal = data[i][1];
      if (!(fVal instanceof Date)) continue;
      const f = new Date(fVal); f.setHours(0,0,0,0);
      if (data[i][0] === usuario && data[i][2] === radicado && data[i][3] === mensaje && f.getTime() === hoy.getTime()) {
        return true;
      }
    }
  } catch(e) {}
  return false;
}
