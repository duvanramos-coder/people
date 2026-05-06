import os
import time
import re
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        # Manual combination for the sake of this verification script
        with open('Index.html', 'r') as f:
            content = f.read()

        # Replace includes with actual file content, handling potential spaces
        for filename in ['Styles', 'Login', 'Dashboard', 'AgentPortal', 'Scripts']:
            with open(f'{filename}.html', 'r') as f:
                file_content = f.read()
            # Use regex to find the include tag with any amount of whitespace
            pattern = re.compile(rf"<\?!= include\('{filename}'\);\s*\?>")
            content = pattern.sub(file_content, content)

        # Mock google.script.run and Session
        mock_script = """
        <script>
        window.google = {
            script: {
                run: {
                    withSuccessHandler: function() { return this; },
                    withFailureHandler: function() { return this; },
                    validarLogin: function() {},
                    getPQRSFData: function() {},
                    obtenerUsuarios: function() {},
                    registrarSesion: function() {},
                    eliminarSesion: function() {},
                    obtenerAgentesConectados: function() {},
                    obtenerActividadReciente: function() {},
                    obtenerAsignadosAsesor: function() {}
                }
            }
        };
        // Mock getScriptTimeZone for formatting
        window.Session = {
            getScriptTimeZone: function() { return "GMT-5"; }
        };
        </script>
        """
        content = content.replace('<head>', '<head>' + mock_script)

        with open('combined_preview.html', 'w') as f:
            f.write(content)

        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1440, "height": 900})

        # Open the combined file
        file_path = "file://" + os.path.abspath("combined_preview.html")
        page.goto(file_path)

        # Wait for everything to load
        time.sleep(3)

        # Take screenshot of Login
        page.screenshot(path="login_preview.png")
        print("Login screenshot saved.")

        # Simulate login as admin
        page.evaluate("""() => {
            if (typeof showView === 'function') {
                currentUser = { nombre: 'ADMIN_TEST', role: 'admin' };
                showView('adminView');
                allData = [
                    { id: 2, radicado: '123', nombre: 'JUAN PEREZ', empresa: 'COFREM', estado: 'Contactado', canal: 'Llamada', efectividad: 'Si', isManaged: true, recibidoPeople: '2025-01-01', fechaCofrem: '2025-01-01', asesor: 'ADMIN_TEST' },
                    { id: 3, radicado: '124', nombre: 'MARIA LOPEZ', empresa: 'PEOPLE BPO', estado: 'No contesta', canal: 'Llamada', efectividad: 'No', isManaged: true, recibidoPeople: '2025-01-01', fechaCofrem: '2025-01-01', asesor: 'ADMIN_TEST' }
                ];
                filteredData = [...allData];
                if (typeof updateAdminDashboard === 'function') {
                    updateAdminDashboard();
                }
            }
        }""")
        time.sleep(2)
        page.screenshot(path="admin_dashboard_preview.png")
        print("Admin Dashboard screenshot saved.")

        # Switch to Agent View
        page.evaluate("""() => {
            if (typeof showView === 'function') {
                currentUser = { nombre: 'AGENT_TEST', role: 'agent' };
                showView('agentView');
                activeCase = { radicado: 'RAD-TEST', nombre: 'JUAN PEREZ', telefono: '3001234567', empresa: 'PEOPLE BPO', fecha: '20/10/2025', rowId: 2 };
                showActiveCase();
            }
        }""")
        time.sleep(2)
        page.screenshot(path="agent_portal_preview.png")
        print("Agent Portal screenshot saved.")

        browser.close()

if __name__ == "__main__":
    run()
