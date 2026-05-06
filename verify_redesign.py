import os
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        # Load the mock index file
        # We need to simulate the GAS environment. Since we can't run GAS locally easily,
        # we'll use the combined file approach if available, or just inspect individual files.
        # However, the best way to verify is to combine them into one HTML.

        try:
            from combine_gas_files import combine_files
            combine_files('Index.html', 'combined_preview.html')
        except ImportError:
            # Manual combination for the sake of this verification script
            with open('Index.html', 'r') as f:
                content = f.read()

            # Replace includes with actual file content
            for filename in ['Styles', 'Login', 'Dashboard', 'AgentPortal', 'Scripts']:
                with open(f'{filename}.html', 'r') as f:
                    file_content = f.read()
                content = content.replace(f"<?!= include('{filename}'); ?>", file_content)

            with open('combined_preview.html', 'w') as f:
                f.write(content)

        browser = p.chromium.launch()
        page = browser.new_page()

        # Open the combined file
        file_path = "file://" + os.path.abspath("combined_preview.html")
        page.goto(file_path)

        # Take screenshot of Login
        page.screenshot(path="login_preview.png")
        print("Login screenshot saved.")

        # Simulate login as admin (we need to bypass the actual google.script.run)
        # We can do this by injecting a script that sets currentUser and shows the view
        page.evaluate("""
            currentUser = { nombre: 'ADMIN_TEST', role: 'admin' };
            showView('adminView');
            // Mock some data for charts
            filteredData = [
                { radicado: '123', nombre: 'Test', empresa: 'Co', estado: 'Contactado', canal: 'Llamada', efectividad: 'Si', isManaged: true, recibidoPeople: '2025-01-01' },
                { radicado: '124', nombre: 'Test 2', empresa: 'Co', estado: 'No contesta', canal: 'Llamada', efectividad: 'No', isManaged: true, recibidoPeople: '2025-01-01' }
            ];
            allData = filteredData;
            updateAdminDashboard();
        """)
        time.sleep(1) # Wait for animations/renders
        page.screenshot(path="admin_dashboard_preview.png")
        print("Admin Dashboard screenshot saved.")

        # Take screenshot of Agent Portal
        page.evaluate("""
            currentUser = { nombre: 'AGENT_TEST', role: 'agent' };
            showView('agentView');
            // Mock active case
            activeCase = { radicado: 'RAD-TEST', nombre: 'JUAN PEREZ', telefono: '3001234567', empresa: 'PEOPLE BPO', fecha: '20/10/2025', rowId: 2 };
            showActiveCase();
        """)
        time.sleep(1)
        page.screenshot(path="agent_portal_preview.png")
        print("Agent Portal screenshot saved.")

        browser.close()

if __name__ == "__main__":
    run()
