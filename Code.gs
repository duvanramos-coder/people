const CONFIG = {
  SPREADSHEET_ID: '1SBo7HtxMgra_M_v2raHAQaesc94k3hp6718W8JcVShY',
  SHEETS: {
    USUARIOS_ADMIN: 'USUARIOS_ADMIN',
    BASE_METRICAS: 'BASE_METRICAS',
    PQRSF_COMUNICADOS: 'PQRSF_COMUNICADOS',
    RADICACION_LIVE: 'RADICACIÓN_LIVE',
    PQRSF_LIVE: 'PQRSF_LIVE',
    TURNOS: 'TURNOS',
    PQRSF_DEVUELTOS: 'PQRSF_DEVUELTOS',
    GESTIONES_DIARIAS: 'GESTIONES_DIARIAS'
  },
  TIMEZONE: "America/Bogota"
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Admin Dashboard Premium')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSs() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function login(username, password) {
  const ss = getSs();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS_ADMIN);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && String(data[i][1]) === String(password)) {
      return { success: true, username: username };
    }
  }
  return { success: false };
}

function normalize(str) {
  if (!str) return "";
  return str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getDashboardData() {
  const ss = getSs();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "dd/MM/yyyy");

  // 1. PQRSF_COMUNICADOS Metrics
  const pqrsfComunicadosSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_COMUNICADOS);
  const pqrsfData = pqrsfComunicadosSheet.getDataRange().getValues();
  const pqrsfRows = pqrsfData.slice(1);

  let totalPQRS = 0;
  let comunicados = 0;
  let pendientes = 0;
  let sumaEfectividad = 0;
  let conteoEfectividad = 0;
  let canales = {};
  let estados = {};
  let requiereSolucion = 0;

  pqrsfRows.forEach(row => {
    const estado = row[8]; // I
    const nombre = row[4]; // E
    const tel = row[5];    // F
    const correo = row[6]; // G
    const empresa = row[7]; // H
    const canal = row[9];  // J
    const efectividad = parseFloat(row[10]) || 0; // K
    const reqSol = row[11]; // L

    let isValuable = false;
    if (estado) {
      comunicados++;
      isValuable = true;
    } else if (nombre || tel || correo || empresa) {
      pendientes++;
      isValuable = true;
    }

    if (isValuable) {
      totalPQRS++;
      if (canal) canales[canal] = (canales[canal] || 0) + 1;
      if (estado) estados[estado] = (estados[estado] || 0) + 1;
      if (row[10] !== "" && !isNaN(efectividad)) {
        sumaEfectividad += efectividad;
        conteoEfectividad++;
      }
      if (normalize(reqSol) === "si") requiereSolucion++;
    }
  });

  // 2. RADICACIÓN_LIVE Metrics
  const radLiveSheet = ss.getSheetByName(CONFIG.SHEETS.RADICACION_LIVE);
  const radLiveData = radLiveSheet.getDataRange().getValues().slice(1);
  let radicadosHoy = 0;
  let radicadosPorAsesor = {};

  radLiveData.forEach(row => {
    const fechaMarca = row[0];
    if (fechaMarca instanceof Date) {
      const fStr = Utilities.formatDate(fechaMarca, CONFIG.TIMEZONE, "dd/MM/yyyy");
      if (fStr === todayStr) radicadosHoy++;
    }
    const asesor = row[2]; // C
    if (asesor) {
      radicadosPorAsesor[asesor] = (radicadosPorAsesor[asesor] || 0) + 1;
    }
  });

  // 3. PQRSF_LIVE (PQRS hoy)
  const pqrsLiveSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_LIVE);
  const pqrsLiveData = pqrsLiveSheet.getDataRange().getValues().slice(1);
  let pqrsHoy = 0;
  pqrsLiveData.forEach(row => {
    const fechaMarca = row[0];
    if (fechaMarca instanceof Date) {
      const fStr = Utilities.formatDate(fechaMarca, CONFIG.TIMEZONE, "dd/MM/yyyy");
      if (fStr === todayStr) pqrsHoy++;
    }
  });

  // 4. PQRSF_DEVUELTOS (Errores)
  const devueltosSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_DEVUELTOS);
  const devueltosData = devueltosSheet.getDataRange().getValues().slice(1);
  let erroresTotales = devueltosData.length;
  let erroresPorAsesor = {};
  let motivosFrecuentes = {};

  devueltosData.forEach(row => {
    const asesor = row[0]; // A
    const motivo = row[2]; // C
    if (asesor) erroresPorAsesor[asesor] = (erroresPorAsesor[asesor] || 0) + 1;
    if (motivo) motivosFrecuentes[motivo] = (motivosFrecuentes[motivo] || 0) + 1;
  });

  // 5. BASE_METRICAS (For deep performance ranking)
  const baseMetricasSheet = ss.getSheetByName(CONFIG.SHEETS.BASE_METRICAS);
  const baseMetricasData = baseMetricasSheet.getDataRange().getValues().slice(1);
  let performanceMap = {};

  baseMetricasData.forEach(row => {
    const asesor = row[1]; // Funcionaria (B)
    if (!asesor) return;
    if (!performanceMap[asesor]) {
      performanceMap[asesor] = { pecSuma: 0, count: 0 };
    }
    // PEC is column F in most blocks, but let's assume a general structure or focus on Radicacion
    // Actually BASE_METRICAS has blocks. This is tricky.
    // Let's just use it to gather advisors names if they aren't in live sheets.
  });

  // Ranking calculation
  const allAsesores = new Set([...Object.keys(radicadosPorAsesor), ...Object.keys(erroresPorAsesor)]);
  let ranking = Array.from(allAsesores).map(name => {
    return {
      nombre: name,
      radicados: radicadosPorAsesor[name] || 0,
      errores: erroresPorAsesor[name] || 0,
      errorRate: radicadosPorAsesor[name] ? ((erroresPorAsesor[name] || 0) / radicadosPorAsesor[name] * 100).toFixed(1) : 0
    };
  }).sort((a, b) => b.radicados - a.radicados);

  return {
    metrics: {
      pqrsHoy,
      radicadosHoy,
      pendientes,
      errores: erroresTotales,
      efectividadPromedio: conteoEfectividad > 0 ? (sumaEfectividad / conteoEfectividad) * 100 : 0
    },
    pqrsfStats: {
      total: totalPQRS,
      comunicados,
      pendientes,
      canales,
      estados,
      requiereSolucion
    },
    ranking,
    motivosFrecuentes
  };
}

function searchRadicado(numero) {
  const ss = getSs();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RADICACION_LIVE);
  const data = sheet.getDataRange().getValues().slice(1);

  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][3]).trim() === String(numero).trim()) {
      return {
        funcionaria: data[i][2],
        fecha: data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss") : data[i][0],
        estado: data[i][4] || "Sin estado"
      };
    }
  }
  return null;
}

function searchPQRS(numero) {
  const ss = getSs();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_LIVE);
  const data = sheet.getDataRange().getValues().slice(1);

  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][2]).trim() === String(numero).trim()) {
      return {
        fecha: data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss") : data[i][0],
        agente: data[i][1],
        clasificacion: data[i][4],
        direccion: data[i][5]
      };
    }
  }
  return null;
}

function getTurnosData() {
  const ss = getSs();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.TURNOS);
  const data = sheet.getDataRange().getValues().slice(1);
  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "d/M/yyyy");
  const currentTime = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm");

  return data.filter(row => {
    const rowDate = row[4];
    let fStr = "";
    if (rowDate instanceof Date) {
      fStr = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "d/M/yyyy");
    } else {
      fStr = String(rowDate);
    }
    return fStr === todayStr;
  }).map(row => {
    const nombre = row[0];
    const horario = row[5];
    const almuerzo = row[6];
    const breakM = row[7];
    const breakT = row[8];

    let estado = "Fuera de turno";

    if (horario && horario.includes("-")) {
      const [start, end] = horario.split("-").map(t => t.trim());
      if (currentTime >= start && currentTime <= end) {
        estado = "En jornada";

        if (isTimeInRange(currentTime, almuerzo)) estado = "En almuerzo";
        else if (isTimeInRange(currentTime, breakM)) estado = "En break";
        else if (isTimeInRange(currentTime, breakT)) estado = "En break";
      }
    }

    return { nombre, estado, horario };
  });
}

function isTimeInRange(current, range) {
  if (!range || !range.toString().includes("-")) return false;
  const [start, end] = range.toString().split("-").map(t => t.trim());
  return current >= start && current <= end;
}
