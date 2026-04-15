/**
 * CONFIGURACIÓN GLOBAL
 * No modificar los nombres de las hojas ni el ID a menos que sea necesario.
 */
const CONFIG = {
  SPREADSHEET_ID: "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w",
  SHEETS: {
    PQRSF: "PQRSF Creados",
    AGENTES: "USUARIOS",
    CHAT: "CHAT",
    NOTIFICACIONES: "Notificaciones"
  },
  TIMEZONE: "GMT-5"
};

/**
 * Función principal para servir la aplicación.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('REGISTRA TU PQRSF REALIZADO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * REGLA DE ORO: Conserva la lógica de registro existente.
 */
function guardarPQRSF(datos) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const hoja = ss.getSheetByName(CONFIG.SHEETS.PQRSF);

    const radicadoNuevo = datos.radicado;
    const ultimaFila = hoja.getLastRow();

    if (ultimaFila > 1) {
      const radicados = hoja.getRange(2, 3, ultimaFila - 1, 1).getValues();

      for (let i = 0; i < radicados.length; i++) {
        if (radicados[i][0] == radicadoNuevo) {
          const agenteExistente = hoja.getRange(i + 2, 2).getValue();
          return {
            estado: "duplicado",
            agente: agenteExistente
          };
        }
      }
    }

    hoja.appendRow([
      new Date(),
      datos.agente,
      datos.radicado,
      datos.caso,
      datos.clasificacion,
      datos.dirige
    ]);

    return { estado: "ok" };
  } catch(e) {
    console.log("Error en guardarPQRSF: " + e.message);
    return { estado: "error", error: e.message };
  }
}

function buscarPQRSF(radicado) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const searchVal = String(radicado).trim().toLowerCase();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][2]).trim().toLowerCase() === searchVal) {
        return {
          fecha: formatDate(data[i][0]),
          agente: data[i][1],
          radicado: data[i][2],
          clasificacion: data[i][4],
          dirige: data[i][5]
        };
      }
    }
    return null;
  } catch(e) {
    console.log("Error en buscarPQRSF: " + e.message);
    return null;
  }
}

/**
 * HELPERS Y FUNCIONES DE SOPORTE
 */
function formatDate(date) {
  if (!date || !(date instanceof Date)) return date;
  return Utilities.formatDate(date, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
}

function getAgentes() {
  const defaultNames = [
    "Angi Johana Banda Montes",
    "Slendy Lizzeth Pico Garcia",
    "Heillen Tatiana Rincón Lizarazo",
    "Juliana Roa Aragonez",
    "Stefania Ortega Rodríguez",
    "Hadisha Faride Bitar Lerech",
    "Bleidis Farides Cabarcas Charris",
    "Katherine Sofia Nieto Guerra"
  ];

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.AGENTES) || ss.getSheetByName("Agentes");

    if (!sheet) return defaultNames.sort();

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return defaultNames.sort();

    let data;
    // USUARIOS sheet usually has names in Column B (2), Agentes usually in Column E (5)
    if (sheet.getName() === "USUARIOS") {
      data = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    } else {
      data = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    }

    const sheetNames = data.map(row => row[0]).filter(name => name && name.trim() !== "");

    return sheetNames.length > 0 ? [...new Set(sheetNames)].sort() : defaultNames.sort();
  } catch(e) {
    console.warn("getAgentes using defaults: " + e.message);
    return defaultNames.sort();
  }
}

function getHistorial(agente) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { historial: [], hoy: 0 };

    // Obtenemos los últimos 300 registros para asegurar capturar los del día
    const startRow = Math.max(2, lastRow - 300);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 5).getValues();

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    const agentData = data.filter(row => row[1] === agente);

    const hoyCount = agentData.filter(row => {
      const d = new Date(row[0]);
      d.setHours(0,0,0,0);
      return d.getTime() === hoy.getTime();
    }).length;

    const historial = agentData
      .reverse()
      .slice(0, 10)
      .map(row => ({
        fecha: formatDate(row[0]),
        radicado: row[2]
      }));

    return {
      historial: historial,
      hoy: hoyCount
    };
  } catch(e) {
    console.log("Error en getHistorial: " + e.message);
    return { historial: [], hoy: 0 };
  }
}

function getMensajes(usuario) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CHAT);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const startRow = Math.max(2, lastRow - 50);
    const numRows = lastRow - startRow + 1;
    const data = sheet.getRange(startRow, 1, numRows, 4).getValues();

    return data
      .filter(row => row[3] === "TODOS" || row[3] === usuario || row[1] === usuario)
      .map(row => ({
        fecha: formatDate(row[0]),
        usuario: row[1],
        mensaje: row[2],
        destinatario: row[3]
      }));
  } catch(e) {
    console.log("Error en getMensajes: " + e.message);
    return [];
  }
}

function enviarMensaje(datos) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.CHAT);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.CHAT);
      sheet.appendRow(["Fecha", "Usuario", "Mensaje", "Destinatario"]);
    }
    sheet.appendRow([
      new Date(),
      datos.usuario,
      datos.mensaje,
      datos.destinatario || "TODOS"
    ]);
    return { estado: "ok" };
  } catch(e) {
    console.log("Error en enviarMensaje: " + e.message);
    return { estado: "error", error: e.message };
  }
}

function getNotificaciones(usuario) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICACIONES);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getDataRange().getValues();
    return data.slice(1)
      .map((row, index) => ({
        id: index + 2,
        funcionaria: row[0],
        fecha: formatDate(row[1]),
        radicado: row[2],
        mensaje: row[3],
        estado: row[4],
        recibido: row[5]
      }))
      .filter(n => n.funcionaria === usuario && !n.recibido);
  } catch(e) {
    console.log("Error en getNotificaciones: " + e.message);
    return [];
  }
}

function marcarNotificacionRecibida(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICACIONES);
    sheet.getRange(id, 6).setValue(new Date());
    return { estado: "ok" };
  } catch(e) {
    console.log("Error en marcarNotificacionRecibida: " + e.message);
    return { estado: "error", error: e.message };
  }
}

/**
 * MÓDULO DE SUGERENCIAS (INTELIGENCIA COLECTIVA)
 * Busca coincidencias en base externa por descripción.
 */
function buscarSimilitudPQRSF(texto) {
  try {
    const externalId = "1_itknIlAM9fEo7dZazIEW8LfHcnAFQ6YXRIR1zVs4zk";
    const ss = SpreadsheetApp.openById(externalId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    const results = [];
    const searchVal = String(texto).trim().toLowerCase();

    if (!searchVal) return [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // A=0, B=1, C=2, D=3, E=4, F=5, G=6
      const descripcion = String(row[6] || "").toLowerCase();

      if (descripcion.includes(searchVal)) {
        results.push({
          radicado: row[0],
          canal: row[5],
          radicador: row[4]
        });
        if (results.length >= 20) break;
      }
    }
    return results;
  } catch(e) {
    console.log("Error en buscarSimilitudPQRSF: " + e.message);
    return [];
  }
}

/**
 * MÓDULO DE HORARIOS (SISTEMA DE TURNOS)
 */
function obtenerHorarioHoy(usuario) {
  try {
    const ssId = "1C4f1DBu2VW9fJPISnzH0icsELR3146gIS3c-rKG5Vtg";
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName("Turnos");
    if (!sheet) {
      console.warn("No se encontró la hoja 'Turnos'");
      return null;
    }

    const data = sheet.getDataRange().getValues();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Saltamos cabecera
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNombre = String(row[0]).trim();
      const rowFecha = row[3];

      if (!rowNombre || !rowFecha) continue;

      let match = false;
      if (rowFecha instanceof Date) {
        const d = new Date(rowFecha);
        d.setHours(0,0,0,0);
        if (d.getTime() === hoy.getTime()) match = true;
      } else {
        const hoyStr = Utilities.formatDate(hoy, CONFIG.TIMEZONE, "d/M/yyyy");
        if (String(rowFecha).trim() === hoyStr) match = true;
      }

      if (rowNombre === usuario && match) {
        return {
          jornada: String(row[4] || "-"),
          almuerzo: String(row[5] || "-"),
          break1: String(row[6] || "-"),
          break2: String(row[7] || "-")
        };
      }
    }
    return null;
  } catch(e) {
    console.log("Error en obtenerHorarioHoy: " + e.message);
    return null;
  }
}

function verificarHorarios(usuario) {
  const info = obtenerHorarioHoy(usuario);
  if (!info) return;

  const ahora = new Date();
  const eventos = [
    { nombre: "almuerzo", rango: info.almuerzo, msg: "En 2 minutos inicia tu almuerzo" },
    { nombre: "break 1", rango: info.break1, msg: "En 2 minutos inicia tu break" },
    { nombre: "break 2", rango: info.break2, msg: "En 2 minutos inicia tu break" }
  ];

  eventos.forEach(ev => {
    if (!ev.rango || ev.rango === "-" || ev.rango.toUpperCase() === "DESCANSO") return;

    // Formato esperado: "12:00pm a 1:00pm"
    const partes = ev.rango.split(" a ");
    if (partes.length < 1) return;

    const horaInicioStr = partes[0].trim(); // "12:00pm"
    const inicio = parseHora(horaInicioStr);
    if (!inicio) return;

    // Diferencia en ms
    const diff = inicio.getTime() - ahora.getTime();
    const diffMin = diff / (1000 * 60);

    // Si falta exactamente entre 1.5 y 2.5 minutos (para margen de ejecución)
    if (diffMin > 1.5 && diffMin <= 2.5) {
      if (!yaNotificadoHoy(usuario, ev.msg)) {
        crearNotificacion(usuario, ev.msg);
      }
    }
  });
}

function yaNotificadoHoy(usuario, mensaje) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICACIONES);
    const data = sheet.getDataRange().getValues();
    const hoyStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy");

    for (let i = 1; i < data.length; i++) {
      const rowFechaStr = Utilities.formatDate(new Date(data[i][1]), CONFIG.TIMEZONE, "dd/MM/yyyy");
      if (data[i][0] === usuario && rowFechaStr === hoyStr && data[i][3] === mensaje) {
        return true;
      }
    }
    return false;
  } catch(e) {
    return false;
  }
}

function crearNotificacion(usuario, mensaje) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.NOTIFICACIONES);
    sheet.appendRow([
      usuario,
      new Date(),
      "HORARIO",
      mensaje,
      "PENDIENTE",
      ""
    ]);
    return { estado: "ok" };
  } catch(e) {
    return { estado: "error", error: e.message };
  }
}

/**
 * Parsea strings tipo "7:00am" o "12:00pm" a un objeto Date de hoy.
 */
function parseHora(horaStr) {
  try {
    const match = horaStr.toLowerCase().match(/(\d+):(\d+)(am|pm)/);
    if (!match) return null;

    let horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    const meridiano = match[3];

    if (meridiano === "pm" && horas < 12) horas += 12;
    if (meridiano === "am" && horas === 12) horas = 0;

    const d = new Date();
    d.setHours(horas, minutos, 0, 0);
    return d;
  } catch(e) {
    return null;
  }
}
