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
 * Searches in a specific sheet and column using keyword-based matching (all words must be present)
 */
function buscarEnHoja(sheetName, columnIdx, query, limit = 8) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  // Split query into keywords and filter out small or empty words
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (keywords.length === 0) return [];

  const results = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][columnIdx]) continue;
    const content = data[i][columnIdx].toString().toLowerCase();

    // Check if all keywords are present in the content
    const match = keywords.every(kw => content.indexOf(kw) !== -1);

    if (match) {
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
    // Search in DATA (E: CASO = index 4) and CASOS (A: CASO = index 0)
    const resultsData = buscarEnHoja('DATA', 4, caso, 4);
    const resultsCasos = buscarEnHoja('CASOS', 0, caso, 4);

    // Process DATA results: A:Radicado, B:Tipo, C:Dirigido, E:Caso
    resultsData.forEach(r => {
      options.push({
        tipo: r[1] || 'SIN TIPO',
        dirigido: r[2] || 'POR DEFINIR',
        clasificacion: "Hda. DATA (Previo)",
        accion: "Validar trámite con el área de " + (r[2] || 'Subsidios'),
        recordatorio: "Este caso coincide con un radicado previo en DATA.",
        fuente: "Radicado #" + r[0],
        resumen_caso: r[4] || "Sin descripción disponible"
      });
    });

    // Process CASOS results: A:Caso, B:Acción, C:Recordatorio, D:Tipo, E:Dirigido
    resultsCasos.forEach(r => {
      options.push({
        tipo: r[3] || 'PQRSF',
        dirigido: r[4] || 'ÁREA INTERNA',
        clasificacion: "Guía CASOS",
        accion: r[1] || 'Consultar manual de procesos',
        recordatorio: r[2] || "Seguir lineamientos de la hoja CASOS.",
        fuente: "Base CASOS",
        resumen_caso: r[0] || "Sin descripción"
      });
    });

    contextEjemplos = options.map(o =>
      `PQRSF: ${o.resumen_caso} -> Clasificación: ${o.tipo}, Dirigido: ${o.dirigido}, Acción: ${o.accion}`
    ).join("\n");

  } else {
    // Mode GENERAL: A: Pregunta/Tema, B: Respuesta/Qué decir, C: Referencia
    const resultsGeneral = buscarEnHoja('GENERAL', 0, caso, 6);
    resultsGeneral.forEach(r => {
      options.push({
        tipo: 'RESPUESTA DIRECTA',
        dirigido: r[2] || 'GENERAL',
        clasificacion: 'CONOCIMIENTO ACADEMIA',
        accion: r[1] || 'No hay una respuesta definida para este tema.',
        recordatorio: "Basado estrictamente en la base GENERAL.",
        fuente: "Hoja GENERAL",
        resumen_caso: r[0] || "Tema de consulta"
      });
    });

    contextEjemplos = options.map(o =>
      `TEMA: ${o.resumen_caso} -> RESPUESTA: ${o.accion}`
    ).join("\n");
  }

  const prompt = mode === 'PQRSF' ?
  `Eres un experto en clasificación de PQRSF de PEOPLE ACADEMY PRO.
   Analiza este caso: "${caso}"

   Usa el CONTEXTO para devolver un JSON con campos tipo, clasificacion, dirigido, accion, recordatorio.
   Responde ÚNICAMENTE con JSON basado en el contexto. Si no hay contexto útil, responde JSON con error.

   CONTEXTO:
   ${contextEjemplos || "No hay ejemplos directos."}` :
  `Eres el buscador inteligente de PEOPLE ACADEMY PRO.
   Responde a: "${caso}"

   IMPORTANTE: Da una respuesta directa clara y concisa basada SOLO en el contexto.
   Devuelve JSON con campos tipo (TEMA), clasificacion, dirigido, accion (LA RESPUESTA), recordatorio.

   CONTEXTO GENERAL:
   ${contextEjemplos || "Información no encontrada."}`;

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
