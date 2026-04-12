const SPREADSHEET_ID = '1C4f1DBu2VW9fJPISnzH0icsELR3146gIS3c-rKG5Vtg';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('People BPO - Gestión Operativa')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ================= UTILS =================
function normalize(str) {
  if (!str) return "";
  return str.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

// ================= LOGIN =================
function obtenerUsuarios() {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ASESORES');
    if (!sh) return [];
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    return data.map(r => ({ id: r[0], nombre: r[4] })).filter(u => u.id);
  } catch (e) {
    throw new Error('Error al obtener usuarios: ' + e.message);
  }
}

function login(usuario, password) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ASESORES');
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    const uNorm = normalize(usuario);

    for (let i = 0; i < data.length; i++) {
      const idNorm = normalize(data[i][0]);
      const nameNorm = normalize(data[i][4]);

      if ((idNorm === uNorm || nameNorm === uNorm) && data[i][3] == password) {
        return { success: true, user: { id: data[i][0], nombre: data[i][4] } };
      }
    }
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  } catch (e) {
    throw new Error('Error en el login: ' + e.message);
  }
}

// ================= RADICACIÓN =================
function guardarRadicacion(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('GESTIONES');
    const lastRow = sh.getLastRow();
    const datos = lastRow >= 2 ? sh.getRange(2, 4, lastRow - 1, 1).getValues() : [];

    let fecha;
    if (data.fecha) {
      const partes = data.fecha.split('-'); // yyyy-mm-dd
      fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    } else {
      fecha = new Date();
    }

    let filaEncontrada = -1;
    const radicadoBuscado = String(data.radicado).trim();

    for (let i = 0; i < datos.length; i++) {
      if (String(datos[i][0]).trim() === radicadoBuscado) {
        filaEncontrada = i + 2;
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
  } catch (e) {
    throw new Error('Error al guardar: ' + e.message);
  }
}

// ================= DASHBOARD DATA =================
function obtenerDatosDashboard(usuario) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { efectivos: 0, devueltos: 0, total: 0, historial: [] };

    // Get relevant columns: A(Date), C(User), D(Radicado), E(Status)
    const data = sh.getRange(2, 1, lastRow - 1, 5).getValues();
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const uNorm = normalize(usuario);

    let efectivos = 0, devueltos = 0;
    const historial = [];

    // Reverse iterate to get latest first
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const rowUserNorm = normalize(row[2]);

      if (rowUserNorm === uNorm) {
        const status = row[4] ? row[4].toString().trim() : "";
        const statusNorm = normalize(status);

        // Date check for stats
        try {
          const f = new Date(row[0]);
          if (!isNaN(f.getTime())) {
            f.setHours(0,0,0,0);
            if (f.getTime() === hoy.getTime()) {
              if (statusNorm === 'no') efectivos++;
              else if (statusNorm === 'si') devueltos++;
            }
          }
        } catch(e) {}

        // History list
        if (historial.length < 10) {
          let fechaFormateada = '-';
          try {
            const d = new Date(row[0]);
            if (!isNaN(d.getTime())) {
              fechaFormateada = Utilities.formatDate(d, "GMT-5", "dd/MM/yyyy");
            } else if (row[0]) {
               fechaFormateada = row[0].toString(); // Fallback if string
            }
          } catch(e) {}

          historial.push({
            fecha: fechaFormateada,
            radicado: row[3] || '-',
            devuelto: status
          });
        }
      }
    }

    return { efectivos, devueltos, total: efectivos + devueltos, historial };
  } catch (e) {
    throw new Error('Error Dashboard: ' + e.message);
  }
}

// ================= SNC =================
function buscarSNC(radicado) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    const data = sh.getRange(1, 1, lastRow, 8).getValues();
    const radBuscado = String(radicado).trim();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][3]).trim() === radBuscado) {
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
  } catch (e) {
    throw new Error('Error SNC: ' + e.message);
  }
}

// ================= BUSQUEDA GENERAL =================
function buscarGeneral(radicado) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    const data = sh.getRange(1, 1, lastRow, 6).getValues();
    const radBuscado = String(radicado).trim();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][3]).trim() === radBuscado) {
        let fStr = '-';
        try {
          const d = new Date(data[i][0]);
          if (!isNaN(d.getTime())) fStr = Utilities.formatDate(d, "GMT-5", "dd/MM/yyyy");
          else fStr = data[i][0].toString();
        } catch(e) {}

        return {
          funcionaria: data[i][2],
          fecha: fStr,
          observacion: data[i][5] || ''
        };
      }
    }
    return null;
  } catch (e) {
    throw new Error('Error Búsqueda: ' + e.message);
  }
}

// ================= SOLUCIONAR SNC =================
function marcarSolucionado(rowId) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('GESTIONES');
    sh.getRange(rowId, 8).setValue(new Date());
    sh.getRange(rowId, 5).setValue('No');
    sh.getRange(rowId, 7).setValue('');
    return true;
  } catch (e) {
    throw new Error('Error Solucionar: ' + e.message);
  }
}

// ================= STUBS =================
function obtenerNotificaciones(u) { return []; }
function marcarRecibido(id) { return true; }
function obtenerChat(u) { return []; }
function enviarMensajeChat(d) { return true; }
