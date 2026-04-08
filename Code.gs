function doGet(e) {
  if (e.parameter.id) {
    const data = obtenerChat(e.parameter.id);
    const template = HtmlService.createTemplateFromFile('Index');
    template.sharedChatData = JSON.stringify(data);
    template.isShared = true;
    return template.evaluate()
      .setTitle('Chat Compartido')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.sharedChatData = "[]";
  template.isShared = false;
  return template.evaluate()
    .setTitle('Chat de Atención - AWS Transcript')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

// 🔹 Convertir JSON AWS a chat
function procesarJSON(contenido) {
  try {
    const data = JSON.parse(contenido);
    let chat = [];

    if (!data.Transcript) return [];

    data.Transcript.forEach(item => {
      if (item.Type === "MESSAGE" && item.Content) {
        let rol = item.ParticipantRole;
        let mensaje = item.Content.replace(/\n/g, "<br>");

        if (rol === "CUSTOMER") {
          chat.push({ tipo: "cliente", nombre: "Cliente", mensaje });
        } else if (rol === "AGENT") {
          chat.push({ tipo: "asesora", nombre: "Asesora", mensaje });
        }
      }
    });

    return chat;
  } catch (e) {
    return [];
  }
}

// 🔹 Guardar chat y generar ID
function guardarChat(chat) {
  const id = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(id, JSON.stringify(chat));
  return id;
}

// 🔹 Obtener chat por ID
function obtenerChat(id) {
  const data = PropertiesService.getScriptProperties().getProperty(id);
  return data ? JSON.parse(data) : [];
}
