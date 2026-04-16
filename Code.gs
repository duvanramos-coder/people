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
    .setTitle('People BPO | Admin Dashboard')
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
    if (String(data[i][0]).trim() === String(username).trim() && String(data[i][1]) === String(password)) {
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

  // Historical context for trends (last 7 days average)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = Utilities.formatDate(yesterday, CONFIG.TIMEZONE, "dd/MM/yyyy");

  // 1. PQRSF_COMUNICADOS (Main DB)
  const pqrsfComunicadosSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_COMUNICADOS);
  const pqrsfData = pqrsfComunicadosSheet.getDataRange().getValues().slice(1);

  let totalPQRS = 0;
  let comunicados = 0;
  let pendientes = 0;
  let sumaEfectividad = 0;
  let conteoEfectividad = 0;
  let canales = {};
  let estados = {};

  pqrsfData.forEach(row => {
    const estado = row[8]; // I
    const nombre = row[4]; // E
    const tel = row[5];    // F
    const correo = row[6]; // G
    const empresa = row[7]; // H
    const canal = row[9];  // J
    const efectividad = parseFloat(row[10]) || 0;

    let valuable = false;
    if (estado) {
      comunicados++;
      valuable = true;
    } else if (nombre || tel || correo || empresa) {
      pendientes++;
      valuable = true;
    }

    if (valuable) {
      totalPQRS++;
      if (canal) canales[canal] = (canales[canal] || 0) + 1;
      if (estado) estados[estado] = (estados[estado] || 0) + 1;
      if (row[10] !== "" && !isNaN(efectividad)) {
        sumaEfectividad += efectividad;
        conteoEfectividad++;
      }
    }
  });

  // 2. RADICACIÓN_LIVE & PQRSF_LIVE (Daily Performance)
  const radLiveSheet = ss.getSheetByName(CONFIG.SHEETS.RADICACION_LIVE);
  const radLiveData = radLiveSheet.getDataRange().getValues().slice(1);

  const pqrsLiveSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_LIVE);
  const pqrsLiveData = pqrsLiveSheet.getDataRange().getValues().slice(1);

  let radHoy = 0, radAyer = 0;
  let pqrsHoy = 0, pqrsAyer = 0;
  let radPorAsesor = {};

  radLiveData.forEach(row => {
    if (!(row[0] instanceof Date)) return;
    const fStr = Utilities.formatDate(row[0], CONFIG.TIMEZONE, "dd/MM/yyyy");
    if (fStr === todayStr) radHoy++;
    else if (fStr === yesterdayStr) radAyer++;

    const asesor = row[2];
    if (asesor) radPorAsesor[asesor] = (radPorAsesor[asesor] || 0) + 1;
  });

  pqrsLiveData.forEach(row => {
    if (!(row[0] instanceof Date)) return;
    const fStr = Utilities.formatDate(row[0], CONFIG.TIMEZONE, "dd/MM/yyyy");
    if (fStr === todayStr) pqrsHoy++;
    else if (fStr === yesterdayStr) pqrsAyer++;
  });

  // 3. PQRSF_DEVUELTOS (Errors)
  const devueltosSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_DEVUELTOS);
  const devueltosData = devueltosSheet.getDataRange().getValues().slice(1);
  let erroresPorAsesor = {};
  devueltosData.forEach(row => {
    const asesor = row[0];
    if (asesor) erroresPorAsesor[asesor] = (erroresPorAsesor[asesor] || 0) + 1;
  });

  // 4. INSIGHTS GENERATOR (MANDATORY)
  let insights = [];
  if (pendientes > 10) insights.push({ type: 'warning', text: '⚠️ Alto volumen de PQRS pendientes (' + pendientes + ')' });
  if (pqrsHoy > pqrsAyer && pqrsAyer > 0) insights.push({ type: 'info', text: '📈 Incremento en PQRS recibidos hoy vs ayer' });

  // Find top performer
  let topAsesor = "";
  let maxRad = 0;
  for (let a in radPorAsesor) {
    if (radPorAsesor[a] > maxRad) {
      maxRad = radPorAsesor[a];
      topAsesor = a;
    }
  }
  if (topAsesor) insights.push({ type: 'success', text: '🔥 ' + topAsesor + ' es top performer hoy (' + maxRad + ' radicados)' });

  // 5. RANKING DINÁMICO
  const allAsesores = new Set([...Object.keys(radPorAsesor), ...Object.keys(erroresPorAsesor)]);
  let ranking = Array.from(allAsesores).map(name => {
    const r = radPorAsesor[name] || 0;
    const e = erroresPorAsesor[name] || 0;
    return {
      nombre: name,
      radicados: r,
      errores: e,
      errorRate: r > 0 ? ((e / r) * 100).toFixed(1) : 0
    };
  }).sort((a, b) => b.radicados - a.radicados);

  // Worst performers (highest error rate with at least some volume)
  let worstPerformers = [...ranking]
    .filter(a => a.radicados > 5)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 3);

  return {
    kpis: {
      pqrsHoy: { value: pqrsHoy, trend: calculateTrend(pqrsHoy, pqrsAyer) },
      radicadosHoy: { value: radHoy, trend: calculateTrend(radHoy, radAyer) },
      pendientes: { value: pendientes },
      errores: { value: devueltosData.length },
      efectividad: { value: (conteoEfectividad > 0 ? (sumaEfectividad / conteoEfectividad) * 100 : 0).toFixed(1) }
    },
    insights,
    ranking,
    worstPerformers,
    stats: { canales, estados }
  };
}

function calculateTrend(now, prev) {
  if (prev === 0) return now > 0 ? 100 : 0;
  return (((now - prev) / prev) * 100).toFixed(1);
}

function searchGlobal(numero) {
  const ss = getSs();

  // Try RADICACION_LIVE first
  const radSheet = ss.getSheetByName(CONFIG.SHEETS.RADICACION_LIVE);
  const radData = radSheet.getDataRange().getValues().slice(1);
  for (let i = radData.length - 1; i >= 0; i--) {
    if (String(radData[i][3]).trim() === String(numero).trim()) {
      return {
        type: 'Radicado',
        data: {
          'Número': radData[i][3],
          'Funcionaria': radData[i][2],
          'Fecha': radData[i][0] instanceof Date ? Utilities.formatDate(radData[i][0], CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm") : radData[i][0],
          'Estado': radData[i][4] || 'Pendiente',
          'SNC': radData[i][6] || 'No'
        }
      };
    }
  }

  // Try PQRSF_LIVE
  const pqrsSheet = ss.getSheetByName(CONFIG.SHEETS.PQRSF_LIVE);
  const pqrsData = pqrsSheet.getDataRange().getValues().slice(1);
  for (let i = pqrsData.length - 1; i >= 0; i--) {
    if (String(pqrsData[i][2]).trim() === String(numero).trim()) {
      return {
        type: 'PQRSF',
        data: {
          'Número': pqrsData[i][2],
          'Agente': pqrsData[i][1],
          'Fecha': pqrsData[i][0] instanceof Date ? Utilities.formatDate(pqrsData[i][0], CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm") : pqrsData[i][0],
          'Clasificación': pqrsData[i][4],
          'Área': pqrsData[i][5]
        }
      };
    }
  }

  return null;
}

function getTurnosStatus() {
  const ss = getSs();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.TURNOS);
  const data = sheet.getDataRange().getValues().slice(1);
  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "d/M/yyyy");
  const currentTime = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm");

  return data.filter(row => {
    const rDate = row[4];
    const fStr = (rDate instanceof Date) ? Utilities.formatDate(rDate, CONFIG.TIMEZONE, "d/M/yyyy") : String(rDate);
    return fStr === todayStr;
  }).map(row => {
    const nombre = row[0];
    const horario = row[5];
    const almuerzo = row[6];
    const breakM = row[7];
    const breakT = row[8];

    let status = "🔴 Fuera";
    let color = "#ef4444";

    if (horario && horario.includes("-")) {
      const [start, end] = horario.split("-").map(t => t.trim());
      if (currentTime >= start && currentTime <= end) {
        status = "🟢 Activo";
        color = "#22c55e";

        if (isTimeInRange(currentTime, almuerzo)) { status = "🔵 Almuerzo"; color = "#3b82f6"; }
        else if (isTimeInRange(currentTime, breakM) || isTimeInRange(currentTime, breakT)) { status = "🟡 Break"; color = "#eab308"; }
      }
    }
    return { nombre, status, color, horario: horario || 'Sin turno' };
  });
}

function isTimeInRange(current, range) {
  if (!range || !range.toString().includes("-")) return false;
  const [start, end] = range.toString().split("-").map(t => t.trim());
  return current >= start && current <= end;
}
