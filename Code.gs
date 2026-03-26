function doGet() {
  try {
    return HtmlService.createTemplateFromFile("index").evaluate()
      .setTitle("Dashboard Pro - People BPO")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    return HtmlService.createHtmlOutput("Error al cargar el dashboard: " + e.toString());
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ===================== */
/* OBTENER USUARIOS */
/* ===================== */

function obtenerUsuarios(){
  try {
    const ss = SpreadsheetApp.openById("1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU");
    const sheet = ss.getSheetByName("Funcionarios");
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(row) { return row[0]; });
  } catch (e) {
    return [];
  }
}

/* ===================== */
/* LOGIN */
/* ===================== */

function login(usuario, password){
  try {
    const ss = SpreadsheetApp.openById("1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU");
    const sheetUsers = ss.getSheetByName("Funcionarios");
    const lastRow = sheetUsers.getLastRow();
    if (lastRow < 1) return "ERROR";
    const users = sheetUsers.getRange(1, 1, lastRow, 5).getValues();
    for(let i = 1; i < users.length; i++){
      if(usuario == users[i][0] && password == users[i][3]){
        let datos = obtenerMetricasConSS(ss, users[i][0]);
        datos.nombre = users[i][4];
        return datos;
      }
    }
  } catch (e) {}
  return "ERROR";
}

/* ===================== */
/* MÉTRICAS DASHBOARD (Optimizado) */
/* ===================== */

function obtenerMetricas(asesor) {
  const ss = SpreadsheetApp.openById("1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU");
  return obtenerMetricasConSS(ss, asesor);
}

function obtenerMetricasConSS(ss, asesor) {
  const asesorBuscado = (asesor || "").toString().trim().toUpperCase();

  // Cache data from sheets
  const toSheet = ss.getSheetByName("TO");
  const lastRowTO = toSheet.getLastRow();
  // Columns A to P (16 columns) to cover all metrics
  const dataTO = lastRowTO > 1 ? toSheet.getRange(1, 1, lastRowTO, 16).getValues() : [];

  const funcSheet = ss.getSheetByName("Funcionarios");
  const lastRowFunc = funcSheet.getLastRow();
  const funcionariosData = lastRowFunc > 1 ? funcSheet.getRange(1, 1, lastRowFunc, 9).getValues() : [];

  let metrics = [];
  let area = "";
  let bonoGanado = 0;
  let rowUser = null;

  // Search user in TO sheet
  for (let i = 1; i < dataTO.length; i++) {
    if ((dataTO[i][0] || "").toString().trim().toUpperCase() === asesorBuscado) {
      rowUser = dataTO[i];
      // Determinar el área basado en la estructura de la fila
      // Si la columna 5 (index 5) tiene texto, es el área para el nuevo grupo "G. Empleo Cofrem"
      if (typeof rowUser[5] === 'string' && rowUser[5].trim() !== "" && isNaN(parseFloat(rowUser[5]))) {
        area = rowUser[5].trim();
      } else {
        area = (rowUser[2] || "").toString().trim();
      }
      break;
    }
  }

  if (rowUser) {
    const fmtPct = (val) => {
      if (typeof val === 'number') return (val * 100).toFixed(1) + "%";
      if (typeof val === 'string' && val.includes('%')) return val;
      return (val || 0).toString();
    };

    const getVal = (idx) => rowUser[idx] || 0;

    // Area mapping based on Spreadsheet structure
    if (area === "G. Empleo Cofrem") {
      metrics.push({ label: "PEC", value: fmtPct(getVal(2)) });
      metrics.push({ label: "PENC", value: fmtPct(getVal(3)) });
      metrics.push({ label: "Auditorías", value: getVal(4) });
      bonoGanado = 0; // No ganan bonos
    } else if (area === "Linea amiga - Caja" || area === "Chat") {
      metrics.push({ label: "Satisfacción", value: fmtPct(getVal(4)) });
      metrics.push({ label: "PEC", value: fmtPct(getVal(5)) });
      metrics.push({ label: "PENC", value: fmtPct(getVal(6)) });
      metrics.push({ label: "Productividad", value: fmtPct(getVal(7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(getVal(8)) });
      metrics.push({ label: "PQRSF Creados", value: getVal(10) });
      metrics.push({ label: "PQRSF Devueltos", value: getVal(11) });
      metrics.push({ label: "Auditorías", value: getVal(12) });
      bonoGanado = parseBono(getVal(9));
    } else if (area === "G. Empleo") {
      metrics.push({ label: "Satisfacción", value: fmtPct(getVal(4)) });
      metrics.push({ label: "PEC", value: fmtPct(getVal(5)) });
      metrics.push({ label: "PENC", value: fmtPct(getVal(6)) });
      metrics.push({ label: "Productividad", value: fmtPct(getVal(7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(getVal(8)) });
      bonoGanado = parseBono(getVal(9));
    } else if (area === "Encuestas") {
      metrics.push({ label: "Adherencia", value: fmtPct(getVal(8)) });
      metrics.push({ label: "Precisión Ortográfica", value: fmtPct(getVal(9)) });
      metrics.push({ label: "Error de Respuesta", value: getVal(10) });
      bonoGanado = parseBono(getVal(11));
    } else if (area === "Radicacion") {
      metrics.push({ label: "Productividad", value: fmtPct(getVal(4)) });
      metrics.push({ label: "Radicados", value: fmtPct(getVal(5)) });
      metrics.push({ label: "SNC", value: fmtPct(getVal(6)) });
      metrics.push({ label: "Precisión Ortográfica", value: fmtPct(getVal(7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(getVal(8)) });
      metrics.push({ label: "SNC Recibidos", value: getVal(10) });
      metrics.push({ label: "Cant. Radicados", value: getVal(11) });
      metrics.push({ label: "Por Corrección", value: getVal(12) });
      metrics.push({ label: "SNC Solucionados", value: getVal(13) });
      bonoGanado = parseBono(getVal(9));
    }
  }

  const tablaData = [];
  const tz = ss.getSpreadsheetTimeZone();
  for(let i = 1; i < funcionariosData.length; i++){
    if(funcionariosData[i][0] == asesorBuscado){
      let f = funcionariosData[i][5];
      tablaData.push({
        fecha: f instanceof Date ? Utilities.formatDate(f, tz, "dd-MM-yyyy") : f,
        positivos: funcionariosData[i][6],
        mejora: funcionariosData[i][7],
        link: funcionariosData[i][8]
      });
    }
  }

  return {
    asesor: asesor,
    area: area,
    metrics: metrics,
    tablaData: tablaData,
    bonoGanado: bonoGanado
  };
}

function parseBono(val) {
  if (!val) return 0;
  return Number(typeof val === "string" ? val.replace(/[^\d]/g, "") : val) || 0;
}
