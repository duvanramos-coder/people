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

    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    return data.map(function(row) { return row[0]; });
  } catch (e) {
    Logger.log("Error obtenerUsuarios: " + e);
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

    if (lastRow < 2) return "ERROR";

    const users = sheetUsers.getRange(1, 1, lastRow, 5).getValues();

    for(let i = 1; i < users.length; i++){
      let asesor = users[i][0];
      let pass = users[i][3];
      let nombre = users[i][4];

      if(usuario == asesor && password == pass){
        let datos = obtenerMetricasConSS(ss, asesor);
        datos.nombre = nombre;
        return datos;
      }
    }
  } catch (e) {
    Logger.log("Error login: " + e);
  }
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
  const sheetBase = ss.getSheetByName("Base");
  const lastRowBase = sheetBase.getLastRow();
  const data = sheetBase.getRange(1, 1, lastRowBase, 31).getValues();

  const asesorBuscado = (asesor || "").toString().trim().toUpperCase();

  /* ===================== */
  /* OBTENER BONO GANADO */
  /* ===================== */
  let bonoGanado = 0;
  try {
    const sheetTO = ss.getSheetByName("TO");
    const lastRowTO = sheetTO.getLastRow();
    if (lastRowTO > 0) {
      const dataTO = sheetTO.getRange(1, 1, lastRowTO, 10).getValues();
      for (let i = 0; i < dataTO.length; i++) {
        let usuario = (dataTO[i][0] || "").toString().trim().toUpperCase();
        if (usuario === asesorBuscado) {
          let bono = dataTO[i][9];
          if (typeof bono === "string") {
            bono = bono.replace(/[^\d]/g, "");
          }
          bonoGanado = Number(bono) || 0;
          break;
        }
      }
    }
  } catch (e) {
    Logger.log("ERROR BONO: " + e);
  }

  /* ===================== */
  /* DATOS TABLA EVALUACIONES */
  /* ===================== */
  const sheetFuncionarios = ss.getSheetByName("Funcionarios");
  const lastRowFunc = sheetFuncionarios.getLastRow();
  let tablaData = [];
  if (lastRowFunc > 1) {
    const funcionariosData = sheetFuncionarios.getRange(1, 1, lastRowFunc, 9).getValues();
    const tz = ss.getSpreadsheetTimeZone();
    for(let i = 1; i < funcionariosData.length; i++){
      if(funcionariosData[i][0] == asesor){
        let fecha = funcionariosData[i][5];
        if(fecha instanceof Date){
          fecha = Utilities.formatDate(fecha, tz, "dd-MM-yyyy");
        }
        tablaData.push({
          fecha: fecha,
          positivos: funcionariosData[i][6],
          mejora: funcionariosData[i][7],
          link: funcionariosData[i][8]
        });
      }
    }
  }

  let asesores = [];
  let notaPEC = 0;
  let notaPENC = 0;
  let auditorias = 0;
  let pqrsfCreados = 0;
  let pqrsfDevueltos = 0;
  let sncRecibidos = 0;
  let sncSolucionado = 0;
  let rankingSNC = 0;

  /* ===================== */
  /* RANKING Y NOTA */
  /* ===================== */
  for(let i = 1; i < data.length; i++){
    // Bloque 1
    if(data[i][8]){
      let pec = parseFloat(data[i][9]);
      let penc = parseFloat(data[i][10]);
      if(!isNaN(penc)){
        let nom = data[i][8];
        asesores.push({ nombre: nom, pec: pec, penc: penc });
        if (nom == asesor) { notaPEC = pec; notaPENC = penc; }
      }
    }
    // Bloque 2
    if(data[i][12]){
      let pec = parseFloat(data[i][13]);
      let penc = parseFloat(data[i][14]);
      if(!isNaN(penc)){
        let nom = data[i][12];
        asesores.push({ nombre: nom, pec: pec, penc: penc });
        if (nom == asesor) { notaPEC = pec; notaPENC = penc; }
      }
    }
  }

  /* ORDENAR RANKING */
  asesores.sort(function(a, b) { return b.penc - a.penc; });
  let ranking = 0;
  for(let i = 0; i < asesores.length; i++){
    if((asesores[i].nombre || "").toString().trim().toUpperCase() == asesorBuscado){
      ranking = i + 1;
      break;
    }
  }

  /* PROMEDIO EQUIPO */
  let suma = 0, contador = 0;
  for (let i = 0; i < asesores.length; i++) {
    suma += asesores[i].penc;
    contador++;
  }
  let promedio = contador > 0 ? suma / contador : 0;

  /* ===================== */
  /* AUDITORIAS */
  /* ===================== */
  for(let i = 1; i < data.length; i++){
    if ((data[i][10] || "").toString().trim().toUpperCase() == asesorBuscado) {
      auditorias = data[i][11];
      break;
    }
  }

  /* ===================== */
  /* PQRSF */
  /* ===================== */
  for(let i = 1; i < data.length; i++){
    if ((data[i][23] || "").toString().trim().toUpperCase() == asesorBuscado) {
      pqrsfDevueltos = Number(data[i][24]) || 0;
      pqrsfCreados = Number(data[i][25]) || 0;
      break;
    }
  }

  /* METRICAS SNC */
  const asesorasEspeciales = ["J.MENDOZA382", "L.BUITRAGO104", "M.ARAGONES300"];
  if(asesorasEspeciales.indexOf(asesorBuscado) !== -1){
    for(let i = 1; i < data.length; i++){
      let usuarioDash = (data[i][24] || "").toString().trim().toUpperCase();
      if(usuarioDash == asesorBuscado){
        sncRecibidos = Number(data[i][26]) || 0;
        pqrsfCreados = Number(data[i][27]) || 0;
        pqrsfDevueltos = Number(data[i][28]) || 0;
        sncSolucionado = Number(data[i][29]) || 0;
        break;
      }
    }

    let rankingList = [];
    for(let i = 1; i < data.length; i++){
      let usuarioDash = (data[i][24] || "").toString().trim().toUpperCase();
      let snc = Number(data[i][26]) || 0;
      if(usuarioDash) rankingList.push({ usuario: usuarioDash, snc: snc });
    }
    rankingList.sort(function(a, b) { return b.snc - a.snc; });
    for(let i = 0; i < rankingList.length; i++){
      if(rankingList[i].usuario == asesorBuscado){
        rankingSNC = i + 1;
        break;
      }
    }
  }

  return {
    asesor: asesor,
    pec: notaPEC,
    penc: notaPENC,
    promedio: promedio,
    ranking: ranking,
    auditorias: auditorias,
    pqrsfCreados: pqrsfCreados,
    pqrsfDevueltos: pqrsfDevueltos,
    sncRecibidos: sncRecibidos,
    sncSolucionado: sncSolucionado,
    rankingSNC: rankingSNC,
    tablaData: tablaData,
    bonoGanado: bonoGanado
  };
}
