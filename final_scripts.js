
  let allData = [];
  let filteredData = [];
  let charts = {};
  let currentPage = 1;
  const rowsPerPage = 10;
  let currentSort = { column: null, direction: 'asc' };
  let currentUser = null;
  let heartbeatInterval = null;
  let onlineAgentsPolling = null;
  let assignedCheckInterval = null;
  let lastAssignedCount = 0;
  let historialCargado = false; // ✅ Flag para lazy loading del historial
  let seenActivityIds = new Set();
  let notificationPolling = null;

  document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkSession();
    loadLoginUsers();
  });

  function checkSession() {
    const session = localStorage.getItem('pqrsf_session');
    if (session) {
      currentUser = JSON.parse(session);
      showViewByRole(currentUser.role);
      startHeartbeat();
    } else {
      showView('loginView');
    }
  }

  function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (!currentUser) return;
    google.script.run.registrarSesion(currentUser.nombre);
    heartbeatInterval = setInterval(() => {
      google.script.run.registrarSesion(currentUser.nombre);
    }, 5 * 60 * 1000);
  }

  function loadLoginUsers() {
    google.script.run
      .withSuccessHandler(users => {
        const selectLogin = document.getElementById('agentSelect');
        if (selectLogin) {
          selectLogin.innerHTML = '<option value="" disabled selected>Selecciona tu perfil...</option>';
          users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.nombre;
            opt.textContent = u.nombre;
            selectLogin.appendChild(opt);
          });
        }
        const selectAssign = document.getElementById('assignAgentSelect');
        if (selectAssign) {
          selectAssign.innerHTML = '<option value="" disabled selected>Seleccionar asesor...</option>';
          users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.nombre;
            opt.textContent = u.nombre;
            selectAssign.appendChild(opt);
          });
        }
      })
      .obtenerUsuarios();
  }

  function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('agentSelect').value;
    const pass = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');

    errorDiv.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Autenticando...';

    google.script.run
      .withSuccessHandler(res => {
        if (res.success) {
          currentUser = res;
          localStorage.setItem('pqrsf_session', JSON.stringify(res));
          showViewByRole(res.role);
          startHeartbeat();
        } else {
          errorDiv.textContent = res.message;
          errorDiv.style.display = 'block';
          btn.disabled = false;
          btn.innerHTML = '<span>Autenticar y Entrar</span> <i data-lucide="log-in"></i>';
          lucide.createIcons();
        }
      })
      .withFailureHandler(err => {
        errorDiv.textContent = "Error de conexión: " + err.message;
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Autenticar y Entrar</span> <i data-lucide="log-in"></i>';
        lucide.createIcons();
      })
      .validarLogin(user, pass);
  }

  function showViewByRole(role) {
    if (role === 'admin') {
      showView('adminView');
      fetchData();
      startOnlineAgentsPolling();
      if (assignedCheckInterval) clearInterval(assignedCheckInterval);
    } else {
      showView('agentView');
      fetchAgentInitialData();   // ✅ Ahora llama a getQuickStats, no getPQRSFData
      startAssignedPolling();
    }
  }

  function startAssignedPolling() {
    if (assignedCheckInterval) clearInterval(assignedCheckInterval);
    let isFirstPoll = true;

    assignedCheckInterval = setInterval(() => {
      google.script.run
        .withSuccessHandler(assigned => {
          const badge = document.getElementById('assignedCountBadge');
          const currentCount = assigned.length;

          if (currentCount > 0) {
            badge.textContent = currentCount;
            badge.style.display = 'inline-block';
          } else {
            badge.textContent = '0';
            badge.style.display = 'none';
          }

          if (!isFirstPoll && currentCount > lastAssignedCount) {
            const nuevos = currentCount - lastAssignedCount;
            showNotification(
              'success',
              'Nuevo Radicado Asignado',
              `Se te ha asignado ${nuevos} nuevo(s) radicado(s). Revisa la pestaña "Asignados".`
            );
          }

          lastAssignedCount = currentCount;
          isFirstPoll = false;
        })
        .withFailureHandler(err => {
          console.error('Error en polling de asignados:', err.message);
        })
        .obtenerAsignadosAsesor(currentUser.nombre);
    }, 60000);
  }

  function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(v => {
      v.style.display = 'none';
      v.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (!target) return;
    target.style.display = 'block';
    target.classList.add('active');
    lucide.createIcons();
  }

  function handleLogout() {
    if (currentUser) {
      google.script.run.eliminarSesion(currentUser.nombre);
    }
    localStorage.removeItem('pqrsf_session');
    if (heartbeatInterval)      clearInterval(heartbeatInterval);
    if (onlineAgentsPolling)    clearInterval(onlineAgentsPolling);
    if (assignedCheckInterval)  clearInterval(assignedCheckInterval);
    if (notificationPolling)    clearInterval(notificationPolling);
    currentUser     = null;
    activeCase      = null;
    historialCargado = false; // ✅ Resetear flag al cerrar sesión
    showView('loginView');
  }

  function togglePassword() {
    const passInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    if (passInput.type === 'password') {
      passInput.type = 'text';
      toggleBtn.textContent = 'HIDE';
    } else {
      passInput.type = 'password';
      toggleBtn.textContent = 'SHOW';
    }
  }

  function showNotification(type, title, message, btnText = 'Continuar') {
    const modal   = document.getElementById('notificationModal');
    const iconDiv = document.getElementById('notifIcon');
    const titleEl = document.getElementById('notifTitle');
    const msgEl   = document.getElementById('notifMessage');
    const btn     = modal.querySelector('.btn-notif-action');

    iconDiv.className = 'notif-icon ' + type;

    if (type === 'success') {
      iconDiv.innerHTML = '<i data-lucide="check-circle-2" style="width: 45px; height: 45px;"></i>';
    } else {
      iconDiv.innerHTML = '<i data-lucide="alert-circle" style="width: 45px; height: 45px;"></i>';
    }

    titleEl.textContent = title;
    msgEl.textContent   = message;
    btn.textContent     = btnText;

    modal.style.display = 'flex';
    lucide.createIcons();
  }

  function closeNotification() {
    document.getElementById('notificationModal').style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────────────
  // PORTAL DE AGENTE
  // ─────────────────────────────────────────────────────────────────────
  let activeCase = null;

  /**
   * ✅ OPTIMIZADA — usa getQuickStats en lugar de cargar toda la hoja
   */
  function fetchAgentInitialData() {
    document.getElementById('agentName').textContent = currentUser.nombre;

    google.script.run
      .withSuccessHandler(stats => {
        document.getElementById('pendingToCommunicate').textContent = stats.pendingTotal;
        document.getElementById('agentCountToday').textContent      = stats.managedToday;

        const badge = document.getElementById('assignedCountBadge');
        if (stats.myAssigned > 0) {
          badge.textContent   = stats.myAssigned;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      })
      .withFailureHandler(err => {
        console.error('Error en getQuickStats:', err.message);
      })
      .getQuickStats(currentUser.nombre);
  }

  function getBogotaDateStr() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year:  'numeric',
      month: '2-digit',
      day:   '2-digit'
    }).format(new Date());
  }

  function claimNextCase() {
    const btn = document.getElementById('btnClaim');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Solicitando...';

    google.script.run
      .withSuccessHandler(res => {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="grab"></i> Solicitar Radicado';
        lucide.createIcons();

        if (res.success) {
          activeCase = res.data;
          showActiveCase();
        } else {
          showNotification('error', 'Sin radicados', res.message);
        }
      })
      .withFailureHandler(err => {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="grab"></i> Solicitar Radicado';
        lucide.createIcons();
        showNotification('error', 'Error Técnico', err.message);
      })
      .claimNextCase(currentUser.nombre);
  }

  function showActiveCase() {
    document.getElementById('claimCaseCard').style.display  = 'none';
    document.getElementById('activeCaseCard').style.display = 'block';

    document.getElementById('activeRadicadoLabel').textContent = activeCase.radicado;
    document.getElementById('caseNombre').textContent          = activeCase.nombre;
    document.getElementById('caseTelefono').textContent        = activeCase.telefono;
    document.getElementById('caseEmpresa').textContent         = activeCase.empresa;
    document.getElementById('caseFecha').textContent           = activeCase.fecha;

    lucide.createIcons();
  }

  function saveManagement(e) {
    e.preventDefault();
    const btn  = document.getElementById('btnSaveMgmt');
    const card = document.querySelector('.active-case-view');
    const data = {
      rowId:              activeCase.rowId,
      asesor:             currentUser.nombre,
      estado:             document.getElementById('mgmtEstado').value,
      canal:              document.getElementById('mgmtCanal').value,
      efectividad:        document.getElementById('mgmtEfectividad').value,
      otraSolucion:       document.getElementById('mgmtOtraSolucion').value,
      seEncontro:         document.getElementById('mgmtSeEncontro').value,
      notas:              document.getElementById('mgmtNotas').value,
      observacionManual:  document.getElementById('mgmtObservacionManual').value,
      emailContacto:      document.getElementById('mgmtEmailContact').value
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> PROCESANDO...';

    google.script.run
      .withSuccessHandler(res => {
        if (res.success) {
          if (card) card.classList.add('animate-success');
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="save"></i> Guardar Gestión';
            lucide.createIcons();
            historialCargado = false; // ✅ Invalidar caché del historial
            fetchAgentInitialData();
            resetManagement();
            showNotification('success', 'Gestión Exitosa', '¡La gestión se ha guardado con éxito!');
          }, 600);
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="save"></i> Guardar Gestión';
          lucide.createIcons();
          showNotification('error', 'Error al guardar', res.message);
        }
      })
      .withFailureHandler(err => {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save"></i> Guardar Gestión';
        lucide.createIcons();
        showNotification('error', 'Error de Conexión', err.message);
      })
      .saveManagement(data);
  }

  function resetManagement() {
    activeCase = null;
    document.getElementById('activeCaseCard').style.display  = 'none';
    document.getElementById('claimCaseCard').style.display   = 'block';
    document.getElementById('managementForm').reset();
    document.getElementById('aiInput').value                 = '';
    document.getElementById('aiOutputContainer').style.display = 'none';
  }

  function liberarRadicadoActivo() {
    if (!activeCase) return;
    toggleLoader(true);
    google.script.run
      .withSuccessHandler(res => {
        toggleLoader(false);
        if (res.success) {
          showNotification('success', 'Radicado Liberado', 'El radicado ha sido liberado y está disponible para otros asesores.');
          resetManagement();
          fetchAgentInitialData();
        } else {
          showNotification('error', 'Error al liberar', res.message);
        }
      })
      .withFailureHandler(err => {
        toggleLoader(false);
        showNotification('error', 'Error de conexión', err.message);
      })
      .liberarRadicado(activeCase.rowId);
  }

  function toggleMgmtFields() {
    const estado      = document.getElementById('mgmtEstado').value;
    const efectividad = document.getElementById('mgmtEfectividad').value;
    const emailGroup  = document.getElementById('emailContactGroup');
    const notasLabel  = document.getElementById('mgmtNotasLabel');
    const notasTextarea = document.getElementById('mgmtNotas');

    if (estado === 'No contesta' || estado === 'Corta llamada') {
      emailGroup.style.display = 'block';
      notasLabel.textContent   = 'Notas del intento (Automático)';
      if (efectividad === 'No') {
        notasTextarea.value = "Se intentó comunicar por medio de llamada y correo electrónico, pero no fue posible por falta de información de contacto del usuario; por lo cual, queda sin lograr comunicación exitosa.";
      } else {
        notasTextarea.value = "Se realizaron tres (3) intentos de llamada al usuario, sin lograr comunicación exitosa. En razón a lo anterior, se procede a enviar comunicación al correo electrónico registrado para dar continuidad a la gestión.";
      }
    } else if (estado === 'Contactado') {
      emailGroup.style.display = 'none';
      notasLabel.textContent   = 'Notas del intento (Automático)';
      notasTextarea.value      = "Se realizó comunicación telefónica de manera satisfactoria, brindando respuesta a su solicitud.";
    } else {
      emailGroup.style.display = 'none';
      notasLabel.textContent   = 'Notas del intento (Automático)';
      notasTextarea.value      = "";
    }
  }

  function improveText(tipo) {
    if (!activeCase) {
      showNotification('error', 'Acción denegada', 'Debes tener un caso activo.');
      return;
    }

    const radicado = activeCase.radicado;
    const agente   = currentUser.nombre;
    const correo   = document.getElementById('mgmtEmailContact').value || "";

    const outputContainer = document.getElementById('aiOutputContainer');
    const headerBox       = document.getElementById('headerOutput');
    const bodyBox         = document.getElementById('bodyOutput');

    outputContainer.style.display = 'block';
    headerBox.value = "Procesando...";
    bodyBox.value   = "Procesando...";

    if (tipo === "PQRSF-RES") {
      const prompt = document.getElementById('aiInput').value.trim();
      if (!prompt) {
        showNotification('error', 'Campo Requerido', 'Por favor escribe la solución.');
        headerBox.value = "";
        bodyBox.value   = "";
        return;
      }
      const metadata = { nombre: activeCase.nombre };
      google.script.run
        .withSuccessHandler(res => {
          if (res.success) {
            const final = construirRespuestaFront("PQRSF-RES", { radicado, agente, cuerpoIA: res.text });
            mostrarResultado(final);
          } else {
            headerBox.value = "Error";
            bodyBox.value   = "Error: " + res.message;
          }
        })
        .withFailureHandler(err => {
          headerBox.value = "Error";
          bodyBox.value   = "Error: " + err.message;
        })
        .generarRespuestaIA(prompt, metadata);
    } else if (tipo === "PQRSF-NC") {
      if (!correo) {
        showNotification('error', 'Correo Faltante', 'Debes ingresar el correo del usuario.');
        headerBox.value = "";
        bodyBox.value   = "";
        return;
      }
      const final = construirRespuestaFront("PQRSF-NC", { radicado, agente, correo });
      mostrarResultado(final);
    }
  }

  function mostrarResultado(data) {
    document.getElementById('headerOutput').value = data.header;
    document.getElementById('bodyOutput').value   = data.body;
    document.getElementById('aiOutputContainer').style.display = 'block';
  }

  function construirRespuestaFront(tipo, data) {
    if (tipo === "PQRSF-RES") {
      return {
        header: `RESPUESTA A SU PQRSF - RADICADO N.° ${data.radicado}`,
        body: `Cordial saludo,
Hemos intentado comunicarnos con usted vía telefónica; sin embargo, no fue posible establecer la comunicación.

En atención a su solicitud radicada ante la Caja de Compensación Familiar COFREM, nos permitimos informarle que, una vez realizado el estudio y validación correspondiente de su caso, se obtuvo el siguiente resultado:

${data.cuerpoIA}

Agradecemos su comunicación y reiteramos nuestro compromiso con la correcta prestación del servicio.

Cordialmente,

${data.agente}
Asesora de Servicio al Cliente
Teléfono: (608) 681 83 20
Línea gratuita nacional: 01 8000 111 879`
      };
    }
    if (tipo === "PQRSF-NC") {
      return {
        header: `RESPUESTA A SU PQRSF - RADICADO N.° ${data.radicado}`,
        body: `Cordial saludo,

Hemos intentado comunicarnos con usted vía telefónica; sin embargo, no fue posible establecer la comunicación.

En atención a su solicitud PQRSF radicada ante la Caja de Compensación Familiar COFREM, nos permitimos informarle que, una vez realizado el estudio y validación correspondiente de su caso, la misma ya fue debidamente respondida.

La información asociada a su solicitud fue enviada al siguiente correo electrónico:

📧 ${data.correo}

Agradecemos su comunicación y reiteramos nuestro compromiso con la correcta prestación del servicio. En caso de requerir información adicional, puede comunicarse a través de nuestros canales de atención.

Cordialmente,

${data.agente}
Asesora de Servicio al Cliente
Teléfono: (608) 681 83 20
Línea gratuita nacional: 01 8000 111 879`
      };
    }
  }

  function copiarCampo(id) {
    const el = document.getElementById(id);
    el.select();
    document.execCommand('copy');
    showNotification('success', 'Copiado', 'Contenido copiado al portapapeles.');
  }

  // ─────────────────────────────────────────────────────────────────────
  // DASHBOARD ADMIN
  // ─────────────────────────────────────────────────────────────────────

  function fetchData() {
    toggleLoader(true);
    google.script.run
      .withSuccessHandler(data => {
        allData      = data;
        filteredData = [...allData];
        initializeFilters();
        updateDashboard();
        toggleLoader(false);
      })
      .withFailureHandler(err => {
        showNotification('error', 'Error de Carga', err.message);
        toggleLoader(false);
      })
      .getPQRSFData();
  }

  function toggleLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  function initializeFilters() {
    const months    = [...new Set(allData.map(d => {
      if (!d.fechaCofrem) return null;
      const date = new Date(d.fechaCofrem);
      return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    }).filter(Boolean))].sort();

    const companies = [...new Set(allData.map(d => d.empresa).filter(Boolean))].sort();
    const channels  = [...new Set(allData.map(d => d.canal).filter(Boolean))].sort();
    const statuses  = [...new Set(allData.map(d => d.estado).filter(Boolean))].sort();
    const advisors  = [...new Set(allData.map(d => d.asesor).filter(Boolean))].sort();

    populateSelect('filterMonth',   months,    "Mes (Cofrem)");
    populateSelect('filterCompany', companies, "Empresa");
    populateSelect('filterChannel', channels,  "Canal");
    populateSelect('filterStatus',  statuses,  "Estado");
    populateSelect('filterAdvisor', advisors,  "Asesor");
  }

  function populateSelect(id, values, label) {
    const select       = document.getElementById(id);
    const currentValue = select.value;
    select.innerHTML   = `<option value="">Todos los ${label}</option>`;
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value       = v;
      opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      select.appendChild(opt);
    });
    select.value = currentValue;
  }

  function applyFilters() {
    const month   = document.getElementById('filterMonth').value;
    const company = document.getElementById('filterCompany').value;
    const channel = document.getElementById('filterChannel').value;
    const status  = document.getElementById('filterStatus').value;
    const advisor = document.getElementById('filterAdvisor').value;
    const dateFrom    = document.getElementById('searchDateFrom').value;
    const dateTo      = document.getElementById('searchDateTo').value;
    const searchName  = document.getElementById('searchName').value.toLowerCase().trim();
    const searchPhone = document.getElementById('searchPhone').value.trim();

    filteredData = allData.filter(d => {
      const dMonth = d.fechaCofrem
        ? new Date(d.fechaCofrem).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
        : null;
      const matchMonth   = !month   || dMonth === month;
      const matchCompany = !company || d.empresa === company;
      const matchChannel = !channel || d.canal   === channel;
      const matchStatus  = !status  || d.estado  === status;
      const matchAdvisor = !advisor || d.asesor  === advisor;
      let matchAdvanced  = true;
      if (dateFrom) matchAdvanced = matchAdvanced && (d.fechaCofrem >= dateFrom || d.recibidoPeople >= dateFrom);
      if (dateTo)   matchAdvanced = matchAdvanced && (d.fechaCofrem <= dateTo   || d.recibidoPeople <= dateTo);
      if (searchName)  matchAdvanced = matchAdvanced && d.nombre.toLowerCase().includes(searchName);
      if (searchPhone) matchAdvanced = matchAdvanced && d.telefono.includes(searchPhone);
      return matchMonth && matchCompany && matchChannel && matchStatus && matchAdvisor && matchAdvanced;
    });

    currentPage = 1;
    updateDashboard();
  }

  function toggleAdvancedSearch() {
    const panel    = document.getElementById('advancedSearchPanel');
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    lucide.createIcons();
  }

  function resetAdvancedSearch() {
    document.getElementById('searchDateFrom').value = '';
    document.getElementById('searchDateTo').value   = '';
    document.getElementById('searchName').value     = '';
    document.getElementById('searchPhone').value    = '';
    applyFilters();
  }

  function updateDashboard() {
    if (currentUser && currentUser.role === 'admin' && typeof updateAdminDashboard === 'function') {
      updateAdminDashboard();
    } else {
      renderKPIs();
      renderCharts();
      renderTable();
      generateInsights();
      renderRanking();
    }
  }


  function startOnlineAgentsPolling() {
    if (onlineAgentsPolling) clearInterval(onlineAgentsPolling);
    updateOnlineAgents();
    onlineAgentsPolling = setInterval(updateOnlineAgents, 30 * 1000);
    if (notificationPolling) clearInterval(notificationPolling);
    notificationPolling = setInterval(pollActivity, 30 * 1000);
  }

  function pollActivity() {
    google.script.run
      .withSuccessHandler(res => {
        if (res.success && res.eventos.length > 0) {
          res.eventos.forEach(ev => {
            if (!seenActivityIds.has(ev.id)) {
              showToast(ev.mensaje);
              seenActivityIds.add(ev.id);
              if (seenActivityIds.size > 50) {
                const firstId = seenActivityIds.values().next().value;
                seenActivityIds.delete(firstId);
              }
            }
          });
        }
      })
      .obtenerActividadReciente();
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast     = document.createElement('div');
    toast.className = 'glass-card fade-in';
    toast.style.cssText = 'padding:12px 20px;border-left:4px solid var(--secondary);pointer-events:auto;min-width:250px;box-shadow:0 10px 30px rgba(0,0,0,0.15);';
    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <i data-lucide="bell" style="width:18px;color:var(--secondary-dark);"></i>
        <div style="font-size:0.85rem;font-weight:600;">${message}</div>
      </div>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => {
      toast.style.opacity    = '0';
      toast.style.transform  = 'translateX(20px)';
      toast.style.transition = 'all 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  }

  function updateOnlineAgents() {
    google.script.run
      .withSuccessHandler(agents => {
        const container = document.getElementById('onlineAgentsContainer');
        if (!container) return;
        if (agents.length === 0) {
          container.innerHTML = '<p class="text-muted text-center mt-1">No hay agentes en línea</p>';
          return;
        }
        container.innerHTML = agents.map(a => `
          <div class="rank-item" style="justify-content:space-between;align-items:center;display:flex;width:100%;">
            <div>
              <span class="rank-name">${a.nombre}</span>
              <div style="font-size:0.65rem;color:var(--text-muted);">${a.tiempo}</div>
            </div>
            <div style="display:flex;gap:5px;align-items:center;">
              ${a.enGestion ? '<span class="status-pill warning" style="font-size:0.6rem;padding:2px 6px;">Gestión</span>' : ''}
              <span class="status-pill green" style="font-size:0.6rem;padding:2px 6px;">Línea</span>
            </div>
          </div>
        `).join('');
      })
      .obtenerAgentesConectados();
  }

  function showAgentSection(section) {
    document.querySelectorAll('.agent-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('agent-section-' + section).style.display = section === 'gestion' ? 'grid' : 'block';
    document.getElementById('nav-' + section).classList.add('active');

    if (section === 'historial') {
      cargarHistorialAsesor(); // ✅ Lazy loading — solo carga si no está cargado
    } else if (section === 'asignados') {
      cargarAsignadosAsesor();
    }
    lucide.createIcons();
  }

  function cargarAsignadosAsesor(silent = false) {
    const tbody = document.getElementById('agentAssignedBody');
    const badge = document.getElementById('assignedCountBadge');
    if (!silent) tbody.innerHTML = '<tr><td colspan="5" class="text-center"><span class="spinner-sm" style="border-top-color:var(--primary)"></span> Buscando asignados...</td></tr>';

    google.script.run
      .withSuccessHandler(assigned => {
        if (assigned.length === 0) {
          if (!silent) tbody.innerHTML = '<tr><td colspan="5" class="text-center">No tienes radicados asignados pendientes.</td></tr>';
          badge.style.display = 'none';
          return;
        }
        badge.textContent   = assigned.length;
        badge.style.display = 'inline-block';
        if (!silent) {
          tbody.innerHTML = assigned.map(h => `
            <tr class="fade-in">
              <td style="padding:1rem;"><strong>${h.radicado}</strong></td>
              <td style="padding:1rem;">${h.nombre}</td>
              <td style="padding:1rem;">${h.empresa}</td>
              <td style="padding:1rem;">${h.fecha}</td>
              <td style="padding:1rem;">
                <button class="btn-search-premium" onclick="gestionarAsignado('${h.radicado}')" style="padding:0.4rem 0.8rem;font-size:0.7rem;">
                  GESTIONAR
                </button>
              </td>
            </tr>
          `).join('');
        }
      })
      .obtenerAsignadosAsesor(currentUser.nombre);
  }

  function gestionarAsignado(radicado) {
    toggleLoader(true);
    google.script.run
      .withSuccessHandler(res => {
        toggleLoader(false);
        if (res.success) {
          activeCase = res.data;
          showAgentSection('gestion');
          showActiveCase();
        } else {
          showNotification('error', 'Error', res.message);
        }
      })
      .buscarRadicadoAdmin(radicado);
  }

  /**
   * ✅ OPTIMIZADA — Lazy loading: solo carga al hacer clic y no recarga si ya hay datos
   */
  function cargarHistorialAsesor() {
    const tbody = document.getElementById('agentHistoryBody');

    if (historialCargado) return; // ✅ Ya cargado, no volver a pedir al servidor

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><span class="spinner-sm" style="border-top-color:var(--primary)"></span> Cargando historial...</td></tr>';

    google.script.run
      .withSuccessHandler(history => {
        historialCargado = true; // ✅ Marcar como cargado

        if (history.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center">No has realizado gestiones aún.</td></tr>';
          return;
        }
        tbody.innerHTML = history.map(h => `
          <tr class="fade-in">
            <td style="padding:1rem;"><strong>${h.radicado}</strong></td>
            <td style="padding:1rem;">${h.nombre}</td>
            <td style="padding:1rem;">${h.fecha}</td>
            <td style="padding:1rem;"><span class="status-pill ${getStatusClass(h.estado)}">${h.estado}</span></td>
            <td style="padding:1rem;">${h.canal}</td>
            <td style="padding:1rem;"><span class="status-pill ${h.efectividad.toLowerCase() === 'si' ? 'green' : 'red'}">${h.efectividad}</span></td>
          </tr>
        `).join('');
      })
      .withFailureHandler(err => {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar: ${err.message}</td></tr>`;
      })
      .obtenerHistorialAsesor(currentUser.nombre);
  }

  function ejecutarBusquedaAdmin() {
    const numero = document.getElementById('adminSearchInput').value.trim();
    if (!numero) { showNotification('error', 'Dato requerido', 'Ingrese un número de radicado.'); return; }
    buscarYMostrarEditor(numero);
  }

  function ejecutarAsignacion() {
    const agente   = document.getElementById('assignAgentSelect').value;
    const radicado = document.getElementById('assignRadicadoInput').value.trim();
    if (!agente)   { showNotification('error', 'Falta Asesor',   'Seleccione un asesor para asignar.'); return; }
    if (!radicado) { showNotification('error', 'Falta Radicado', 'Ingrese el número de radicado.');     return; }
    toggleLoader(true);
    google.script.run
      .withSuccessHandler(res => {
        toggleLoader(false);
        if (res.success) {
          showNotification('success', 'Asignación Exitosa', res.message);
          document.getElementById('assignRadicadoInput').value = '';
          fetchData();
        } else {
          showNotification('error', 'Error de Asignación', res.message);
        }
      })
      .withFailureHandler(err => {
        toggleLoader(false);
        showNotification('error', 'Error de Conexión', err.message);
      })
      .asignarRadicado(radicado, agente);
  }

  function ejecutarBusquedaAgente() {
    const numero = document.getElementById('agentSearchInput').value.trim();
    if (!numero) { showNotification('error', 'Dato requerido', 'Ingrese un número de radicado.'); return; }
    buscarYMostrarEditor(numero);
  }

  function buscarYMostrarEditor(numero) {
    if (allData.length > 0) {
      const found = allData.find(d => String(d.radicado).trim() === String(numero).trim());
      if (found) {
        mostrarEditorRadicado({
          rowId:        found.id,
          radicado:     found.radicado,
          nombre:       found.nombre,
          asesor:       found.asesor,
          estado:       found.estado,
          canal:        found.canal,
          efectividad:  found.efectividad,
          otraSolucion: found.requiereOtraSolucion,
          seEncontro:   found.seEncontroPqrs
        });
        return;
      }
    }
    toggleLoader(true);
    google.script.run
      .withSuccessHandler(res => {
        toggleLoader(false);
        if (res.success) {
          mostrarEditorRadicado(res.data);
        } else {
          showNotification('error', 'No encontrado', res.message);
        }
      })
      .buscarRadicadoAdmin(numero);
  }

  function mostrarEditorRadicado(data) {
    const modal = document.getElementById('adminEditModal');
    const body  = document.getElementById('adminEditModalBody');
    modal.style.display = 'flex';
    body.innerHTML = `
      <div class="case-info-grid-premium" style="margin-top:0;">
        <div class="info-tile">
          <label>USUARIO</label>
          <p>${data.nombre}</p>
        </div>
        <div class="info-tile">
          <label>ASESOR ORIGINAL</label>
          <p>${data.asesor || 'Sin asignar'}</p>
        </div>
      </div>
      <div class="input-row-grid mt-1" style="grid-template-columns:repeat(2,1fr);">
        <div class="form-group">
          <label>Estado de Gestión</label>
          <select id="editEstado" class="premium-select" style="padding-left:1rem;">
            <option value="Contactado"          ${data.estado === 'Contactado'          ? 'selected' : ''}>Contactado</option>
            <option value="No contesta"         ${data.estado === 'No contesta'         ? 'selected' : ''}>No contesta</option>
            <option value="Corta llamada"       ${data.estado === 'Corta llamada'       ? 'selected' : ''}>Corta llamada</option>
            <option value="Solucion Incorrecta" ${data.estado === 'Solucion Incorrecta' ? 'selected' : ''}>Solucion Incorrecta</option>
          </select>
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="editCanal" class="premium-select" style="padding-left:1rem;">
            <option value="Llamada"             ${data.canal === 'Llamada'             ? 'selected' : ''}>Llamada</option>
            <option value="Correo"              ${data.canal === 'Correo'              ? 'selected' : ''}>Correo</option>
            <option value="Web"                 ${data.canal === 'Web'                 ? 'selected' : ''}>Web</option>
            <option value="Solución Incorrecta" ${data.canal === 'Solución Incorrecta' ? 'selected' : ''}>Solución Incorrecta</option>
            <option value="Por gestionar"       ${data.canal === 'Por gestionar'       ? 'selected' : ''}>Por gestionar</option>
          </select>
        </div>
        <div class="form-group">
          <label>¿Fue efectivo?</label>
          <select id="editEfectividad" class="premium-select" style="padding-left:1rem;">
            <option value="Si" ${data.efectividad === 'Si' ? 'selected' : ''}>Si</option>
            <option value="No" ${data.efectividad === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div class="form-group">
          <label>¿Requiere otra solución?</label>
          <select id="editOtraSolucion" class="premium-select" style="padding-left:1rem;">
            <option value="Si" ${data.otraSolucion === 'Si' ? 'selected' : ''}>Si</option>
            <option value="No" ${data.otraSolucion === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div class="form-group">
          <label>¿Se encontró PQRS?</label>
          <select id="editSeEncontro" class="premium-select" style="padding-left:1rem;">
            <option value="SI" ${data.seEncontro && data.seEncontro.toUpperCase() === 'SI' ? 'selected' : ''}>Si</option>
            <option value="NO" ${data.seEncontro && data.seEncontro.toUpperCase() === 'NO' ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
      <div class="form-group mt-1">
        <label>Observaciones (Opcional)</label>
        <textarea id="editObservacion" rows="3" class="premium-textarea" placeholder="Escriba notas adicionales aquí...">${data.observacionManual || ""}</textarea>
      </div>
      <div class="form-footer-actions mt-1">
        <button class="btn-save-premium" onclick="guardarEdicionAdmin(${data.rowId})" style="width:100%;justify-content:center;">
          <i data-lucide="refresh-cw"></i> ACTUALIZAR COMUNICACIÓN
        </button>
      </div>
    `;
    lucide.createIcons();
  }

  function cerrarModalAdmin() {
    document.getElementById('adminEditModal').style.display = 'none';
  }

  function guardarEdicionAdmin(rowId) {
    const data = {
      rowId:             rowId,
      estado:            document.getElementById('editEstado').value,
      canal:             document.getElementById('editCanal').value,
      efectividad:       document.getElementById('editEfectividad').value,
      otraSolucion:      document.getElementById('editOtraSolucion').value,
      seEncontro:        document.getElementById('editSeEncontro').value,
      observacionManual: document.getElementById('editObservacion').value
    };
    toggleLoader(true);
    google.script.run
      .withSuccessHandler(res => {
        toggleLoader(false);
        if (res.success) {
          const modal = document.querySelector('.modal-content');
          if (modal) {
            modal.classList.add('animate-success');
            setTimeout(() => {
              showNotification('success', 'Actualización Exitosa', '¡Información actualizada correctamente!');
              cerrarModalAdmin();
              const adminInput = document.getElementById('adminSearchInput');
              if (adminInput) adminInput.value = '';
              const agentInput = document.getElementById('agentSearchInput');
              if (agentInput) agentInput.value = '';
              if (currentUser.role === 'admin') {
                fetchData();
              } else {
                historialCargado = false; // ✅ Invalidar caché del historial
                fetchAgentInitialData();
              }
            }, 600);
          }
        } else {
          showNotification('error', 'Error de Actualización', res.message);
        }
      })
      .actualizarRadicadoAdmin(data);
  }

  function renderKPIs() {
    const todayStr      = getBogotaDateStr();
    const gestionesHoy  = filteredData.filter(d => d.isManaged && d.recibidoPeople === todayStr).length;
    const total         = filteredData.length;
    const managed       = filteredData.filter(d => d.isManaged).length;
    const pending       = total - managed;
    const effective     = filteredData.filter(d => {
      const val = (d.efectividad || "").toLowerCase().trim();
      return val === 'sí' || val === 'si';
    }).length;

    document.getElementById('kpiToday').textContent   = gestionesHoy;
    document.getElementById('kpiTotal').textContent   = total;
    document.getElementById('kpiManaged').textContent = managed;
    document.getElementById('kpiPending').textContent = pending;

    const managedPerc   = total > 0 ? ((managed   / total) * 100).toFixed(1) : 0;
    const pendingPerc   = total > 0 ? ((pending   / total) * 100).toFixed(1) : 0;
    const effectivePerc = total > 0 ? ((effective / total) * 100).toFixed(1) : 0;

    document.getElementById('kpiManagedPerc').textContent   = `${managedPerc}% del total`;
    document.getElementById('kpiPendingPerc').textContent   = `${pendingPerc}% del total`;
    document.getElementById('kpiEffectiveness').textContent = `${effectivePerc}%`;
  }

  function renderCharts() {
    const statusCounts  = countBy(filteredData, 'estado');
    updateChart('chartStatus',       'pie',      Object.keys(statusCounts),  Object.values(statusCounts),  ['#3b3561','#ef4444','#facc15','#64748b'], 'Estado');
    const channelCounts = countBy(filteredData, 'canal');
    updateChart('chartChannel',      'doughnut', Object.keys(channelCounts), Object.values(channelCounts), ['#6366f1','#b7d400'], 'Canal');
    const managedCounts = {
      'Gestionados': filteredData.filter(d =>  d.isManaged).length,
      'Pendientes':  filteredData.filter(d => !d.isManaged).length
    };
    updateChart('chartManaged',      'pie',      Object.keys(managedCounts), Object.values(managedCounts), ['#22c55e','#ef4444'], 'Gestión');
    const effCounts = countBy(filteredData, 'efectividad');
    updateChart('chartEffectiveness','bar',      Object.keys(effCounts),     Object.values(effCounts),     ['#b7d400','#e2e8f0'], 'Efectividad');
  }

  function updateChart(id, type, labels, data, colors, datasetLabel = '') {
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    charts[id] = new Chart(ctx, {
      type: type,
      data: {
        labels: labels,
        datasets: [{
          label:           datasetLabel,
          data:            data,
          backgroundColor: colors,
          borderColor:     '#ffffff',
          borderWidth:     2
        }]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, weight: 600 } } },
          datalabels: {
            color: '#1e293b', font: { weight: 'bold', size: 10 },
            formatter: (value, ctx) => {
              let sum = 0;
              ctx.chart.data.datasets[0].data.map(d => sum += d);
              const percentage = (value * 100 / sum).toFixed(1) + "%";
              return type === 'bar' ? value : percentage;
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  function countBy(arr, key) {
    return arr.reduce((acc, obj) => {
      const val = obj[key] || 'Sin definir';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const totalRows  = filteredData.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx    = (currentPage - 1) * rowsPerPage;
    const displayData = filteredData.slice(startIdx, startIdx + rowsPerPage);
    displayData.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${row.radicado}</strong></td>
        <td>${row.nombre}</td>
        <td>${row.empresa}</td>
        <td><span class="status-pill ${getStatusClass(row.estado)}">${row.estado || '---'}</span></td>
        <td>${row.canal || '---'}</td>
        <td>${row.efectividad || 'No'}</td>
      `;
      tbody.appendChild(tr);
    });
    const pagInfo = document.getElementById('paginationInfo');
    if (pagInfo) pagInfo.textContent = `Mostrando ${Math.min(startIdx + 1, totalRows)} - ${Math.min(startIdx + rowsPerPage, totalRows)} de ${totalRows} registros.`;
  }

  function getStatusClass(status) {
    const s = (status || "").toLowerCase();
    if (s.includes('contactado'))                          return 'green';
    if (s.includes('no contesta') || s.includes('corta')) return 'red';
    return 'warning';
  }

  function changePage(delta) {
    currentPage += delta;
    if (currentUser && currentUser.role === 'admin' && typeof renderAdminTable === 'function') {
      renderAdminTable();
    } else {
      renderTable();
    }
  }

  function renderRanking() {
    const container = document.getElementById('rankingContainer');
    if (!container) return;
    const ranking = filteredData.reduce((acc, d) => {
      if (d.asesor) acc[d.asesor] = (acc[d.asesor] || 0) + 1;
      return acc;
    }, {});
    const sorted = Object.entries(ranking).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) { container.innerHTML = '<p class="text-muted text-center mt-1">Sin datos</p>'; return; }
    container.innerHTML = sorted.map(([name, count]) => `
      <div class="rank-item">
        <span class="rank-name">${name}</span>
        <span class="rank-badge">${count} casos</span>
      </div>
    `).join('');
  }

  function generateInsights() {
    const insightDiv = document.getElementById('autoInsight');
    if (!insightDiv) return;
    const total = filteredData.length;
    if (total === 0) { insightDiv.textContent = "No hay datos"; return; }
    const unmanaged     = filteredData.filter(d => !d.isManaged).length;
    const unmanagedPerc = ((unmanaged / total) * 100).toFixed(1);
    const channelCounts = countBy(filteredData, 'canal');
    const topChannel    = Object.keys(channelCounts).reduce((a, b) =>
      (channelCounts[a] || 0) > (channelCounts[b] || 0) ? a : b) || 'Ninguno';
    insightDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-top:10px;">
        <i data-lucide="info" style="color:var(--secondary-dark)"></i>
        <div style="font-size:0.85rem">
          <p>El <strong>${unmanagedPerc}%</strong> de los radicados están pendientes.</p>
          <p>Canal principal: <strong>${topChannel}</strong>.</p>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  function filterTable() {
    const query = document.getElementById('tableSearch').value.toLowerCase();
    const rows  = document.getElementById('tableBody').getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
      rows[i].style.display = rows[i].textContent.toLowerCase().includes(query) ? "" : "none";
    }
  }

  function refreshData() {
    fetchData();
  }

  function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Radicado,Nombre,Empresa,Estado,Canal,Efectividad\r\n";
    filteredData.forEach(row => {
      csvContent += [row.radicado, row.nombre, row.empresa, row.estado, row.canal, row.efectividad].join(",") + "\r\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link       = document.createElement("a");
    link.setAttribute("href",     encodedUri);
    link.setAttribute("download", "pqrsf_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToPDF() { window.print(); }

  function sortTable(n) {
    const columns = ['radicado','nombre','empresa','estado','canal','efectividad'];
    const key     = columns[n];
    if (currentSort.column === key) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.column    = key;
      currentSort.direction = 'asc';
    }
    filteredData.sort((a, b) => {
      let valA = (a[key] || "").toString().toLowerCase();
      let valB = (b[key] || "").toString().toLowerCase();
      if (valA < valB) return currentSort.direction === 'asc' ? -1 :  1;
      if (valA > valB) return currentSort.direction === 'asc' ?  1 : -1;
      return 0;
    });
    currentPage = 1;
    if (currentUser && currentUser.role === 'admin' && typeof renderAdminTable === 'function') {
      renderAdminTable();
    } else {
      renderTable();
    }
  }

  function renderDailyStats() {
    const dateInput    = document.getElementById('dailyStatsDate').value;
    const statsContent = document.getElementById('dailyStatsContent');
    const statsEmpty   = document.getElementById('dailyStatsEmpty');
    if (!dateInput) {
      statsContent.style.display = 'none';
      statsEmpty.style.display   = 'block';
      return;
    }
    const dayData    = allData.filter(d => d.recibidoPeople === dateInput);
    const managedDay = dayData.filter(d => d.isManaged);
    const total      = dayData.length;
    const managed    = managedDay.length;
    const effective  = managedDay.filter(d => (d.efectividad || "").toLowerCase().trim().includes('si')).length;
    const effPerc    = managed > 0 ? ((effective / managed) * 100).toFixed(1) : 0;

    document.getElementById('dailyTotal').textContent   = total;
    document.getElementById('dailyManaged').textContent = managed;
    document.getElementById('dailyEff').textContent     = effPerc + '%';

    const advisorStats = managedDay.reduce((acc, d) => {
      if (!acc[d.asesor]) acc[d.asesor] = { count: 0, effective: 0 };
      acc[d.asesor].count++;
      if ((d.efectividad || "").toLowerCase().trim().includes('si')) acc[d.asesor].effective++;
      return acc;
    }, {});

    const tbody = document.getElementById('dailyAdvisorTable');
    tbody.innerHTML = Object.entries(advisorStats).map(([name, stat]) => `
      <tr>
        <td>${name}</td>
        <td class="text-center fw-bold">${stat.count}</td>
        <td class="text-end text-success">${((stat.effective / stat.count) * 100).toFixed(0)}%</td>
      </tr>
    `).join('') || '<tr><td colspan="3" class="text-center py-2">Sin gestiones este día</td></tr>';

    statsContent.style.display = 'block';
    statsEmpty.style.display   = 'none';
  }
