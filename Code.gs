function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dashboard PQRSF | People BPO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Fetches data from the PQRSF sheet
 * Spreadsheet ID: 148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w
 */
function getPQRSFData() {
  try {
    const CONFIG = {
      SPREADSHEET_ID: '148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w',
      SHEET_NAME: 'PQRSF'
    };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error('Hoja "PQRSF" no encontrada.');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // No data or only headers

    const headers = data[0];
    const rows = data.slice(1);

    // Column Mappings (0-indexed)
    // B -> 1, C -> 2, D -> 3, F -> 5, G -> 6, H -> 7, I -> 8, J -> 9, K -> 10, L -> 11, M -> 12, N -> 13

    return rows.map((row, index) => {
      // Helper to format date if it's a Date object
      const formatDate = (val) => {
        if (val instanceof Date) {
          return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        return val;
      };

      const estado = row[9] ? row[9].toString().trim() : "";
      const canal = row[10] ? row[10].toString().trim() : "";
      const efectividad = row[11] ? row[11].toString().trim() : "";

      const isManaged = estado !== "" && canal !== "" && efectividad !== "";

      return {
        id: index + 2, // Row number in sheet
        asesor: row[0] ? row[0].toString().trim() : "Sin asignar",
        recibidoPeople: formatDate(row[1]),
        radicado: row[2] ? row[2].toString().trim() : "",
        fechaCofrem: formatDate(row[3]),
        nombre: row[5] ? row[5].toString().trim() : "",
        telefono: row[6] ? row[6].toString().trim() : "",
        correo: row[7] ? row[7].toString().trim() : "",
        empresa: row[8] ? row[8].toString().trim() : "",
        estado: estado,
        canal: canal,
        efectividad: efectividad,
        requiereOtraSolucion: row[12] ? row[12].toString().trim() : "",
        seEncontroPqrs: row[13] ? row[13].toString().trim() : "",
        isManaged: isManaged
      };
    }).filter(item => item.radicado !== ""); // Ensure we have a radicado

  } catch (error) {
    Logger.log('Error fetching data: ' + error.message);
    throw new Error('Error al cargar datos: ' + error.message);
  }
}

/**
 * Sends an email report with a PDF attachment
 */
function sendEmailReport(toEmail, reportData, reportDate) {
  try {
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #3b3561; padding: 20px; color: white;">
          <h2 style="margin: 0; font-size: 18px;">Reporte diario de radicaciones y PQRSF – People BPO</h2>
        </div>
        <div style="padding: 30px; color: #1e293b; line-height: 1.6;">
          <p>Hola,</p>
          <p>Te comparto el <b>reporte diario de radicaciones y PQRSF del equipo</b> correspondiente al día <b>${reportDate}</b>.</p>
          <p>En el archivo adjunto encontrarás el <b>consolidado</b> con el detalle de las gestiones realizadas durante la jornada.</p>
          <p>Cualquier observación o ajuste que requieras, quedo atento.</p>
          <p style="margin-top: 30px;">Cordialmente,<br>
          <b>Duván Ramos</b><br>
          Coordinador de Formación y Calidad<br>
          People BPO</p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
          Envío automático desde el sistema de seguimiento operativo.
        </div>
      </div>
    `;

    // Generate PDF content
    const pdfHtml = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; color: #333; }
            h1 { color: #3b3561; border-bottom: 2px solid #b7d400; padding-bottom: 10px; }
            .kpi-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .kpi-table th, .kpi-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .kpi-table th { background-color: #f4f4f4; }
            .summary-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Consolidado PQRSF - ${reportDate}</h1>
          <div class="summary-box">
            <p><b>Total PQRSF:</b> ${reportData.total}</p>
            <p><b>Gestionados:</b> ${reportData.managed} (${reportData.managedPerc}%)</p>
            <p><b>Pendientes:</b> ${reportData.pending} (${reportData.pendingPerc}%)</p>
            <p><b>Efectividad:</b> ${reportData.effectivenessPerc}%</p>
          </div>
          <h3>Métricas por Canal</h3>
          <table class="kpi-table">
            <thead><tr><th>Canal</th><th>Casos</th></tr></thead>
            <tbody>
              ${Object.entries(reportData.channels).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
            </tbody>
          </table>
          <h3>Métricas por Estado</h3>
          <table class="kpi-table">
            <thead><tr><th>Estado</th><th>Casos</th></tr></thead>
            <tbody>
              ${Object.entries(reportData.status).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
            </tbody>
          </table>
          <p style="font-size: 10px; color: #777; margin-top: 30px;">Generado automáticamente por GESTIONES PQRSF (People BPO)</p>
        </body>
      </html>
    `;

    const blob = Utilities.newBlob(pdfHtml, 'text/html', 'reporte.html');
    const pdf = blob.getAs('application/pdf').setName(`Reporte_PQRSF_${reportDate.replace(/\//g, '-')}.pdf`);

    MailApp.sendEmail({
      to: toEmail,
      subject: `Reporte diario de radicaciones y PQRSF – ${reportDate}`,
      htmlBody: htmlBody,
      attachments: [pdf]
    });

    return "OK";
  } catch (error) {
    Logger.log('Error sending email: ' + error.message);
    throw new Error('Error al enviar el reporte: ' + error.message);
  }
}
