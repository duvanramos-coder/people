/**
 * DuAcademy Pro - Enterprise Edition
 * Lead Developer: Duvan Ramos
 */

// Se recomienda configurar la API Key en Archivo > Configuración del proyecto > Propiedades del script
const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('DuAcademy Pro | By Duvan Ramos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function iniciarSesion(email, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const datos = ss.getSheetByName("USUARIOS").getDataRange().getDisplayValues();
  const usuario = datos.slice(1).find(f => f[2].toLowerCase() === email.toLowerCase() && f[3].toString() === password.toString());
  // Agregamos ROL y NOMBRE al retorno
  return usuario ? { success: true, email: usuario[2], rol: usuario[4], nombre: usuario[1] } : { success: false, message: "Credenciales incorrectas" };
}

function obtenerDatosCompletos(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const user = ss.getSheetByName("USUARIOS").getDataRange().getDisplayValues().find(f => f[2].toLowerCase() === email.toLowerCase());

  const asignadosCursos = user[6] ? user[6].toString().split(",").map(s => s.trim()) : [];
  const asignadosSims = user[7] ? user[7].toString().split(",").map(s => s.trim()) : [];

  const cursosRaw = ss.getSheetByName("CURSOS").getDataRange().getDisplayValues();
  const cabC = cursosRaw.shift();
  const todosLosCursos = cursosRaw.map(f => {
    let o = {}; cabC.forEach((c, i) => o[c] = f[i]); return o;
  });

  const simsRaw = ss.getSheetByName("SIMULACIONES").getDataRange().getDisplayValues();
  const cabS = simsRaw.shift();
  const todasLasSims = simsRaw.map(f => {
    let o = {}; cabS.forEach((c, i) => o[c] = f[i]); return o;
  });

  const progreso = ss.getSheetByName("PROGRESO").getDataRange().getDisplayValues().slice(1);
  const historial = progreso.filter(f => f[1].toLowerCase() === email.toLowerCase());

  return {
    nombre: user[1],
    email: user[2],
    asignadosCursos,
    asignadosSims,
    // Normalizamos la nota: priorizamos nota de examen (index 4) o nota IA (index 6)
    historial: historial.map(h => {
      let valorNota = parseFloat(h[4]) || parseFloat(h[6]) || 0;
      let notaFinal = valorNota > 1 ? valorNota / 100 : valorNota;
      return { idItem: h[2], fecha: h[3], nota: notaFinal };
    }),
    todosLosCursos,
    todasLasSims
  };
}

function obtenerPreguntas(id) {
  const datos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("EXAMENES").getDataRange().getDisplayValues();
  const cab = datos.shift();
  return datos.filter(f => f[1].toString().trim() === id.toString().trim()).map(f => {
    let o = {}; cab.forEach((c, i) => o[c] = f[i]); return o;
  });
}

function guardarResultado(email, idItem, nota, errores = "") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Guardamos como decimal (0.7) para consistencia de base de datos
  // Agregamos columna para errores (Col G)
  ss.getSheetByName("PROGRESO").appendRow([Date.now(), email, idItem, new Date(), (nota/100), 1, "", errores]);
  return true;
}

function obtenerBasePorMensaje(mensajeUsuario) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BASE-CONOCIMIENTO");
  const datos = sheet.getDataRange().getDisplayValues();
  datos.shift(); // encabezados

  const msg = (mensajeUsuario || "").toLowerCase();

  let resultados = datos.filter(f =>
    (f[0] || "").toLowerCase().includes(msg) ||
    (f[1] || "").toLowerCase().includes(msg)
  );

  if (resultados.length === 0) resultados = datos.slice(0, 2);

  return resultados.map(f =>
    `TEMA: ${f[0]}\nINFO: ${f[1]}`
  ).join("\n\n");
}

function guardarNotaIA(email, idSimulacion, notaIA) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PROGRESO");

  sheet.appendRow([
    Date.now(),     // ID_REGISTRO
    email,          // EMAIL_ASESORA
    idSimulacion,   // ID_MODULO
    new Date(),     // FECHA_COMPLETADO
    "",             // NOTA_FINAL
    1,              // INTENTOS
    notaIA / 100    // NOTA_IA (decimal)
  ]);
}

function hablarConIA(mensajeUsuario, idSimulacion, historialAnterior, emailUsuario) {

  // 🔥 Evitar mensaje vacío (clave)
  if (!mensajeUsuario || mensajeUsuario.trim() === "") {
    mensajeUsuario = "inicia la conversación como usuario afiliado";
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SIMULACIONES");
  const datos = sheet.getDataRange().getDisplayValues();

  const fila = datos.find(r => r[0].toString().trim() === idSimulacion.toString().trim());
  if (!fila) return "Error: No se encontró la simulación.";

  const promptBase = fila[3];
  const criterios = fila[4] || "";

  // 🔥 Base de conocimiento (protegida)
  let base = "";
  try {
    base = obtenerBasePorMensaje(mensajeUsuario);
  } catch (e) {
    base = "";
  }

  // 🧠 PROMPT FINAL
  const promptSistema = `
${promptBase}

Eres un usuario afiliado a COFREM.

COMPORTAMIENTO:
- Haces preguntas sobre servicios, subsidios y beneficios
- Puedes hacer varias preguntas en una misma intervención
- Eres exigente, quieres respuestas claras
- Si el asesor responde mal, cuestionas
- No respondes como asesor

BASE DE CONOCIMIENTO:
${base}

REGLAS:
- Usa la base solo como referencia para preguntar
- No copies la base
- No expliques como asesor
`;

  let mensajes = [
    { role: "system", content: promptSistema }
  ];

  // 🟢 INICIO AUTOMÁTICO
  if (!historialAnterior || historialAnterior.length === 0) {
    mensajes.push({
      role: "user",
      content: "Inicia como usuario afiliado a COFREM. Preséntate como Juan y haz una pregunta directa. Ejemplo: 'Hola, soy Juan. Me gustaría saber si puedo recibir cuota monetaria y qué requisitos debo cumplir.'"
    });
  }

  // historial
  if (historialAnterior && historialAnterior.length > 0) {
    mensajes = mensajes.concat(historialAnterior);
  }

  const esEvaluacion = mensajeUsuario.toLowerCase().includes("evaluar");

  if (esEvaluacion) {

    mensajes.push({
      role: "system",
      content: `
Evalúa al asesor con base en:

${criterios}

Formato:

Resultado:
- ✅ / ❌ Mantiene la calma
- ✅ / ❌ Claridad
- ✅ / ❌ Precisión
- ✅ / ❌ Empatía
- ✅ / ❌ Cierre

Calificación final: (0 a 100)

Retroalimentación:
(máximo 5 líneas)
`
    });

  } else {

    mensajes.push({
      role: "user",
      content: mensajeUsuario
    });

  }

  const options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      model: "gpt-4o",
      messages: mensajes,
      temperature: 0.7
    })
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    const data = JSON.parse(response.getContentText());

    const textoIA = data.choices[0].message.content;

    // 💾 Guardar nota IA
    if (esEvaluacion) {
      const match = textoIA.match(/Calificación final:\s*(\d+)/i);
      const nota = match ? parseInt(match[1]) : null;

      if (nota !== null) {
        guardarNotaIA(emailUsuario || "test@correo.com", idSimulacion, nota);
      }
    }

    return textoIA;

  } catch (e) {
    Logger.log(e);
    return "Error de conexión con IA";
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📩 Notificaciones')
    .addItem('Enviar correo general', 'enviarCorreoGeneral')
    .addToUi();
}

/**
 * ACTUALIZAR PING CONEXIÓN (COLUMNA I)
 */
function actualizarPingConexion(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("USUARIOS");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2].toLowerCase() === email.toLowerCase()) {
      sheet.getRange(i + 1, 9).setValue(new Date()); // Columna I (9)
      return true;
    }
  }
  return false;
}

/**
 * OBTENER DATOS PARA EL DASHBOARD ADMIN
 */
function obtenerDatosAdmin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usuarios = ss.getSheetByName("USUARIOS").getDataRange().getDisplayValues();
  const progreso = ss.getSheetByName("PROGRESO").getDataRange().getDisplayValues();

  usuarios.shift(); // Quitar cabecera
  const listaAsesores = usuarios.filter(u => u[4] === "Asesor").map(u => {
    return {
      nombre: u[1],
      email: u[2],
      rol: u[4],
      modulos: u[6],
      simulaciones: u[7],
      ultimaConexion: u[8]
    };
  });

  progreso.shift(); // Quitar cabecera
  const historialProgreso = progreso.map(p => {
    // Tomamos nota de examen (index 4) o nota de simulación IA (index 6)
    let valorNota = parseFloat(p[4]) || parseFloat(p[6]) || 0;
    let notaNormalizada = valorNota > 1 ? valorNota / 100 : valorNota;
    return {
      email: p[1],
      idItem: p[2],
      fecha: p[3],
      nota: notaNormalizada,
      errores: p[7] || "" // Columna H (8) en PROGRESO
    };
  });

  const totalAsesores = listaAsesores.length;
  const notas = historialProgreso.filter(p => p.nota !== "").map(p => p.nota);
  const promedioGeneral = notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length) : 0;
  const totalCompletados = historialProgreso.length;

  return {
    stats: {
      totalAsesores,
      promedioGeneral: (promedioGeneral * 100).toFixed(1) + "%",
      totalCompletados
    },
    asesores: listaAsesores,
    progreso: historialProgreso
  };
}

/**
 * ASIGNAR MÓDULOS A UN USUARIO (COLUMNAS G Y H)
 */
function asignarModulosUsuario(email, cursos, sims) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("USUARIOS");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2].toLowerCase() === email.toLowerCase()) {
      sheet.getRange(i + 1, 7).setValue(cursos); // Col G (7)
      sheet.getRange(i + 1, 8).setValue(sims);   // Col H (8)
      return true;
    }
  }
  return false;
}

function enviarCorreoGeneral() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("USUARIOS");

  if (!hoja) {
    SpreadsheetApp.getUi().alert("No existe la hoja 'USUARIOS'.");
    return;
  }

  const data = hoja.getDataRange().getValues();
  const headers = data[0];

  const colEmail = headers.indexOf("EMAIL");
  const colModulos = headers.indexOf("MODULOS_ASIGNADOS");
  const colEstado = headers.indexOf("ESTADO");

  if (colEmail === -1 || colModulos === -1 || colEstado === -1) {
    SpreadsheetApp.getUi().alert("Faltan columnas: EMAIL, MODULOS_ASIGNADOS o ESTADO.");
    return;
  }

  let correos = [];

  for (let i = 1; i < data.length; i++) {
    const fila = data[i];

    const email = fila[colEmail];
    const modulos = fila[colModulos];
    const estado = fila[colEstado];

    if (email && modulos && estado === "Activo") {
      correos.push(email);
    }
  }

  if (correos.length === 0) {
    SpreadsheetApp.getUi().alert("No hay usuarios para enviar.");
    return;
  }

  const html = HtmlService
    .createHtmlOutputFromFile('correo_general')
    .getContent();

  for (let i = 0; i < correos.length; i++) {
  MailApp.sendEmail({
    to: correos[i],
    subject: "Recordatorio de módulos pendientes - Du AcademyPro",
    htmlBody: html
  });
}

  SpreadsheetApp.getUi().alert("Correos enviados: " + correos.length);
}
