function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile("index")
      .setTitle("Dashboard Pro - People BPO")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    return HtmlService.createHtmlOutput("Error al cargar el dashboard: " + e.toString());
  }
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
  const asesorOriginal = asesor;

  // Cache data from all sheets once
  const baseSheet = ss.getSheetByName("Base");
  const lastRowBase = baseSheet.getLastRow();
  const data = baseSheet.getRange(1, 1, lastRowBase, 34).getValues();

  const toSheet = ss.getSheetByName("TO");
  const lastRowTO = toSheet.getLastRow();
  const dataTO = lastRowTO > 0 ? toSheet.getRange(1, 1, lastRowTO, 10).getValues() : [];

  const funcSheet = ss.getSheetByName("Funcionarios");
  const lastRowFunc = funcSheet.getLastRow();
  const funcionariosData = lastRowFunc > 1 ? funcSheet.getRange(1, 1, lastRowFunc, 9).getValues() : [];

  let bonoGanado = 0;
  for (let i = 0; i < dataTO.length; i++) {
    if ((dataTO[i][0] || "").toString().trim().toUpperCase() === asesorBuscado) {
      let b = dataTO[i][9];
      bonoGanado = Number(typeof b === "string" ? b.replace(/[^\d]/g, "") : b) || 0;
      break;
    }
  }

  const tablaData = [];
  const tz = ss.getSpreadsheetTimeZone();
  for(let i = 1; i < funcionariosData.length; i++){
    if(funcionariosData[i][0] == asesorOriginal){
      let f = funcionariosData[i][5];
      tablaData.push({
        fecha: f instanceof Date ? Utilities.formatDate(f, tz, "dd-MM-yyyy") : f,
        positivos: funcionariosData[i][6],
        mejora: funcionariosData[i][7],
        link: funcionariosData[i][8]
      });
    }
  }

  let asesores = [], notaPEC = 0, notaPENC = 0, auditorias = 0;
  let pqrsfCreados = 0, pqrsfDevueltos = 0, sncRecibidos = 0, sncSolucionado = 0;
  const asesorasEspeciales = ["J.MENDOZA382", "L.BUITRAGO104", "M.ARAGONES300"];
  const isEsp = asesorasEspeciales.indexOf(asesorBuscado) !== -1;
  const rankingList = [];

  // SINGLE PASS OVER BASE DATA
  for(let i = 1; i < data.length; i++){
    let row = data[i];

    // Asesores data for Ranking
    if(row[8]){
      let pec = parseFloat(row[9]), penc = parseFloat(row[10]);
      if(!isNaN(penc)){
        asesores.push({ nombre: row[8], pec: pec, penc: penc });
        if ((row[8] || "").toString().trim().toUpperCase() == asesorBuscado) { notaPEC = pec; notaPENC = penc; }
      }
    }
    if(row[12]){
      let pec = parseFloat(row[13]), penc = parseFloat(row[14]);
      if(!isNaN(penc)){
        asesores.push({ nombre: row[12], pec: pec, penc: penc });
        if ((row[12] || "").toString().trim().toUpperCase() == asesorBuscado) { notaPEC = pec; notaPENC = penc; }
      }
    }

    // Auditorías (AG/AH)
    if ((row[32] || "").toString().trim().toUpperCase() == asesorBuscado) {
      auditorias = row[33];
    }

    // PQRSF (X/Y/Z)
    if ((row[23] || "").toString().trim().toUpperCase() == asesorBuscado) {
      pqrsfDevueltos = Number(row[24]) || 0;
      pqrsfCreados = Number(row[25]) || 0;
    }

    // SNC Metrics (Y/AA/AB/AC/AD)
    if (isEsp) {
      let uDash = (row[24] || "").toString().trim().toUpperCase();
      if(uDash == asesorBuscado){
        sncRecibidos = Number(row[26]) || 0;
        pqrsfCreados = Number(row[27]) || 0;
        pqrsfDevueltos = Number(row[28]) || 0;
        sncSolucionado = Number(row[29]) || 0;
      }
      let sncVal = Number(row[26]) || 0;
      if(uDash) rankingList.push({ usuario: uDash, snc: sncVal });
    }
  }

  asesores.sort(function(a, b) { return b.penc - a.penc; });
  let ranking = 0;
  for(let i = 0; i < asesores.length; i++){
    if((asesores[i].nombre || "").toString().trim().toUpperCase() == asesorBuscado){
      ranking = i + 1; break;
    }
  }

  let suma = 0, contador = 0;
  for (let i = 0; i < asesores.length; i++) { suma += asesores[i].penc; contador++; }
  let promedio = contador > 0 ? suma / contador : 0;

  let rankingSNC = 0;
  if(isEsp){
    rankingList.sort(function(a, b) { return b.snc - a.snc; });
    for(let i = 0; i < rankingList.length; i++){
      if(rankingList[i].usuario == asesorBuscado){ rankingSNC = i + 1; break; }
    }
  }

  return {
    asesor: asesorOriginal, pec: notaPEC, penc: notaPENC, promedio: promedio, ranking: ranking,
    auditorias: auditorias, pqrsfCreados: pqrsfCreados, pqrsfDevueltos: pqrsfDevueltos,
    sncRecibidos: sncRecibidos, sncSolucionado: sncSolucionado, rankingSNC: rankingSNC,
    tablaData: tablaData, bonoGanado: bonoGanado
  };
}
