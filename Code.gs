function doGet() {
  return HtmlService.createHtmlOutputFromFile("index");
}


/* ===================== */
/* OBTENER USUARIOS */
/* ===================== */

function obtenerUsuarios(){

const ss = SpreadsheetApp.openById("1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU");
const sheet = ss.getSheetByName("Funcionarios");

const data = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();

return data.flat();

}



/* ===================== */
/* LOGIN */
/* ===================== */

function login(usuario,password){

const ss = SpreadsheetApp.openById("1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU");

const sheetUsers = ss.getSheetByName("Funcionarios");
const users = sheetUsers.getDataRange().getValues();

for(let i=1;i<users.length;i++){

let asesor = users[i][0];
let pass = users[i][3];
let nombre = users[i][4];

if(usuario == asesor && password == pass){

let datos = obtenerMetricas(asesor);
datos.nombre = nombre;
return datos;

}

}

return "ERROR";

}



/* ===================== */
/* MÉTRICAS DASHBOARD */
/* ===================== */

function obtenerMetricas(asesor){

const ss = SpreadsheetApp.openById("1-q8bNXPWWRRe19vfcJgIFOQGzZSW1a8WbNFgjasECMU");
const sheet = ss.getSheetByName("Base");

const data = sheet.getDataRange().getValues();

/* ===================== */
/* OBTENER BONO GANADO */
/* ===================== */

let bonoGanado = 0;
Logger.log(ss.getSheets().map(s => s.getName()));
try {

  const sheetTO = ss.getSheetByName("TO");
  const dataTO = sheetTO.getDataRange().getValues();

  const asesorSearch = (asesor || "").toString().trim().toUpperCase();

  for (let i = 0; i < dataTO.length; i++) {

    let usuario = (dataTO[i][0] || "").toString().trim().toUpperCase();
    let bono = dataTO[i][9];

    Logger.log("Usuario hoja: " + usuario);
    Logger.log("Buscando: " + asesorSearch);

    if (usuario === asesorSearch) {

      Logger.log("BONO ENCONTRADO: " + bono);

      if (typeof bono === "string") {
        bono = bono.replace(/[^\d]/g, "");
      }

      bonoGanado = Number(bono) || 0;
      break;

    }

  }

} catch (e) {
  Logger.log("ERROR BONO: " + e);
}

/* ===================== */
/* DATOS TABLA EVALUACIONES */
/* ===================== */

const sheetFuncionarios = ss.getSheetByName("Funcionarios");
const funcionariosData = sheetFuncionarios.getDataRange().getValues();
let tablaData = [];

for(let i = 1; i < funcionariosData.length; i++){
  if(funcionariosData[i][0] == asesor){
    let fecha = funcionariosData[i][5];
    if(fecha instanceof Date){
      fecha = Utilities.formatDate(fecha, ss.getSpreadsheetTimeZone(), "dd-MM-yyyy");
    }

    tablaData.push({
      fecha: fecha,
      positivos: funcionariosData[i][6],
      mejora: funcionariosData[i][7],
      link: funcionariosData[i][8]
    });
  }
}

let asesores=[]
let notaPEC=0
let notaPENC=0
let auditorias=0

let pqrsfCreados=0
let pqrsfDevueltos=0

let sncRecibidos=0
let sncSolucionado=0
let rankingSNC=0

const asesorBuscado = (asesor || "").toString().trim().toUpperCase();

/* ===================== */
/* RANKING AUDITORIA */
/* ===================== */

for(let i=1;i<data.length;i++){

if(data[i][8]){

let pec=parseFloat(data[i][9])
let penc=parseFloat(data[i][10])

if(!isNaN(penc)){

asesores.push({
nombre:data[i][8],
pec:pec,
penc:penc
})

}

}

}

for(let i=1;i<data.length;i++){

if(data[i][12]){

let pec=parseFloat(data[i][13])
let penc=parseFloat(data[i][14])

if(!isNaN(penc)){

asesores.push({
nombre:data[i][12],
pec:pec,
penc:penc
})

}

}

}



/* ===================== */
/* NOTA ASESOR */
/* ===================== */

asesores.forEach(a=>{

if((a.nombre || "").toString().trim().toUpperCase() == asesorBuscado){

notaPEC=a.pec
notaPENC=a.penc

}

})



/* ===================== */
/* ORDENAR RANKING */
/* ===================== */

asesores.sort((a,b)=>b.penc-a.penc)

let ranking=0

for(let i=0;i<asesores.length;i++){

if((asesores[i].nombre || "").toString().trim().toUpperCase() == asesorBuscado){

ranking=i+1

}

}



/* ===================== */
/* PROMEDIO EQUIPO */
/* ===================== */

let suma=0
let contador=0

asesores.forEach(a=>{

if(!isNaN(a.penc)){

suma+=a.penc
contador++

}

})

let promedio=0

if(contador>0){

promedio=suma/contador

}



/* ===================== */
/* AUDITORIAS */
/* ===================== */

for(let i=1;i<data.length;i++){

let usuarioAuditoria = (data[i][10] || "").toString().trim().toUpperCase();

if(usuarioAuditoria == asesorBuscado){

auditorias = data[i][11]
break

}

}



/* ===================== */
/* PQRSF */
/* ===================== */

for(let i=1;i<data.length;i++){

let usuarioDash = (data[i][23] || "").toString().trim().toUpperCase();
let devueltos = data[i][24];
let creados = data[i][25];

if(usuarioDash == asesorBuscado){

pqrsfDevueltos = Number(devueltos) || 0
pqrsfCreados = Number(creados) || 0

break

}

}



/* ===================== */
/* METRICAS SNC */
/* ===================== */

let asesorasEspeciales=[
"J.MENDOZA382",
"L.BUITRAGO104",
"M.ARAGONES300"
]

if(asesorasEspeciales.includes(asesorBuscado)){

for(let i=1;i<data.length;i++){

let usuarioDash = (data[i][24] || "").toString().trim().toUpperCase();

if(usuarioDash == asesorBuscado){

sncRecibidos=Number(data[i][26])||0
pqrsfCreados=Number(data[i][27])||0
pqrsfDevueltos=Number(data[i][28])||0
sncSolucionado=Number(data[i][29])||0

break

}

}

/* ranking basado en SNC */

let rankingList=[]

for(let i=1;i<data.length;i++){

let usuarioDash = (data[i][24] || "").toString().trim().toUpperCase();
let snc=Number(data[i][26])||0

if(usuarioDash){

rankingList.push({
usuario:usuarioDash,
snc:snc
})

}

}

rankingList.sort((a,b)=>b.snc-a.snc)

for(let i=0;i<rankingList.length;i++){

if(rankingList[i].usuario == asesorBuscado){

rankingSNC=i+1

}

}

}



return{

asesor:asesor,
pec:notaPEC,
penc:notaPENC,
promedio:promedio,
ranking:ranking,
auditorias:auditorias,
pqrsfCreados:pqrsfCreados,
pqrsfDevueltos:pqrsfDevueltos,
sncRecibidos:sncRecibidos,
sncSolucionado:sncSolucionado,
rankingSNC:rankingSNC,
tablaData: tablaData,
bonoGanado: bonoGanado

}

}
