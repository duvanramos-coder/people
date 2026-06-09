import os

def read_file(filepath):
    with open(filepath, 'r') as f:
        return f.read()

styles = read_file('Styles.html')
login = read_file('Login.html')
dashboard = read_file('Dashboard.html')
agentportal = read_file('AgentPortal.html')
scripts = read_file('Scripts.html').replace('google.script.run', 'window.google.script.run')

html_template = f"""<!DOCTYPE html>
<html>
<head>
    <base target="_top">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    {styles}
</head>
<body>
    <div id="mainApp">
        <div id="loginView" class="view-container">
            {login}
        </div>
        <div id="adminView" class="view-container" style="display: none;">
            {dashboard}
        </div>
        <div id="agentView" class="view-container" style="display: none;">
            {agentportal}
        </div>
    </div>

    <!-- Modals -->
    <div id="adminEditModal" class="modal-overlay" style="display: none;">
      <div class="modal-content glass">
        <div class="modal-header">
          <h3><i data-lucide="edit-3"></i> Editar Comunicación</h3>
          <button class="btn-close-modal" onclick="cerrarModalAdmin()"><i data-lucide="x"></i></button>
        </div>
        <div id="adminEditModalBody" class="modal-body">
        </div>
      </div>
    </div>
    <div id="notificationModal" class="modal-overlay" style="display: none;">
      <div class="notification-card glass">
        <div id="notifIcon" class="notif-icon"></div>
        <h2 id="notifTitle" class="notif-title">Título</h2>
        <p id="notifMessage" class="notif-message">Mensaje breve explicativo.</p>
        <button class="btn-notif-action" onclick="closeNotification()">Continuar</button>
      </div>
    </div>

    <script>
        // Mock google.script.run
        window.google = {{
            script: {{
                run: {{
                    withSuccessHandler: function(callback) {{
                        this.successHandler = callback;
                        return this;
                    }},
                    withFailureHandler: function(fail) {{
                        this.failureHandler = fail;
                        return this;
                    }},
                    obtenerUsuarios: function() {{
                        setTimeout(() => {{
                            if (this.successHandler) this.successHandler([{{nombre: 'Duvan Ramos'}}]);
                        }}, 10);
                        return this;
                    }},
                    validarLogin: function(u, p) {{
                        setTimeout(() => {{
                            if (this.successHandler) this.successHandler({{success: true, nombre: 'Duvan Ramos', role: 'agent'}});
                        }}, 10);
                        return this;
                    }},
                    getPQRSFData: function() {{
                        setTimeout(() => {{
                            if (this.successHandler) this.successHandler([]);
                        }}, 10);
                        return this;
                    }},
                    claimNextCase: function(u) {{
                        setTimeout(() => {{
                            if (this.successHandler) this.successHandler({{
                                success: true,
                                data: {{
                                    rowId: 5,
                                    radicado: '12345',
                                    nombre: 'Usuario Test',
                                    telefono: '5551234',
                                    empresa: 'Empresa Test',
                                    fecha: '20/05/2026'
                                }}
                            }});
                        }}, 10);
                        return this;
                    }},
                    generarRespuestaIA: function(prompt, metadata) {{
                        setTimeout(() => {{
                            if (this.successHandler) this.successHandler({{
                                success: true,
                                text: prompt + " mejorado por IA"
                            }});
                        }}, 500);
                        return this;
                    }},
                    registrarSesion: function() {{ return this; }},
                    obtenerAsignadosAsesor: function() {{
                        setTimeout(() => {{
                            if (this.successHandler) this.successHandler([]);
                        }}, 10);
                        return this;
                    }},
                    eliminarSesion: function() {{ return this; }},
                    liberarRadicado: function() {{ return this; }},
                    buscarRadicadoAdmin: function() {{ return this; }},
                    actualizarRadicadoAdmin: function() {{ return this; }},
                    obtenerHistorialAsesor: function() {{ return this; }}
                }}
            }}
        }};

{scripts}
    </script>
</body>
</html>
"""

with open('test_env_ai.html', 'w') as f:
    f.write(html_template)
