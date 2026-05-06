/**
 * -------------------------------------------------------------------------
 * CONFIGURACIÓN Y ENTRADA PRINCIPAL (PREMIUM)
 * -------------------------------------------------------------------------
 */
const CONFIG = {
  SPREADSHEET_ID: '1zfjGtGb4H0ONasrAHNa1XdpnBNXfYVm-cPmUphjdOE4', // Usando el ID del proyecto funcional
  SHEETS: {
    USUARIOS_ADMIN: 'Agentes', // En el funcional la hoja se llama Agentes
    PQRSF: 'PQRSF',
    AGENTES: 'Agentes',
    TURNOS: 'TURNOS'
  },
  TIMEZONE: "America/Bogota"
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('People BPO | Intelligence Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSs() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * -------------------------------------------------------------------------
 * GESTIÓN DE USUARIOS Y AUTENTICACIÓN
 * -------------------------------------------------------------------------
 */

function obtenerUsuarios() {
  try {
    const ss = getSs();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.AGENTES);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    return data.slice(1).map(r => ({
      nombre: String(r[0] || "").trim()
    })).filter(u => u.nombre !== "");
  } catch (e) {
    return [];
  }
}

function validarLogin(nombre, password) {
  try {
    const ss = getSs();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.AGENTES);
    const data = sheet.getDataRange().getValues().slice(1);
    const user = data.find(r =>
      String(r[0]).trim() === String(nombre).trim() &&
      String(r[1]).trim() === String(password).trim()
    );

    if (user) {
      return {
        success: true,
        nombre: String(user[0]),
        role: (user[2] || "").toString().toLowerCase() === "admin" ? "admin" : "agent"
      };
    }
    return { success: false, message: 'Credenciales incorrectas.' };
  } catch (e) {
    return { success: false, message: 'Error de servidor: ' + e.message };
  }
}

// Alias para compatibilidad con Dashboard Premium
function login(u, p) { return validarLogin(u, p); }

/**
 * -------------------------------------------------------------------------
 * LÓGICA DE DATOS Y DASHBOARD (PQRSF FIFO & TRACKING)
 * -------------------------------------------------------------------------
 */

function getPQRSFData() {
  try {
    const ss = getSs();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const timeZone = Session.getScriptTimeZone();

    return data.slice(1).map((row, i) => {
      const formatDate = v => (v instanceof Date)
        ? Utilities.formatDate(v, timeZone, "yyyy-MM-dd")
        : String(v || "");

      const estado = String(row[9] || "").trim();
      const canal = String(row[10] || "").trim();
      const efectividad = String(row[11] || "").trim();
      const fechaComRaw = row[15];

      return {
        id: i + 2,
        asesor: String(row[0] || ""),
        recibidoPeople: formatDate(row[1]),
        recibidoPeopleRaw: row[1],
        radicado: String(row[2] || ""),
        fechaCofrem: formatDate(row[3]),
        nombre: String(row[5] || ""),
        telefono: String(row[6] || ""),
        correo: String(row[7] || ""),
        empresa: String(row[8] || ""),
        estado: estado,
        canal: canal,
        efectividad: efectividad,
        requiereOtraSolucion: String(row[12] || ""),
        seEncontroPqrs: String(row[13] || ""),
        fechaComunicacion: formatDate(fechaComRaw),
        fechaComunicacionRaw: fechaComRaw,
        notas: String(row[16] || ""),
        isManaged: !!(estado !== "" && canal !== "" && efectividad !== "") || !!fechaComRaw
      };
    }).filter(r => r.radicado !== "");
  } catch (e) {
    throw new Error('Error al cargar datos: ' + e.message);
  }
}

/**
 * PORTAL DE AGENTE: RECLAMAR Y GUARDAR (CON FIFO LOGIC)
 */

function claimNextCase(agentName) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) {
      return { success: false, message: 'El sistema está congestionado. Reintente en unos segundos.' };
    }

    const ss = getSs();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'No hay registros en la base de datos.' };

    const data = sheet.getRange(1, 1, lastRow, 16).getValues();

    // 1. Prioridad: Casos ya asignados al asesor pero sin gestionar
    let candidates = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[0]).trim() === agentName && String(row[9]).trim() === "" && String(row[15]).trim() === "") {
        candidates.push({ rowId: i + 1, row: row });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => (a.row[1] instanceof Date ? a.row[1] : new Date(a.row[1])) - (b.row[1] instanceof Date ? b.row[1] : new Date(b.row[1])));
      return formatCaseResponse(sheet, candidates[0].rowId);
    }

    // 2. Casos nuevos (FIFO)
    let newCases = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[0]).trim() === "" && String(row[9]).trim() === "" && String(row[2]).trim() !== "" && String(row[15]).trim() === "") {
        newCases.push({ rowId: i + 1, row: row });
      }
    }

    if (newCases.length > 0) {
      newCases.sort((a, b) => (a.row[1] instanceof Date ? a.row[1] : new Date(a.row[1])) - (b.row[1] instanceof Date ? b.row[1] : new Date(b.row[1])));
      const selected = newCases[0];
      sheet.getRange(selected.rowId, 1).setValue(agentName);
      return formatCaseResponse(sheet, selected.rowId);
    }

    return { success: false, message: 'No hay radicados pendientes de gestión.' };
  } finally { lock.releaseLock(); }
}

function formatCaseResponse(sheet, rowId) {
  const fullRow = sheet.getRange(rowId, 1, 1, 10).getValues()[0];
  const extraData = sheet.getRange(rowId, 4, 1, 6).getValues()[0];

  let fechaDisplay = "N/A";
  if (extraData[0]) {
    fechaDisplay = (extraData[0] instanceof Date) ? Utilities.formatDate(extraData[0], "GMT-5", "dd/MM/yyyy") : String(extraData[0]);
  }

  return {
    success: true,
    data: {
      rowId: rowId,
      radicado: String(fullRow[2]),
      nombre: String(extraData[2] || "N/A"),
      telefono: String(extraData[3] || "N/A"),
      empresa: String(extraData[5] || "N/A"),
      fecha: fechaDisplay
    }
  };
}

function saveManagement(data) {
  try {
    const ss = getSs();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF);
    sheet.getRange(data.rowId, 1).setValue(data.asesor || "Sistema");
    sheet.getRange(data.rowId, 10).setValue(data.estado);
    sheet.getRange(data.rowId, 11).setValue(data.canal);
    sheet.getRange(data.rowId, 12).setValue(data.efectividad);
    sheet.getRange(data.rowId, 13).setValue(data.otraSolucion);
    sheet.getRange(data.rowId, 14).setValue(data.seEncontro);
    if (data.emailContacto) sheet.getRange(data.rowId, 8).setValue(data.emailContacto);

    sheet.getRange(data.rowId, 16).setValue(new Date());
    sheet.getRange(data.rowId, 17).setValue(data.notas || "");

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * -------------------------------------------------------------------------
 * INTELIGENCIA ARTIFICIAL & OTROS
 * -------------------------------------------------------------------------
 */

function generarRespuestaIA(prompt, tipo, metadata) {
  try {
    const API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!API_KEY) return { success: false, message: 'API KEY no configurada.' };

    let systemPrompt = "Eres un redactor experto de People BPO. Genera una respuesta profesional.";
    const payload = {
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Notas: " + prompt }],
      temperature: 0.7
    };

    const options = {
      method: "post", contentType: "application/json",
      headers: { "Authorization": "Bearer " + API_KEY },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    const json = JSON.parse(response.getContentText());
    if (json.choices) return { success: true, text: json.choices[0].message.content.trim() };
    return { success: false, message: 'IA error' };
  } catch (e) { return { success: false, message: e.message }; }
}

function searchGlobal(val) {
    // Implementar búsqueda similar al funcional
    const data = getPQRSFData();
    const found = data.find(d => d.radicado === val);
    if (found) {
        return {
            type: 'PQRSF',
            data: {
                'Radicado': found.radicado,
                'Cliente': found.nombre,
                'Asesor': found.asesor,
                'Estado': found.estado,
                'Fecha': found.recibidoPeople
            }
        };
    }
    return null;
}

function getTurnosStatus() {
    // Mock o implementar si existe la hoja TURNOS
    return [];
}
