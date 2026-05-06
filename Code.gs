/**
 * -------------------------------------------------------------------------
 * CONFIGURACIÓN Y ENTRADA PRINCIPAL
 * -------------------------------------------------------------------------
 */
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
        role: (user[2] || "").toString().toLowerCase() === "admin" ? "admin" : "agent"
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
 * -------------------------------------------------------------------------
 * PORTAL DE AGENTE: RECLAMAR Y GUARDAR
 * -------------------------------------------------------------------------
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

    // Leemos hasta la columna P (16) para verificar fecha de comunicación
    const data = sheet.getRange(1, 1, lastRow, 16).getValues();

    // 1. Prioridad: Casos ya asignados al asesor pero sin gestionar
    let candidates = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const asesor = String(row[0]).trim();
      const estado = String(row[9]).trim();
      const fechaCom = String(row[15]).trim();

      if (asesor === agentName && estado === "" && fechaCom === "") {
        candidates.push({ rowId: i + 1, row: row });
      }
    }

    if (candidates.length > 0) {
      // Ordenar por fecha RECIBIDO PEOPLE (Col B / index 1)
      candidates.sort((a, b) => {
        let dateA = a.row[1] instanceof Date ? a.row[1] : new Date(a.row[1]);
        let dateB = b.row[1] instanceof Date ? b.row[1] : new Date(b.row[1]);
        return dateA - dateB;
      });
      return formatCaseResponse(sheet, candidates[0].rowId);
    }

    // 2. Casos nuevos (sin asesor, sin estado, sin fecha comunicación)
    let newCases = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const asesor = String(row[0]).trim();
      const estado = String(row[9]).trim();
      const radicado = String(row[2]).trim();
      const fechaCom = String(row[15]).trim();

      if (asesor === "" && estado === "" && radicado !== "" && fechaCom === "") {
        newCases.push({ rowId: i + 1, row: row });
      }
    }

    if (newCases.length > 0) {
      // Ordenar por fecha RECIBIDO PEOPLE (Col B / index 1) ASCENDENTE
      newCases.sort((a, b) => {
        let dateA = a.row[1] instanceof Date ? a.row[1] : new Date(a.row[1]);
        let dateB = b.row[1] instanceof Date ? b.row[1] : new Date(b.row[1]);
        return dateA - dateB;
      });

      const selected = newCases[0];
      // Apartar el caso
      sheet.getRange(selected.rowId, 1).setValue(agentName);
      return formatCaseResponse(sheet, selected.rowId);
    }

    return { success: false, message: 'No hay radicados pendientes de gestión en este momento.' };
  } catch (e) {
    console.error("Error en claimNextCase: " + e.message);
    return { success: false, message: 'Error técnico: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Utilidad para formatear la respuesta del caso seleccionado
 */
function formatCaseResponse(sheet, rowId) {
  const fullRow = sheet.getRange(rowId, 1, 1, 10).getValues()[0]; // Necesitamos hasta Col J
  const extraData = sheet.getRange(rowId, 4, 1, 6).getValues()[0]; // D a I

  let fechaDisplay = "N/A";
  if (extraData[0]) { // Col D
    fechaDisplay = (extraData[0] instanceof Date)
      ? Utilities.formatDate(extraData[0], "GMT-5", "dd/MM/yyyy")
      : String(extraData[0]);
  }

  return {
    success: true,
    data: {
      rowId: rowId,
      radicado: String(fullRow[2]),
      nombre: String(extraData[2] || "N/A"), // Col F
      telefono: String(extraData[3] || "N/A"), // Col G
      empresa: String(extraData[5] || "N/A"), // Col I
      fecha: fechaDisplay
    }
  };
}

function saveManagement(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');

    // Col A (1): Asesor
    sheet.getRange(data.rowId, 1).setValue(data.asesor || "Sistema");

    // Mapeo exacto de columnas: J=10, K=11, L=12, M=13, N=14
    sheet.getRange(data.rowId, 10).setValue(data.estado);
    sheet.getRange(data.rowId, 11).setValue(data.canal);
    sheet.getRange(data.rowId, 12).setValue(data.efectividad);
    sheet.getRange(data.rowId, 13).setValue(data.otraSolucion);
    sheet.getRange(data.rowId, 14).setValue(data.seEncontro);

    if (data.emailContacto) {
      sheet.getRange(data.rowId, 8).setValue(data.emailContacto); // Col H
    }

    // P (16): FECHA COMUNICACIÓN, Q (17): NOTAS
    sheet.getRange(data.rowId, 16).setValue(new Date());
    sheet.getRange(data.rowId, 17).setValue(data.notas || "");

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

function generarRespuestaIA(prompt, tipo, metadata) {
  try {
    const API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

    if (!API_KEY) {
      return {
        success: false,
        message: '⚠️ API KEY no configurada en las Propiedades del Script.'
      };
    }

    let systemPrompt = "Eres un redactor experto de People BPO. Tu tarea es generar respuestas profesionales, claras y empáticas.";

    if (tipo === 'PQRSF-RES') {
      systemPrompt += `
      Contexto: Respuesta de solución.
      Cliente: ${metadata.nombre}
      Radicado: ${metadata.radicado}
      Asesor: ${metadata.asesorActual}

      Estructura Obligatoria:
      1. Saludo: "Cordial saludo Sr(a). ${metadata.nombre}, referente a su radicado ${metadata.radicado}..."
      2. Cuerpo: Explicar detalladamente la solución basada en las notas del agente.
      3. Cierre: "Agradecemos su comunicación. Quedamos atentos a cualquier solicitud adicional. Atentamente, ${metadata.asesorActual}, People BPO."

      Instrucción: Genera el texto final combinando esta estructura con las notas del agente de forma fluida y profesional.`;
    } else {
      systemPrompt += `
      Contexto: Notificación de No Contacto.
      Cliente: ${metadata.nombre}
      Radicado: ${metadata.radicado}
      Asesor: ${metadata.asesorActual}

      Estructura Obligatoria:
      1. Saludo: "Estimado(a) ${metadata.nombre},"
      2. Cuerpo: "Le informamos que intentamos contactarlo telefónicamente en relación a su radicado ${metadata.radicado}, sin embargo, no fue posible establecer comunicación."
      3. Acción: Mencionar que se intentará nuevamente o invitar a contactar por otros canales basándose en las notas.
      4. Cierre: "Cordialmente, ${metadata.asesorActual}, People BPO."

      Instrucción: Genera un mensaje breve y ejecutivo siguiendo esta estructura.`;
    }

    const payload = {
      model: "gpt-4o-mini", // O "gpt-3.5-turbo" si prefieres
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Notas del agente: " + prompt }
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
    const responseBody = response.getContentText();
    const json = JSON.parse(responseBody);

    if (responseCode !== 200) {
      return {
        success: false,
        message: 'Error de API (' + responseCode + '): ' + (json.error ? json.error.message : 'Error desconocido')
      };
    }

    if (json.choices && json.choices.length > 0) {
      return {
        success: true,
        text: json.choices[0].message.content.trim()
      };
    }

    return { success: false, message: 'La IA no devolvió ninguna respuesta.' };
  } catch (e) {
    return { success: false, message: 'Error de conexión con OpenAI: ' + e.message };
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
      to: toEmail,
      subject: `Resumen PQRSF – ${reportDate}`,
      htmlBody: htmlBody
    });

    return "OK";
  } catch (e) {
    throw new Error('Error al enviar el reporte: ' + e.message);
  }
}
