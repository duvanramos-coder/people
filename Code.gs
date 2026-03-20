/**
 * @OnlyCurrentDoc
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('MODULO PQRSF - NEXT GEN')
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
    if (results.length >= 5) break; // Limit sheet matches to top 5
  }
  return results;
}

function clasificarConIA(caso) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) return { error: "API Key no configurada" };

  const ejemplosSheet = buscarCasos(caso);

  // Prepare multiple options if sheet matches exist
  const options = [];

  if (ejemplosSheet.length > 0) {
    ejemplosSheet.forEach(e => {
       options.push({
         tipo: e.tipo,
         dirigido: e.dirigido,
         clasificacion: "Coincidencia en Base de Datos",
         accion: "Validar según procedimiento de " + e.dirigido,
         recordatorio: "Caso real previo detectado en el sistema.",
         fuente: "Radicado #" + e.radicado,
         resumen_caso: e.caso
       });
    });
  }

  // Also get an IA generation for the specific input
  let contextEjemplos = "";
  if (ejemplosSheet.length > 0) {
    contextEjemplos = "\nCasos similares en BD para referencia:\n" +
      ejemplosSheet.slice(0,2).map(e => `Caso: ${e.caso} -> Tipo: ${e.tipo}, Dirigido: ${e.dirigido}`).join("\n");
  }

  const prompt = `
    Eres un experto en clasificación de PQRSF de alto nivel.
    Analiza el siguiente caso y devuelve un objeto JSON con los campos:
    - tipo: (Tipo de solicitud)
    - clasificacion: (Clasificación detallada)
    - dirigido: (Área a la que se dirige)
    - accion: (Acción estratégica recomendada)
    - recordatorio: (Recordatorio clave)

    Caso: "${caso}"
    ${contextEjemplos}

    Responde ÚNICAMENTE con el objeto JSON.
  `;

  const payload = {
    model: "gpt-3.5-turbo",
    messages: [{ role: "system", content: "Responde solo con JSON válido." }, { role: "user", content: prompt }],
    temperature: 0.3
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
    aiResult.fuente = "Inteligencia Artificial";
    aiResult.resumen_caso = "Análisis generado por IA para: " + caso;

    // Add IA result as an option (preferably first or as an alternative)
    options.unshift(aiResult);

    return { options: options };
  } catch (e) {
    if (options.length > 0) return { options: options }; // Fallback to sheet matches only
    return { error: "Error procesando con IA: " + e.toString() };
  }
}
