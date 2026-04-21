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

      return {
        id: i + 2,
        asesor: String(row[0] || ""),
        recibidoPeople: formatDate(row[1]),
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
        isManaged: !!(estado !== "" && canal !== "" && efectividad !== "")
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
    // Esperar hasta 20 segundos para obtener el bloqueo (evita colisiones)
    if (!lock.tryLock(20000)) {
      return { success: false, message: 'El sistema está congestionado. Reintente en unos segundos.' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('PQRSF');
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return { success: false, message: 'No hay registros en la base de datos.' };

    // Leemos solo las columnas necesarias para optimizar velocidad (A a J)
    const data = sheet.getRange(1, 1, lastRow, 10).getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Col A (0): Asesor, Col J (9): Estado, Col C (2): Radicado
      // Si el asesor está vacío Y el estado está vacío Y tiene radicado, es reclamable.
      if (!String(row[0]).trim() && !String(row[9]).trim() && String(row[2]).trim() !== "") {

        // Marcamos inmediatamente el asesor en la hoja para "apartar" el caso
        sheet.getRange(i + 1, 1).setValue(agentName);

        // Obtenemos los datos restantes de la fila
        const fullRow = sheet.getRange(i + 1, 1, 1, 14).getValues()[0];

        // Formatear fecha para evitar errores de serialización en el cliente
        let fechaDisplay = "N/A";
        if (fullRow[3]) {
          fechaDisplay = (fullRow[3] instanceof Date)
            ? Utilities.formatDate(fullRow[3], "GMT-5", "dd/MM/yyyy")
            : String(fullRow[3]);
        }

        return {
          success: true,
          data: {
            rowId: i + 1,
            radicado: String(fullRow[2]),
            nombre: String(fullRow[5] || "N/A"),
            telefono: String(fullRow[6] || "N/A"),
            empresa: String(fullRow[8] || "N/A"),
            fecha: fechaDisplay
          }
        };
      }
    }
    return { success: false, message: 'No hay radicados pendientes de gestión en este momento.' };
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
      return { success: false, message: 'API KEY no configurada' };
    }

    let systemPrompt = `
Eres un asistente de redacción para PQRSF de COFREM.

Tu tarea es mejorar y formalizar el texto proporcionado por el agente.

REGLAS:
- Incluye un saludo breve con el nombre del usuario (ej: "Cordial saludo Sr(a). ${metadata.nombre},")
- NO incluyas firma
- NO incluyas teléfonos
- NO incluyas despedida larga
- NO menciones el radicado
- Mantén un tono formal, claro y empático
- Mantén la intención original del mensaje

Devuelve únicamente el cuerpo del mensaje.
`;

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
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
const json = JSON.parse(body);

// 🔴 Si la API falla
if (responseCode !== 200) {
  return {
    success: true,
    text: prompt,
    fuente: "fallback"
  };
}

// 🟢 Si responde bien
if (json.choices && json.choices.length > 0) {
  return {
    success: true,
    text: json.choices[0].message.content.trim()
  };
}

// 🟡 fallback final
return {
  success: true,
  text: prompt
};

  } catch (e) {
    return { success: false, message: e.message };
  }
}
function construirRespuestaFinal(tipo, data) {
  const { radicado, agente, cuerpoIA, correo } = data;

  if (tipo === "PQRSF-RES") {
    return {
      header: `RESPUESTA A SU PQRSF - RADICADO N.° ${radicado}`,
      body: `
Cordial saludo,

En atención a su solicitud radicada ante la Caja de Compensación Familiar COFREM, nos permitimos informarle que, una vez realizado el estudio y validación correspondiente de su caso, se obtuvo el siguiente resultado:

${cuerpoIA}

Agradecemos su comunicación y reiteramos nuestro compromiso con la correcta prestación del servicio.

Cordialmente,

${agente}
Asesora de Servicio al Cliente
`
    };
  }

  if (tipo === "PQRSF-NC") {
    return {
      header: `RESPUESTA A SU PQRSF - RADICADO N.° ${radicado}`,
      body: `
Cordial saludo,

Hemos intentado comunicarnos con usted vía telefónica; sin embargo, no fue posible establecer la comunicación.

La información fue enviada al siguiente correo:

📧 ${correo}

Cordialmente,

${agente}
Asesora de Servicio al Cliente
`
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
      to: toEmail,
      subject: `Resumen PQRSF – ${reportDate}`,
      htmlBody: htmlBody
    });

    return "OK";
  } catch (e) {
    throw new Error('Error al enviar el reporte: ' + e.message);
  }
}
