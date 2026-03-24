function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('REGISTRA TU PQRSF REALIZADO');
}

function guardarPQRSF(datos) {

  const spreadsheetId = "148Py5yyJ1ucYF26fD2zs9g-aQgD77I_C-betaSOha7w";
  const hoja = SpreadsheetApp.openById(spreadsheetId)
  .getSheetByName("PQRSF Creados");

  const radicadoNuevo = datos.radicado;
  const ultimaFila = hoja.getLastRow();

  if (ultimaFila > 1) {

    const radicados = hoja.getRange(2,3,ultimaFila-1,1).getValues();

    for (let i = 0; i < radicados.length; i++) {

      if (radicados[i][0] == radicadoNuevo) {

        const agenteExistente = hoja.getRange(i+2,2).getValue();

        return {
          estado:"duplicado",
          agente:agenteExistente
        };

      }

    }

  }

  hoja.appendRow([
    new Date(),
    datos.agente,
    datos.radicado,
    datos.caso,
    datos.clasificacion,
    datos.dirige
  ]);

  return {
    estado:"ok"
  };

}
