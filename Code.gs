/**
 * @OnlyCurrentDoc
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('PEOPLE ACADEMY PRO')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function obtenerUsuarios() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Usuarios');
    const data = sheet.getDataRange().getValues();
    const usuarios = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) usuarios.push(data[i][0].toString());
    }
    return usuarios.sort();
  } catch (e) {
    return [];
  }
}

function loginUser(usuario, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Usuarios');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toUpperCase() === usuario.trim().toUpperCase() &&
        data[i][1].toString() === password.toString()) {
      return { success: true, usuario: data[i][0] };
    }
  }
  return { success: false };
}

function guardarRegistro(usuario, consulta) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registros');
  sheet.appendRow([new Date(), usuario, consulta]);
}

/**
 * Searches in a specific sheet and column
 */
function buscarEnHoja(sheetName, columnIdx, query, limit = 5) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const queryNormalized = query.toLowerCase();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][columnIdx]) continue;
    const content = data[i][columnIdx].toString().toLowerCase();
    if (content.includes(queryNormalized)) {
      results.push(data[i]);
    }
    if (results.length >= limit) break;
  }
  return results;
}

function clasificarConIA(caso, mode) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) return { error: "API Key no configurada" };

  const options = [];
  let contextEjemplos = "";

  if (mode === 'PQRSF') {
    // Search in DATA and CASOS
    const resultsData = buscarEnHoja('DATA', 4, caso, 3);
    const resultsCasos = buscarEnHoja('CASOS', 0, caso, 3);

    // Process DATA results
    resultsData.forEach(r => {
      options.push({
        tipo: r[1],
        dirigido: r[2],
        clasificacion: "Coincidencia en DATA",
        accion: "Validar según procedimiento de " + r[2],
        recordatorio: "Caso real previo detectado.",
        fuente: "Radicado #" + r[0],
        resumen_caso: r[4]
      });
    });

    // Process CASOS results
    resultsCasos.forEach(r => {
      options.push({
        tipo: r[3] || 'PQRSF',
        dirigido: r[4] || 'Por asignar',
        clasificacion: r[3] || 'Trámite Interno',
        accion: r[1] || 'Sin acción definida',
        recordatorio: "Guía de la hoja CASOS.",
        fuente: "Base Documental CASOS",
        resumen_caso: r[0]
      });
    });

    contextEjemplos = options.slice(0, 4).map(o =>
      `Caso: ${o.resumen_caso} -> Tipo: ${o.tipo}, Dirigido: ${o.dirigido}, Acción: ${o.accion}`
    ).join("\n");

  } else {
    // Mode GENERAL
    const resultsGeneral = buscarEnHoja('GENERAL', 0, caso, 5);
    resultsGeneral.forEach(r => {
      options.push({
        tipo: 'INFORMACIÓN GENERAL',
        dirigido: r[2] || 'Información',
        clasificacion: 'CONSULTA GENERAL',
        accion: r[1] || 'Responder según base',
        recordatorio: "Información extraída de la hoja GENERAL.",
        fuente: "Base GENERAL",
        resumen_caso: r[0]
      });
    });

    contextEjemplos = options.map(o =>
      `Caso/Pregunta: ${o.resumen_caso} -> Respuesta/Qué hacer: ${o.accion}`
    ).join("\n");
  }

  const prompt = `
    Eres un experto en procesos de PEOPLE ACADEMY PRO.
    Analiza el siguiente caso: "${caso}"

    INSTRUCCIONES CRÍTICAS:
    1. Responde ÚNICAMENTE basándote en el contexto proporcionado a continuación.
    2. Si la información no está en el contexto, indica explícitamente que no se encontró en la base de datos de la academia.
    3. NO inventes procedimientos ni uses conocimiento previo.
    4. Devuelve un objeto JSON con los campos: tipo, clasificacion, dirigido, accion, recordatorio.

    CONTEXTO DE LA BASE DE DATOS:
    ${contextEjemplos || "No se encontraron coincidencias directas en la base de datos."}

    Responde solo con el JSON.
  `;

  const payload = {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Eres un asistente corporativo estricto que solo responde basándose en el contexto dado. Formato: JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1
  };

  const fetchOptions = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", fetchOptions);
    const json = JSON.parse(response.getContentText());
    const aiResult = JSON.parse(json.choices[0].message.content);
    aiResult.fuente = "Análisis IA (People Academy)";
    aiResult.resumen_caso = "Interpretación inteligente para: " + caso;

    // Add IA result as first option
    options.unshift(aiResult);

    return { options: options };
  } catch (e) {
    if (options.length > 0) return { options: options };
    return { error: "No se encontró información relacionada en nuestra base de datos." };
  }
}
