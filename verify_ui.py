import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})

        # Read files
        with open('Index.html', 'r') as f:
            index_html = f.read()
        with open('Styles.html', 'r') as f:
            styles_html = f.read()
        with open('Scripts.html', 'r') as f:
            scripts_html = f.read()

        # Combine
        full_html = index_html.replace("<?!= include('Styles'); ?>", styles_html)
        full_html = full_html.replace("<?!= include('Scripts'); ?>", scripts_html)

        # Mock google.script.run
        mock_script = """
        <script>
        window.google = {
          script: {
            run: {
              withSuccessHandler: function(handler) {
                return {
                  iniciarSesion: function(e, p) {
                    setTimeout(() => handler({success: true, email: 'test@test.com'}), 100);
                  },
                  obtenerDatosCompletos: function(email) {
                    setTimeout(() => handler({
                      nombre: 'DUVANSITO',
                      email: 'test@test.com',
                      asignadosCursos: ['MOD1', 'MOD2'],
                      asignadosSims: [],
                      todosLosCursos: [
                        {ID_MODULO: 'MOD1', TITULO: 'Servicio al Cliente Pro', URL_IMAGEN: 'https://via.placeholder.com/300x200', CONTENIDO_TEXTO: 'Aprende las mejores técnicas de servicio.', URL_VIDEO: 'about:blank'},
                        {ID_MODULO: 'MOD2', TITULO: 'Gestión de Quejas', URL_IMAGEN: 'https://via.placeholder.com/300x200', CONTENIDO_TEXTO: 'Cómo manejar clientes difíciles.', URL_VIDEO: 'about:blank'}
                      ],
                      todasLasSims: [],
                      historial: [
                        {idItem: 'MOD1', fecha: '2023-10-27 10:00:00', nota: 0.85}
                      ]
                    }), 100);
                  },
                  obtenerPreguntas: function(id) {
                    setTimeout(() => handler([
                      {PREGUNTA: '¿Cuál es la regla de oro?', OPCION_A: 'El cliente siempre tiene la razón', OPCION_B: 'Escucha activa', OPCION_C: 'Rapidez', OPCION_D: 'Ninguna', RESPUESTA_CORRECTA: 'B'},
                      {PREGUNTA: '¿Qué hacer ante una queja?', OPCION_A: 'Ignorar', OPCION_B: 'Discutir', OPCION_C: 'Empatizar', OPCION_D: 'Colgar', RESPUESTA_CORRECTA: 'C'}
                    ]), 100);
                  },
                  guardarResultado: function(email, id, nota) {
                    setTimeout(() => handler(true), 100);
                  }
                };
              }
            }
          }
        };
        </script>
        """
        full_html = full_html.replace("<head>", "<head>" + mock_script)

        await page.set_content(full_html)

        # 1. Login
        await page.fill('#loginEmail', 'test@test.com')
        await page.fill('#loginPass', '1234')
        await page.click('#btnLogin')
        await page.wait_for_selector('#vistaDashboard', state='visible')

        # 2. Open Module MOD2 (not completed)
        await page.click('text=Gestión de Quejas')
        await page.wait_for_selector('#vistaModulo', state='visible')
        await page.screenshot(path='screenshot_module_view.png')

        # 3. Start Quiz
        await page.click('#btnRealizarEvaluacion')
        await page.wait_for_selector('#vistaExamen', state='visible')
        # Wait for the animation
        await asyncio.sleep(1)
        await page.screenshot(path='screenshot_quiz_view.png')

        # 4. Answer first question
        await page.click('text=Escucha activa')
        await page.click('#btnSiguiente')
        await asyncio.sleep(0.5)
        await page.screenshot(path='screenshot_quiz_question2.png')

        await browser.close()

asyncio.run(run())
