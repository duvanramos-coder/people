# Sistema de Turnos - Virtual Ramos

Web App desarrollada con Google Apps Script para la gestión y visualización de turnos de agentes.

## 🚀 Instrucciones de Despliegue

Sigue estos pasos para poner en marcha la aplicación:

1.  **Crear un nuevo proyecto de Google Apps Script:**
    *   Ve a [script.google.com](https://script.google.com/).
    *   Haz clic en "Nuevo proyecto".
    *   Dale un nombre al proyecto (ej: "Sistema de Turnos").

2.  **Copiar los archivos del repositorio:**
    *   Crea un archivo llamado `Code.gs` y pega el contenido de `Code.gs`.
    *   Crea un archivo de HTML llamado `index.html` y pega el contenido de `index.html`.
    *   Crea un archivo de HTML llamado `dashboard.html` y pega el contenido de `dashboard.html`.

3.  **Configurar el ID de la Hoja de Cálculo:**
    *   Asegúrate de que la variable `SPREADSHEET_ID` en `Code.gs` coincida con el ID de tu hoja de cálculo: `1WJpdXTfiwdtof5l7Twb8LqbNWZ9sfAzD-IJeWCmU5zw`.

4.  **Implementar como Web App:**
    *   Haz clic en el botón azul "Implementar" > "Nueva implementación".
    *   Selecciona "Tipo": "Aplicación web".
    *   **Descripción:** "Versión inicial".
    *   **Ejecutar como:** "Yo" (tu cuenta).
    *   **Quién tiene acceso:** "Cualquier persona" (recomendado para este tipo de herramientas internas).
    *   Haz clic en "Implementar".

5.  **Autorizar el Script:**
    *   Se te pedirá que autorices el acceso a la hoja de cálculo.
    *   Haz clic en "Autorizar acceso", selecciona tu cuenta y otorga los permisos necesarios.

6.  **Obtener la URL:**
    *   Una vez completada la implementación, copia la URL de la aplicación web. ¡Esa es tu herramienta lista para usar!

## 📄 Estructura de Datos (Google Sheets)

La aplicación depende de dos hojas principales:

*   **Agentes:** Columnas A (Asesor), B (Nombre), C (Contraseña), D (Canal).
*   **Turnos:** Columnas A-K con datos de turnos y Columna L (Usuario/Asesor) para el filtrado.

---
**By Duvan Ramos**
