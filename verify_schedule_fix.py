import asyncio
from playwright.async_api import async_playwright
import os

async def verify_schedule_fix():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})

        mock_script = """
        window.google = {
            script: {
                run: {
                    withSuccessHandler: function(callback) {
                        this.successHandler = callback;
                        return this;
                    },
                    withFailureHandler: function(callback) {
                        this.failureHandler = callback;
                        return this;
                    },
                    getAgentes: function() {
                        setTimeout(() => this.successHandler(['Angi Johana Banda Montes', 'Slendy Lizzeth Pico Garcia']), 10);
                    },
                    getHistorial: function() {
                        setTimeout(() => this.successHandler({historial: [], hoy: 0}), 10);
                    },
                    getNotificaciones: function() {
                        setTimeout(() => this.successHandler([]), 10);
                    },
                    getMensajes: function() {
                        setTimeout(() => this.successHandler([]), 10);
                    },
                    obtenerHorarioHoy: function(name) {
                        setTimeout(() => this.successHandler({
                            jornada: '7:00am a 5:00pm',
                            almuerzo: '12:00pm a 1:00pm',
                            break1: '9:00am a 9:30am',
                            break2: '3:00pm a 3:30pm'
                        }), 10);
                    },
                    verificarHorarios: function() {}
                }
            }
        };
        """

        await context.add_init_script(mock_script)
        page = await context.new_page()

        await page.goto(f"file://{os.getcwd()}/Index.html")

        # Select option despite being "hidden" by the nature of <select>
        await page.select_option('#login-agente', 'Angi Johana Banda Montes')
        await page.click('button:has-text("Autenticar y Entrar")')

        # Wait for the schedule widget to update from "Sincronizando..."
        try:
            # Check for multiple possible success statuses
            await page.wait_for_function(
                "['🟢 En jornada', '🟡 En break', '🟠 En almuerzo', '🔴 Fuera de turno', 'Horario no asignado'].includes(document.getElementById('status-text').textContent)",
                timeout=10000
            )
            print("Schedule widget updated successfully.")
        except Exception as e:
            text = await page.inner_text('#status-text')
            print(f"Schedule widget stuck at status: '{text}'")
            await page.screenshot(path="debug_schedule_stuck.png")
            await browser.close()
            return

        status = await page.inner_text('#status-text')
        jornada = await page.inner_text('#sched-jornada')

        print(f"Status detected: {status}")
        print(f"Jornada detected: {jornada}")

        await page.screenshot(path="schedule_fixed.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_schedule_fix())
