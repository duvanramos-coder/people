const SPREADSHEET_ID = '1zfjGtGb4H0ONasrAHNa1XdpnBNXfYVm-cPmUphjdOE4';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dashboard PQRSF | People BPO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * -------------------------------------------------------------------------
 * GESTIÓN DE USUARIOS Y AUTENTICACIÓN
 * -------------------------------------------------------------------------
 */

function registrarSesion(nombre) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Sesiones');
    if (!sheet) {
      sheet = ss.insertSheet('Sesiones');
      sheet.appendRow(['Agente', 'Ultima Actividad']);
    }

    const data = sheet.getDataRange().getValues();
    const now = new Date();
    let found = false;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nombre) {
        sheet.getRange(i + 1, 2).setValue(now);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([nombre, now]);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function eliminarSesion(nombre) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Sesiones');
    if (!sheet) return { success: true };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nombre) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function obtenerAgentesConectados() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetSesiones = ss.getSheetByName('Sesiones');
    const sheetPQRSF = ss.getSheetByName('PQRSF');
    if (!sheetSesiones) return [];

    const dataSesiones = sheetSesiones.getDataRange().getValues();
    const dataPQRSF = sheetPQRSF ? sheetPQRSF.getDataRange().getValues() : [];
    const now = new Date().getTime();
    const threshold = 10 * 60 * 1000;

    const conectados = [];
    for (let i = 1; i < dataSesiones.length; i++) {
      const nombre = dataSesiones[i][0];
      const lastSeenDate = new Date(dataSesiones[i][1]);
      const lastSeen = lastSeenDate.getTime();
      if (now - lastSeen < threshold) {
        const diffMin = Math.floor((now - lastSeen) / 60000);
        const tiempoRelativo = diffMin === 0 ? "hace un momento" : `hace ${diffMin} min`;

        let enGestion = false;
        if (dataPQRSF.length > 1) {
          enGestion = dataPQRSF.some(r =>
            String(r[0]).trim().toLowerCase() === String(nombre).trim().toLowerCase() &&
            String(r[9]).trim() === ""
          );
        }

        conectados.push({
          nombre: nombre,
          tiempo: tiempoRelativo,
          enGestion: enGestion
        });
      }
    }

    conectados.sort((a, b) => {
      const aMin = a.tiempo === "hace un momento" ? 0 : parseInt(a.tiempo.match(/\d+/) || 0);
      const bMin = b.tiempo === "hace un momento" ? 0 : parseInt(b.tiempo.match(/\d+/) || 0);
      return aMin - bMin;
    });

    return conectados;
  } catch (e) {
    console.error("Error en obtenerAgentesConectados: " + e.message);
    return [];
  }
}

function obtenerActividadReciente() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    if (!sheet) return { success: false };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, eventos: [] };

    const now = new Date().getTime();
    const eventos = [];
    const timeZone = Session.getScriptTimeZone();

    for (let i = data.length - 1; i >= 1 && eventos.length < 5; i--) {
      const row = data[i];
      const asesor   = String(row[0]  || "").trim();
      const radicado = String(row[2]  || "").trim();
      const estado   = String(row[9]  || "").trim();

      let fechaCom = row[15];
      if (!(fechaCom instanceof Date)) {
        fechaCom = new Date(fechaCom);
      }

      if (estado !== "" && !isNaN(fechaCom.getTime())) {
        const diff = now - fechaCom.getTime();
        if (diff > 0 && diff < 45000) {
          eventos.push({
            tipo: 'GESTION',
            mensaje: `${asesor} ha gestionado el radicado ${radicado}`,
            id: radicado + '_' + fechaCom.getTime()
          });
        }
      }
    }

    return {
      success: true,
      eventos: eventos,
      totalRegistros: data.length
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function obtenerUsuarios() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Agentes');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    return data.slice(1).map(r => ({
      nombre: String(r[0] || "").trim()
    })).filter(u => u.nombre !== "");
  } catch (e) {
    console.error("Error en obtenerUsuarios: " + e.message);
    return [];
  }
}

function validarLogin(nombre, password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Agentes');
    if (!sheet) return { success: false, message: 'Hoja "Agentes" no encontrada.' };

    const data = sheet.getDataRange().getValues().slice(1);
    const user = data.find(r =>
      String(r[0]).trim() === String(nombre).trim() &&
      String(r[1]).trim() === String(password).trim()
    );

    if (user) {
      return {
        success: true,
        nombre: String(user[0]),
        role: (user[2] || "").toString().trim().toLowerCase() === "admin" ? "admin" : "agent"
      };
    }
    return { success: false, message: 'Credenciales incorrectas.' };
  } catch (e) {
    return { success: false, message: 'Error de servidor: ' + e.message };
  }
}

/**
 * -------------------------------------------------------------------------
 * LÓGICA DE DATOS Y DASHBOARD
 * -------------------------------------------------------------------------
 */

function getPQRSFData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    if (!sheet) throw new Error('Hoja "PQRSF" no encontrada.');

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const timeZone = Session.getScriptTimeZone();

    return data.slice(1).map((row, i) => {
      const formatDate = v => (v instanceof Date)
        ? Utilities.formatDate(v, timeZone, "yyyy-MM-dd")
        : String(v || "");

      const estado      = String(row[9]  || "").trim();
      const canal       = String(row[10] || "").trim();
      const efectividad = String(row[11] || "").trim();

      return {
        id:                    i + 2,
        asesor:                String(row[0]  || ""),
        recibidoPeople:        formatDate(row[1]),
        radicado:              String(row[2]  || ""),
        fechaCofrem:           formatDate(row[3]),
        nombre:                String(row[5]  || ""),
        telefono:              String(row[6]  || ""),
        correo:                String(row[7]  || ""),
        empresa:               String(row[8]  || ""),
        estado:                estado,
        canal:                 canal,
        efectividad:           efectividad,
        requiereOtraSolucion:  String(row[12] || ""),
        seEncontroPqrs:        String(row[13] || ""),
        observacionManual:     String(row[14] || ""),
        fechaComunicacion:     String(row[15] || ""),
        notas:                 String(row[16] || ""),
        isManaged: !!(estado !== "" && canal !== "" && efectividad !== "")
      };
    }).filter(r => r.radicado !== "");
  } catch (e) {
    throw new Error('Error al cargar datos: ' + e.message);
  }
}

/**
 * ✅ NUEVA — Estadísticas ligeras para carga inicial del agente
 */
function getQuickStats(nombreAsesor) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return { pendingTotal: 0, myAssigned: 0, managedToday: 0 };

    const colA = sheet.getRange(2, 1,  lastRow - 1, 1).getValues();
    const colB = sheet.getRange(2, 2,  lastRow - 1, 1).getValues();
    const colC = sheet.getRange(2, 3,  lastRow - 1, 1).getValues();
    const colJ = sheet.getRange(2, 10, lastRow - 1, 1).getValues();

    const todayStr = Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd");

    const normalizeCell = v =>
      String(v === null || v === undefined ? "" : v)
        .replace(/[\u00A0\u200B\t\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const nombreNorm = normalizeCell(nombreAsesor).toLowerCase();

    let pendingTotal = 0;
    let myAssigned   = 0;
    let managedToday = 0;

    for (let i = 0; i < colA.length; i++) {
      const radicado = normalizeCell(colC[i][0]);
      if (!radicado) continue;

      const asesor    = normalizeCell(colA[i][0]);
      const estado    = normalizeCell(colJ[i][0]);
      const fecha     = colB[i][0];
      const isManaged = estado !== "";

      if (!isManaged) pendingTotal++;

      if (!isManaged && asesor.toLowerCase() === nombreNorm) myAssigned++;

      if (isManaged && asesor.toLowerCase() === nombreNorm && fecha) {
        const fechaStr = (fecha instanceof Date)
          ? Utilities.formatDate(fecha, "America/Bogota", "yyyy-MM-dd")
          : String(fecha).substring(0, 10);
        if (fechaStr === todayStr) managedToday++;
      }
    }

    return { pendingTotal, myAssigned, managedToday };

  } catch (e) {
    console.error("Error en getQuickStats: " + e.message);
    return { pendingTotal: 0, myAssigned: 0, managedToday: 0 };
  }
}

function buscarRadicadoAdmin(numero) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).trim() === String(numero).trim()) {
        const row = data[i];
        const fechaVal = row[3];
        const fechaDisplay = (fechaVal instanceof Date)
          ? Utilities.formatDate(fechaVal, "GMT-5", "dd/MM/yyyy")
          : String(fechaVal || "N/A");

        return {
          success: true,
          data: {
            rowId:              i + 1,
            radicado:           String(row[2]),
            nombre:             String(row[5]  || "N/A"),
            telefono:           String(row[6]  || "N/A"),
            empresa:            String(row[8]  || "N/A"),
            fecha:              fechaDisplay,
            asesor:             String(row[0]),
            estado:             String(row[9]),
            canal:              String(row[10]),
            efectividad:        String(row[11]),
            otraSolucion:       String(row[12]),
            seEncontro:         String(row[13]),
            observacionManual:  String(row[14] || "")
          }
        };
      }
    }
    return { success: false, message: 'Radicado no encontrado' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function actualizarRadicadoAdmin(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');

    const rowId = data.rowId;
    sheet.getRange(rowId, 10).setValue(data.estado);
    sheet.getRange(rowId, 11).setValue(data.canal);
    sheet.getRange(rowId, 12).setValue(data.efectividad);
    sheet.getRange(rowId, 13).setValue(data.otraSolucion);
    sheet.getRange(rowId, 14).setValue(data.seEncontro);
    sheet.getRange(rowId, 15).setValue(data.observacionManual);
    sheet.getRange(rowId, 16).setValue(new Date());

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function obtenerAsignadosAsesor(nombreAsesor) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const data = sheet.getDataRange().getValues();

    const normalize = str =>
      String(str === null || str === undefined ? "" : str)
        .replace(/[\u00A0\u200B\t\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const nombreNorm = normalize(nombreAsesor);

    const asignados = data.slice(1)
      .filter(r => {
        const asesorCell  = normalize(r[0]);
        const estadoCell  = normalize(r[9]);
        const radicadoVal = String(r[2] || "").trim();
        return asesorCell === nombreNorm && estadoCell === "" && radicadoVal !== "";
      })
      .map(r => ({
        radicado: String(r[2]),
        nombre:   String(r[5] || ""),
        empresa:  String(r[8] || ""),
        fecha:    r[1] instanceof Date
                    ? Utilities.formatDate(r[1], "GMT-5", "dd/MM/yyyy")
                    : String(r[1] || ""),
        fechaRaw: r[1] instanceof Date
                    ? r[1].getTime()
                    : (new Date(r[1]).getTime() || 0)
      }));

    asignados.sort((a, b) => a.fechaRaw - b.fechaRaw);

    return asignados.map(r => ({
      radicado: r.radicado,
      nombre:   r.nombre,
      empresa:  r.empresa,
      fecha:    r.fecha
    }));
  } catch (e) {
    console.error("Error en obtenerAsignadosAsesor: " + e.message);
    return [];
  }
}

function obtenerHistorialAsesor(nombreAsesor) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const data = sheet.getDataRange().getValues();

    const historial = data.slice(1)
      .filter(r =>
        String(r[0]).trim().toLowerCase() === nombreAsesor.trim().toLowerCase() &&
        String(r[9]).trim() !== ""
      )
      .reverse()
      .slice(0, 20)
      .map(r => ({
        radicado:    String(r[2]),
        nombre:      String(r[5]),
        fecha:       r[1] instanceof Date ? Utilities.formatDate(r[1], "GMT-5", "dd/MM/yyyy") : String(r[1]),
        estado:      String(r[9]),
        canal:       String(r[10]),
        efectividad: String(r[11])
      }));

    return historial;
  } catch (e) {
    console.error("Error en obtenerHistorialAsesor: " + e.message);
    return [];
  }
}

/**
 * -------------------------------------------------------------------------
 * PORTAL DE AGENTE: RECLAMAR Y GUARDAR
 * -------------------------------------------------------------------------
 */

function asignarRadicado(radicado, agente) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).trim() === String(radicado).trim()) {
        if (String(data[i][9]).trim() === "") {
          sheet.getRange(i + 1, 1).setValue(agente);
          return { success: true, message: `Radicado ${radicado} asignado a ${agente}` };
        } else {
          return { success: false, message: 'El radicado ya ha sido gestionado.' };
        }
      }
    }
    return { success: false, message: 'Radicado no encontrado.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * ✅ OPTIMIZADA — claimNextCase con lectura selectiva y corte anticipado
 */
function claimNextCase(agentName) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) {
      return { success: false, message: 'El sistema está congestionado. Reintente en unos segundos.' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return { success: false, message: 'No hay registros en la base de datos.' };

    // ✅ Solo leer Col A (Asesor), Col C (Radicado) y Col J (Estado)
    const colA = sheet.getRange(2, 1,  lastRow - 1, 1).getValues();
    const colC = sheet.getRange(2, 3,  lastRow - 1, 1).getValues();
    const colJ = sheet.getRange(2, 10, lastRow - 1, 1).getValues();

    const normalizeCell = v =>
      String(v === null || v === undefined ? "" : v)
        .replace(/[\u00A0\u200B\t\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const agentNorm = agentName.trim().toLowerCase();
    let targetRowIndex = -1;

    // ── PASO A: Busca fila ya asignada al agente sin gestionar (FIFO) ──
    for (let i = 0; i < colA.length; i++) {
      const radicado = normalizeCell(colC[i][0]);
      if (!radicado) continue;
      const asesor = normalizeCell(colA[i][0]);
      const estado = normalizeCell(colJ[i][0]);
      if (asesor.toLowerCase() === agentNorm && estado === "") {
        targetRowIndex = i;
        break; // ✅ Corte anticipado — respeta FIFO
      }
    }

    // ── PASO B: Si no hay asignado, busca el primer caso libre (FIFO) ──
    if (targetRowIndex === -1) {
      for (let i = 0; i < colA.length; i++) {
        const radicado = normalizeCell(colC[i][0]);
        if (!radicado) continue;
        const asesor = normalizeCell(colA[i][0]);
        const estado = normalizeCell(colJ[i][0]);
        if (asesor === "" && estado === "") {
          targetRowIndex = i;
          break; // ✅ Corte anticipado — respeta FIFO
        }
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: 'No hay radicados pendientes de gestión en este momento.' };
    }

    const realRow = targetRowIndex + 2; // +1 header, +1 base-0

    // ✅ Solo ahora traemos los datos completos de ESA fila específica
    sheet.getRange(realRow, 1).setValue(agentName);
    const fullRow = sheet.getRange(realRow, 1, 1, 14).getValues()[0];

    let fechaDisplay = "N/A";
    if (fullRow[3]) {
      fechaDisplay = (fullRow[3] instanceof Date)
        ? Utilities.formatDate(fullRow[3], "GMT-5", "dd/MM/yyyy")
        : String(fullRow[3]);
    }

    return {
      success: true,
      data: {
        rowId:    realRow,
        radicado: String(fullRow[2]),
        nombre:   String(fullRow[5]  || "N/A"),
        telefono: String(fullRow[6]  || "N/A"),
        empresa:  String(fullRow[8]  || "N/A"),
        fecha:    fechaDisplay
      }
    };

  } catch (e) {
    console.error("Error en claimNextCase: " + e.message);
    return { success: false, message: 'Error técnico: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function saveManagement(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');

    sheet.getRange(data.rowId, 1).setValue(data.asesor || "Sistema");
    sheet.getRange(data.rowId, 10).setValue(data.estado);
    sheet.getRange(data.rowId, 11).setValue(data.canal);
    sheet.getRange(data.rowId, 12).setValue(data.efectividad);
    sheet.getRange(data.rowId, 13).setValue(data.otraSolucion);
    sheet.getRange(data.rowId, 14).setValue(data.seEncontro);
    sheet.getRange(data.rowId, 15).setValue(data.observacionManual);
    sheet.getRange(data.rowId, 16).setValue(new Date());
    sheet.getRange(data.rowId, 17).setValue(data.notas);

    if (data.emailContacto) {
      sheet.getRange(data.rowId, 8).setValue(data.emailContacto);
    }

    return { success: true };
  } catch (e) {
    return { success: false, message: 'Error al guardar gestión: ' + e.message };
  }
}

/**
 * -------------------------------------------------------------------------
 * INTELIGENCIA ARTIFICIAL (OPENAI)
 * -------------------------------------------------------------------------
 */

function generarRespuestaIA(prompt, metadata) {
  try {
    const API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

    if (!API_KEY) {
      return { success: false, message: 'API KEY no configurada en Propiedades del Script.' };
    }

    const systemPrompt = `Eres un asistente de redacción para PQRSF de COFREM.
Tu tarea es mejorar y formalizar el texto proporcionado por el agente.
REGLAS:
- NO incluyas saludos (ni "Cordial saludo", ni nada similar)
- NO incluyas firma ni despedida
- NO incluyas teléfonos ni menciones el radicado
- Mantén un tono formal, claro y empático
Devuelve únicamente el cuerpo del mensaje mejorado.`;

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt }
      ],
      temperature: 0.7
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    const responseCode = response.getResponseCode();
    const body = response.getContentText();

    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      return { success: true, text: prompt, source: "error_parse" };
    }

    if (responseCode !== 200) {
      console.error("OpenAI Error: " + body);
      return { success: true, text: prompt, source: "fallback_api_error" };
    }

    if (json.choices && json.choices.length > 0 && json.choices[0].message && json.choices[0].message.content) {
      const resText = json.choices[0].message.content.trim();
      return { success: true, text: resText || prompt };
    }

    return { success: true, text: prompt, source: "fallback_no_choices" };

  } catch (e) {
    console.error("Error en generarRespuestaIA: " + e.message);
    return { success: false, message: e.message };
  }
}

function liberarRadicado(rowId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    sheet.getRange(rowId, 1).clearContent();
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function construirRespuestaFinal(tipo, data) {
  const { radicado, agente, cuerpoIA, correo } = data;

  if (tipo === "PQRSF-RES") {
    return {
      header: `RESPUESTA A SU PQRSF - RADICADO N.° ${radicado}`,
      body: `Cordial saludo,
Hemos intentado comunicarnos con usted vía telefónica; sin embargo, no fue posible establecer la comunicación.

En atención a su solicitud radicada ante la Caja de Compensación Familiar COFREM, nos permitimos informarle que, una vez realizado el estudio y validación correspondiente de su caso, se obtuvo el siguiente resultado:

${cuerpoIA}

Agradecemos su comunicación y reiteramos nuestro compromiso con la correcta prestación del servicio.

Cordialmente,

${agente}
Asesora de Servicio al Cliente
Teléfono: (608) 681 83 20
Línea gratuita nacional: 01 8000 111 879`
    };
  }

  if (tipo === "PQRSF-NC") {
    return {
      header: `RESPUESTA A SU PQRSF - RADICADO N.° ${radicado}`,
      body: `Cordial saludo,

Hemos intentado comunicarnos con usted vía telefónica; sin embargo, no fue posible establecer la comunicación.

En atención a su solicitud PQRSF radicada ante la Caja de Compensación Familiar COFREM, nos permitimos informarle que, una vez realizado el estudio y validación correspondiente de su caso, la misma ya fue debidamente respondida.

La información asociada a su solicitud fue enviada al siguiente correo electrónico:

📧 ${correo}

Agradecemos su comunicación y reiteramos nuestro compromiso con la correcta prestación del servicio. En caso de requerir información adicional, puede comunicarse a través de nuestros canales de atención.

Cordialmente,

${agente}
Asesora de Servicio al Cliente
Teléfono: (608) 681 83 20
Línea gratuita nacional: 01 8000 111 879`
    };
  }
}

/**
 * -------------------------------------------------------------------------
 * UTILIDADES ADICIONALES
 * -------------------------------------------------------------------------
 */

function sendEmailReport(toEmail, reportData, reportDate) {
  try {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #3b3561;">Reporte de Gestión PQRSF</h2>
        <p><strong>Fecha:</strong> ${reportDate}</p>
        <p><strong>Total Casos:</strong> ${reportData.total}</p>
        <p><strong>Gestionados:</strong> ${reportData.managed} (${reportData.managedPerc}%)</p>
        <p><strong>Efectividad:</strong> ${reportData.effectivenessPerc}%</p>
        <hr>
        <p style="font-size: 11px; color: #888;">Este es un envío automático desde el Dashboard Pro.</p>
      </div>
    `;

    MailApp.sendEmail({
      to:       toEmail,
      subject:  `Resumen PQRSF – ${reportDate}`,
      htmlBody: htmlBody
    });

    return "OK";
  } catch (e) {
    throw new Error('Error al enviar el reporte: ' + e.message);
  }
}