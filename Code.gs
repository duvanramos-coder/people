function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Radicación - Gestiones');
}


function guardarRadicacion(data) {

  const SHEET_ID = '1C4f1DBu2VW9fJPISnzH0icsELR3146gIS3c-rKG5Vtg';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('GESTIONES');

  if (!sh) {
    throw new Error('No existe la hoja GESTIONES');
  }

  if (data.radicado) {

    const valores = sh.getRange("C2:D" + sh.getLastRow()).getValues();

    for (let i = 0; i < valores.length; i++) {

      const funcionaria = valores[i][0];
      const radicado = valores[i][1];

      if (String(radicado).trim() === String(data.radicado).trim()) {

        throw new Error("Radicado ya registrado por " + funcionaria);

      }

    }

  }

  const fila = [
    new Date(),
    '',
    data.funcionaria || '',
    data.radicado || '',
    data.devuelto || '',
    data.observacion || '',
    data.recibidoHoy ? 'SI' : '',
    data.solucionadoHoy ? 'SI' : '',
    data.pqrsf ? 'SI' : ''
  ];

  sh.appendRow(fila);

  return true;
}
