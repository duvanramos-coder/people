
  // OVERRIDE GLOBAL FUNCTIONS FOR CUSTOM UI

  function updateAdminDashboard() {
    renderAdminKPIs();
    renderAdminCharts();
    renderAdminTable();
    generateAdminInsights();
    renderAdminRanking();
  }

  function renderAdminKPIs() {
    const todayStr = getBogotaDateStr();
    const gestionesHoy = filteredData.filter(d => d.isManaged && d.recibidoPeople === todayStr).length;

    const total = filteredData.length;
    const managed = filteredData.filter(d => d.isManaged).length;
    const pending = total - managed;
    const effective = filteredData.filter(d => {
      const val = (d.efectividad || "").toLowerCase().trim();
      return val === 'sí' || val === 'si';
    }).length;

    document.getElementById('kpiToday').textContent = gestionesHoy;
    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiManaged').textContent = managed;
    document.getElementById('kpiPending').textContent = pending;

    const managedPerc = total > 0 ? ((managed / total) * 100).toFixed(1) : 0;
    const pendingPerc = total > 0 ? ((pending / total) * 100).toFixed(1) : 0;
    const effectivePerc = total > 0 ? ((effective / total) * 100).toFixed(1) : 0;

    document.getElementById('kpiManagedPerc').textContent = `${managedPerc}% del total`;
    document.getElementById('kpiPendingPerc').textContent = `${pendingPerc}% del total`;
    document.getElementById('kpiEffectiveness').textContent = `${effectivePerc}%`;

    lucide.createIcons();
  }

  function renderAdminCharts() {
    const statusCounts = countBy(filteredData, 'estado');
    // Colores: Morado (#342D50), Lima (#B7D400), Rojo (#EE5D50)
    const statusColors = Object.keys(statusCounts).map(key => {
      const s = key.toLowerCase();
      if (s.includes('no contesta') || s.includes('corta')) return '#EE5D50';
      if (s.includes('contactado')) return '#B7D400';
      return '#342D50';
    });
    updateAdminChart('chartStatus', Object.keys(statusCounts), Object.values(statusCounts), statusColors, 'Casos', true);

    const channelCounts = countBy(filteredData, 'canal');
    updateAdminChart('chartChannel', Object.keys(channelCounts), Object.values(channelCounts), ['#342D50', '#B7D400', '#1E1B33', '#A2BC00'], 'Casos', false);

    const managedCounts = {
      'Gestionados': filteredData.filter(d => d.isManaged).length,
      'Pendientes': filteredData.filter(d => !d.isManaged).length
    };
    updateAdminChart('chartManaged', Object.keys(managedCounts), Object.values(managedCounts), ['#B7D400', '#342D50'], 'Casos', true);

    const effCounts = countBy(filteredData, 'efectividad');
    const effColors = Object.keys(effCounts).map(key => {
      const e = key.toLowerCase();
      if (e.includes('si')) return '#B7D400';
      if (e.includes('no')) return '#EE5D50';
      return '#342D50';
    });
    updateAdminChart('chartEffectiveness', Object.keys(effCounts), Object.values(effCounts), effColors, 'Casos', false);
  }

  function updateAdminChart(id, labels, data, colors, datasetLabel = '', isHorizontal = false) {
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    const options = {
      indexAxis: isHorizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // For bar charts, legend is usually redundant if bars have labels
        },
        tooltip: {
          backgroundColor: '#1B2559',
          titleFont: { size: 13, family: 'Inter', weight: '700' },
          bodyFont: { size: 12, family: 'Inter' },
          padding: 12,
          cornerRadius: 12,
          displayColors: false
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#1B2559',
          offset: 4,
          font: { weight: '800', family: 'Inter', size: 11 },
          formatter: (value, context) => {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1) + '%';
            return `${value} (${percentage})`;
          }
        }
      },
      scales: {
        x: {
          grid: { display: isHorizontal, color: '#E9EDF7', drawBorder: false },
          ticks: { color: '#A3AED0', font: { weight: '700', size: 10 } },
          beginAtZero: true
        },
        y: {
          grid: { display: !isHorizontal, color: '#E9EDF7', drawBorder: false },
          ticks: { color: '#A3AED0', font: { weight: '700', size: 10 } }
        }
      },
      layout: {
        padding: {
          right: isHorizontal ? 60 : 0, // Extra space for datalabels on horizontal bars
          top: !isHorizontal ? 30 : 0
        }
      }
    };

    charts[id] = new Chart(ctx, {
      type: 'bar', // Always bar now
      data: {
        labels: labels,
        datasets: [{
          label: datasetLabel,
          data: data,
          backgroundColor: colors,
          hoverBackgroundColor: colors.map(c => c + 'CC'), // Slightly transparent on hover
          borderRadius: 10,
          borderWidth: 0,
          barThickness: 24,
          maxBarThickness: 30
        }]
      },
      options: options,
      plugins: [ChartDataLabels]
    });
  }

  function renderAdminTable() {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * rowsPerPage;
    const displayData = filteredData.slice(startIdx, startIdx + rowsPerPage);

    displayData.forEach(row => {
      const tr = document.createElement('tr');
      const isEffective = (row.efectividad || "").toLowerCase().includes('si');
      tr.innerHTML = `
        <td><span style="color: var(--brand-indigo); font-weight: 800;">${row.radicado}</span></td>
        <td>${row.nombre}</td>
        <td>${row.empresa}</td>
        <td><span class="badge-premium ${getStatusBadgeClass(row.estado)}">${row.estado || '---'}</span></td>
        <td>${row.canal || '---'}</td>
        <td><span class="badge-premium ${isEffective ? 'bg-success-pastel' : 'bg-danger-pastel'}">${row.efectividad || 'No'}</span></td>
      `;
      tbody.appendChild(tr);
    });

    const pagInfo = document.getElementById('paginationInfo');
    if(pagInfo) pagInfo.textContent = `Mostrando ${Math.min(startIdx + 1, totalRows)} - ${Math.min(startIdx + rowsPerPage, totalRows)} de ${totalRows} registros`;

    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = currentPage === totalPages;
    lucide.createIcons();
  }

  function getStatusBadgeClass(status) {
    const s = (status || "").toLowerCase();
    if (s.includes('contactado')) return 'bg-success-pastel';
    if (s.includes('no contesta') || s.includes('corta')) return 'bg-danger-pastel';
    if (s.includes('incorrecta')) return 'bg-warning-pastel';
    return 'bg-info-pastel';
  }

  function renderAdminRanking() {
    const container = document.getElementById('rankingContainer');
    if (!container) return;
    const ranking = filteredData.reduce((acc, d) => { if (d.asesor) acc[d.asesor] = (acc[d.asesor] || 0) + 1; return acc; }, {});
    const sorted = Object.entries(ranking).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted.length > 0 ? sorted[0][1] : 1;

    if (sorted.length === 0) { container.innerHTML = '<p class="text-gray text-center mt-1">Sin datos</p>'; return; }
    container.innerHTML = sorted.map(([name, count]) => `
      <div class="advisor-item">
        <div class="advisor-info">
          <span class="advisor-name">${name}</span>
          <span class="advisor-count">${count}</span>
        </div>
        <div class="progress-sm">
          <div class="progress-bar-premium" style="width: ${(count/max)*100}%"></div>
        </div>
      </div>
    `).join('');
  }

  function generateAdminInsights() {
    const insightDiv = document.getElementById('autoInsight');
    if(!insightDiv) return;
    const total = filteredData.length;
    if (total === 0) { insightDiv.innerHTML = "<p>No hay datos suficientes para análisis.</p>"; return; }
    const unmanaged = filteredData.filter(d => !d.isManaged).length;
    const unmanagedPerc = ((unmanaged / total) * 100).toFixed(1);
    const channelCounts = countBy(filteredData, 'canal');
    const topChannel = Object.keys(channelCounts).reduce((a, b) => (channelCounts[a] || 0) > (channelCounts[b] || 0) ? a : b) || 'Ninguno';

    insightDiv.innerHTML = `
      <p>• El <strong>${unmanagedPerc}%</strong> de los radicados requieren comunicación inmediata.</p>
      <p>• El canal <strong>${topChannel}</strong> lidera la recepción de solicitudes.</p>
      <p>• Se recomienda priorizar los casos de "No contesta" para optimizar la efectividad.</p>
    `;
    lucide.createIcons();
  }

  document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
  });
