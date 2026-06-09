/**
 * DuAcademy Pro - Enterprise Edition
 * Lead Developer: Duvan Ramos
 */

const OPENAI_API_KEY = "TU_KEY_DE_OPENAI_AQUI";

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
  return usuario ? { success: true, email: usuario[2] } : { success: false, message: "Credenciales incorrectas" };
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
    // Normalizamos la nota: si es > 1 (ej: 80), la tratamos como porcentaje directo.
    historial: historial.map(h => {
      let valorNota = parseFloat(h[4]) || 0;
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

function guardarResultado(email, idItem, nota) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Guardamos como decimal (0.7) para consistencia de base de datos
  ss.getSheetByName("PROGRESO").appendRow([Date.now(), email, idItem, new Date(), (nota/100), 1]);
  return true;
}

function hablarConIA(mensajeUsuario, idSimulacion, historialAnterior) {
  const fila = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SIMULACIONES").getDataRange().getDisplayValues().find(r => r[0] === idSimulacion);
  const promptSistema = `ERES UN CLIENTE LLAMADO ${fila[3]}. Proceso: ${fila[2]}. Responde como usuario, no como asesor.`;
  const mensajes = [{ "role": "system", "content": promptSistema }, ...historialAnterior, { "role": "user", "content": mensajeUsuario }];

  const options = {
    "method": "post",
    "headers": { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
    "payload": JSON.stringify({ "model": "gpt-4o", "messages": mensajes, "temperature": 0.8 })
  };
  const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
  return JSON.parse(response.getContentText()).choices[0].message.content;
}
