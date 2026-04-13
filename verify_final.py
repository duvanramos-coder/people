import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()

        with open('Index.html', 'r') as f:
            html_content = f.read()

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
                setTimeout(() => this.successHandler(['Angi Johana Banda Montes', 'Slendy Lizzeth Pico Garcia']), 100);
                return this;
              },
              getHistorial: function() {
                setTimeout(() => this.successHandler([{fecha: '13/04/2026 10:00', radicado: 'PQ-TEST-001'}]), 100);
                return this;
              },
              getNotificaciones: function() {
                setTimeout(() => this.successHandler([]), 100);
                return this;
              },
              getMensajes: function() {
                setTimeout(() => this.successHandler([]), 100);
                return this;
              }
            }
          }
        };
        """

        await page.set_content(f"<script>{mock_script}</script>{html_content}")
        await page.wait_for_selector('#login-agente option[value="Angi Johana Banda Montes"]')

        # Take login shot
        await page.screenshot(path='final_login.png')

        # Login
        await page.select_option('#login-agente', 'Angi Johana Banda Montes')
        await page.click('button:has-text("Autenticar")')

        # Wait for dashboard transition
        await page.wait_for_selector('#main-app', state='visible')
        await page.wait_for_timeout(1000) # Wait for animations

        # Take dashboard shot
        await page.screenshot(path='final_dashboard.png')

        await browser.close()

asyncio.run(run())
