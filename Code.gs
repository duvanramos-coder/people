/**
 * @OnlyCurrentDoc
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('MODULO PQRSF')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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

function buscarCasos(query) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DATA');
  const data = sheet.getDataRange().getValues();
  const queryNormalized = query.toLowerCase();

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const caso = data[i][4].toString().toLowerCase(); // Column E: CASO
    if (caso.includes(queryNormalized)) {
      results.push({
        radicado: data[i][0],
        tipo: data[i][1],
        dirigido: data[i][2],
        radicador: data[i][3],
        caso: data[i][4]
      });
    }
    if (results.length >= 3) break; // Limit sheet matches
  }
  return results;
}

function clasificarConIA(caso) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) return { error: "API Key no configurada" };

  const ejemplosSheet = buscarCasos(caso);
  let contextEjemplos = "";
  if (ejemplosSheet.length > 0) {
    contextEjemplos = "\nEjemplos encontrados en la base de datos:\n" +
      ejemplosSheet.map(e => `Caso: ${e.caso} -> Tipo: ${e.tipo}, Dirigido: ${e.dirigido}`).join("\n");
  }

  const prompt = `
    Eres un experto en clasificación de PQRSF.
    Analiza el siguiente caso y devuelve un objeto JSON con los campos:
    - tipo: (Tipo de solicitud)
    - clasificacion: (Clasificación breve)
    - dirigido: (Área a la que se dirige)
    - accion: (Acción recomendada para el asesor)
    - recordatorio: (Recordatorio relevante)

    Caso a analizar: "${caso}"
    ${contextEjemplos}

    Responde ÚNICAMENTE con el objeto JSON.
  `;

  const payload = {
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    const json = JSON.parse(response.getContentText());
    const aiResult = JSON.parse(json.choices[0].message.content);

    // Merge with first sheet result for "Fuente" if available
    if (ejemplosSheet.length > 0) {
      aiResult.fuente = "Radicado #" + ejemplosSheet[0].radicado;
    } else {
      aiResult.fuente = "IA (Sin coincidencia exacta)";
    }

    return aiResult;
  } catch (e) {
    return { error: "Error procesando con IA: " + e.toString() };
  }
}
