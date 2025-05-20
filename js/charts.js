// Magia dos Gráficos - Funções para criar e atualizar gráficos (VERSÃO CORRIGIDA)

// Variáveis globais para armazenar nossos gráficos
let categoryExpensesChart, cardUsageDonutChart, annualBarsChart, fixedVsVariableChart, personAnalysisChart;

// Funções auxiliares para gráficos modernos
const showTooltip = (chart, content, event) => {
  const tooltip = $('#tooltip');
  if (!tooltip) return;
  tooltip.innerHTML = content;
  tooltip.classList.add('visible');
  
  const x = event.clientX;
  const y = event.clientY;
  
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = x + 10;
  let top = y + 10;
  
  if (left + tooltipWidth > viewportWidth) {
    left = x - tooltipWidth - 10;
  }
  
  if (top + tooltipHeight > viewportHeight) {
    top = y - tooltipHeight - 10;
  }
  
  left = Math.max(10, left);
  top = Math.max(10, top);
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
};

const hideTooltip = () => {
  const tooltip = $('#tooltip');
  if (!tooltip) return;
  tooltip.classList.remove('visible');
};

// Função para atualizar cores dos gráficos - VERSÃO MELHORADA E SEGURA
const updateChartColors = () => {
  const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-on-surface-variant').trim();
  const gridColor = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  // ✨ MELHORIAS SEGURAS: Paleta de cores mais vibrantes
  const chartColorsVibrant = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
    '#059669', '#ea580c', '#4338ca', '#c2410c', '#0d9488',
    '#be123c', '#15803d', '#9333ea', '#c26410', '#0f766e'
  ];
  
  // Cores com gradientes
  const createGradient = (ctx, colorStart, colorEnd) => {
    if (!ctx || !ctx.canvas) return colorStart;
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };
  
  const incomeColor = getComputedStyle(document.documentElement).getPropertyValue('--color-income').trim();
  const expenseColor = getComputedStyle(document.documentElement).getPropertyValue('--color-expense').trim();
  
  // ✨ MELHORIAS SEGURAS: Configurações globais mais elegantes
  Chart.defaults.font.family = '"Inter", "SF Pro Display", -apple-system, sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  Chart.defaults.plugins.tooltip.enabled = false; 
  Chart.defaults.elements.bar.borderRadius = 10; // ✨ Bordas mais arredondadas
  Chart.defaults.elements.line.tension = 0.4; 
  Chart.defaults.plugins.legend.display = false; 
  Chart.defaults.layout.padding = { top: 25, bottom: 35, left: 25, right: 25 };
  
  const getCtx = (chartInstance) => chartInstance.ctx;
  
  if (categoryExpensesChart) {
    const ctx = getCtx(categoryExpensesChart);
    categoryExpensesChart.data.datasets[0].backgroundColor = categoryExpensesChart.data.labels.map((_, i) => {
      const color = chartColorsVibrant[i % chartColorsVibrant.length];
      const lighterColor = isDarkTheme 
        ? color + '90' // ✨ Transparência mais elegante
        : color + 'CC';
      return createGradient(ctx, color, lighterColor);
    });
    categoryExpensesChart.data.datasets[0].borderColor = 'transparent';
    categoryExpensesChart.data.datasets[0].borderWidth = 0;
    categoryExpensesChart.data.datasets[0].borderRadius = 10; // ✨ Bordas arredondadas
    
    categoryExpensesChart.options.scales.y.ticks.color = textColor;
    categoryExpensesChart.options.scales.y.grid.color = gridColor;
    categoryExpensesChart.options.scales.y.ticks.padding = 10;
    categoryExpensesChart.options.scales.y.ticks.callback = function(value) {
      return formatCurrency(value);
    };
    
    categoryExpensesChart.options.scales.x.ticks.color = textColor;
    categoryExpensesChart.options.scales.x.grid.color = 'transparent';
    categoryExpensesChart.options.scales.x.ticks.padding = 10;
    
    categoryExpensesChart.update();
  }
  
  if (cardUsageDonutChart) {
    // ✨ MELHORIAS SEGURAS: Cores mais vibrantes para cartões
    const usedColor = '#dc2626';     // Vermelho mais vibrante
    const availableColor = '#16a34a'; // Verde mais vibrante
    
    cardUsageDonutChart.data.datasets[0].backgroundColor = [usedColor, availableColor];
    cardUsageDonutChart.data.datasets[0].borderColor = isDarkTheme ? '#374151' : '#ffffff';
    cardUsageDonutChart.data.datasets[0].borderWidth = 3;
    cardUsageDonutChart.data.datasets[0].borderRadius = 6; // ✨ Bordas arredondadas
    cardUsageDonutChart.options.cutout = '65%';
    
    if (cardUsageDonutChart.data.datasets[0].data[0] !== undefined) {
      const used = cardUsageDonutChart.data.datasets[0].data[0];
      const totalForPercentage = cardUsageDonutChart.data.datasets[0].data.slice(0, 2).reduce((acc, val) => acc + val, 0);
      
      if (totalForPercentage > 0) {
        const usedPercentage = Math.round((used / totalForPercentage) * 100);
        if ($('.limit-value')) {
          $('.limit-value').textContent = `${usedPercentage}%`;
          // ✨ MELHORIAS SEGURAS: Tipografia mais elegante
          $('.limit-value').style.fontWeight = '600';
          $('.limit-value').style.fontSize = '24px';
          
          if (usedPercentage > 80) {
            $('.limit-value').style.color = '#dc2626';
          } else if (usedPercentage > 60) {
            $('.limit-value').style.color = '#d97706';
          } else {
            $('.limit-value').style.color = '#16a34a';
          }
        }
      } else {
        if ($('.limit-value')) {
          $('.limit-value').textContent = `0%`;
          $('.limit-value').style.color = getComputedStyle(document.documentElement).getPropertyValue('--color-on-surface').trim();
        }
      }
    }
    cardUsageDonutChart.update();
  }
  
  if (fixedVsVariableChart) {
    // ✨ MELHORIAS SEGURAS: Cores mais vibrantes para fixas vs variáveis
    const fixedColor = '#2563eb';   // Azul mais vibrante
    const variableColor = '#7c3aed'; // Roxo mais vibrante
    
    fixedVsVariableChart.data.datasets[0].backgroundColor = [fixedColor, variableColor];
    fixedVsVariableChart.data.datasets[0].borderColor = isDarkTheme ? '#374151' : '#ffffff';
    fixedVsVariableChart.data.datasets[0].borderWidth = 3;
    
    fixedVsVariableChart.update();
  }
  
  if (personAnalysisChart) {
    const ctx = getCtx(personAnalysisChart);
    personAnalysisChart.data.datasets[0].backgroundColor = personAnalysisChart.data.labels.map((_, i) => {
      const baseColor = chartColorsVibrant[i % chartColorsVibrant.length];
      const transparentColor = baseColor + (isDarkTheme ? '70' : 'AA');
      return createGradient(ctx, baseColor, transparentColor);
    });
    personAnalysisChart.data.datasets[0].borderColor = 'transparent';
    personAnalysisChart.data.datasets[0].borderWidth = 0;
    personAnalysisChart.data.datasets[0].borderRadius = 10; // ✨ Bordas arredondadas
    
    personAnalysisChart.options.scales.x.ticks.color = textColor;
    personAnalysisChart.options.scales.x.grid.color = gridColor;
    personAnalysisChart.options.scales.x.ticks.padding = 10;
    personAnalysisChart.options.scales.x.ticks.callback = function(value) {
      return formatCurrency(value);
    };
    
    personAnalysisChart.options.scales.y.ticks.color = textColor;
    personAnalysisChart.options.scales.y.grid.color = 'transparent';
    personAnalysisChart.options.scales.y.ticks.padding = 10;
    // ✨ MELHORIAS SEGURAS: Tipografia mais elegante
    personAnalysisChart.options.scales.y.ticks.font = {
      size: 13,
      weight: '500'
    };
    
    personAnalysisChart.update();
  }
  
  if (annualBarsChart) {
    const ctx = getCtx(annualBarsChart);
    
    // ✨ MELHORIAS SEGURAS: Gradientes mais elegantes
    const incomeGradient = createGradient(ctx, 
      '#16a34a', // Verde mais vibrante
      isDarkTheme ? '#16a34a60' : '#16a34a80'
    );
    
    const expenseGradient = createGradient(ctx, 
      '#dc2626', // Vermelho mais vibrante
      isDarkTheme ? '#dc262660' : '#dc262680'
    );
    
    annualBarsChart.data.datasets[0].backgroundColor = incomeGradient;
    annualBarsChart.data.datasets[0].borderColor = 'transparent';
    annualBarsChart.data.datasets[0].borderWidth = 0;
    annualBarsChart.data.datasets[0].borderRadius = 8; // ✨ Bordas arredondadas
    
    annualBarsChart.data.datasets[1].backgroundColor = expenseGradient;
    annualBarsChart.data.datasets[1].borderColor = 'transparent';
    annualBarsChart.data.datasets[1].borderWidth = 0;
    annualBarsChart.data.datasets[1].borderRadius = 8; // ✨ Bordas arredondadas
    
    annualBarsChart.options.scales.y.ticks.color = textColor;
    annualBarsChart.options.scales.y.grid.color = gridColor;
    annualBarsChart.options.scales.y.ticks.padding = 10;
    annualBarsChart.options.scales.y.ticks.callback = function(value) {
      return formatCurrency(value);
    };
    // ✨ MELHORIAS SEGURAS: Tipografia mais elegante
    annualBarsChart.options.scales.y.ticks.font = {
      size: 12,
      weight: '500'
    };
    
    annualBarsChart.options.scales.x.ticks.color = textColor;
    annualBarsChart.options.scales.x.grid.color = 'transparent';
    annualBarsChart.options.scales.x.ticks.padding = 10;
    annualBarsChart.options.scales.x.ticks.font = {
      size: 12,
      weight: '500'
    };
    
    annualBarsChart.update();
  }
  
  const legendItems = $$('.legend-item');
  legendItems.forEach(item => {
    if (isDarkTheme) {
      item.style.backgroundColor = 'rgba(60, 60, 60, 0.9)';
    } else {
      item.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    }
    const colorSpan = item.querySelector('.legend-color');
    if (colorSpan) {
        if (item.textContent.includes('Receitas')) {
            colorSpan.style.backgroundColor = 'var(--color-income)';
        } else if (item.textContent.includes('Despesas')) {
            colorSpan.style.backgroundColor = 'var(--color-expense)';
        }
    }
  });
};

// Função para criar os gráficos - VERSÃO CONSERVADORA E SEGURA
const createCharts = () => {
  const configCategoryExpenses = {
    type: 'bar',
    data: { 
      labels: [],
      datasets: [{
        data: [],
        label: 'Valor',
        borderRadius: 10, // ✨ MELHORIA SEGURA: Bordas arredondadas
        maxBarThickness: 50
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // ✨ MELHORIA SEGURA: Animações mais suaves
      animations: {
        tension: {
          duration: 1000,
          easing: 'easeOutQuart', // ✨ Easing mais suave
          from: 0.8,
          to: 0.2,
          loop: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          display: false  
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            display: false  
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  };
  
  const configCardUsage = {
    type: 'doughnut',
    data: {
      labels: ['Utilizado', 'Disponível'],
      datasets: [{
        data: [0, 0], 
        borderWidth: 3 // ✨ MELHORIA SEGURA: Borda mais fina
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      rotation: -90,
      circumference: 360,
      plugins: {
        legend: {
          display: false
        }
      },
      // ✨ MELHORIA SEGURA: Animação mais suave
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200,
        easing: 'easeOutQuart'
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  };
  
  const configFixedVsVariable = {
    type: 'pie',
    data: {
      labels: ['Fixas', 'Variáveis'],
      datasets: [{
        data: [],
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      // ✨ MELHORIA SEGURA: Animação mais suave
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200,
        easing: 'easeOutQuart'
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  };
  
  const configPersonAnalysis = {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        label: 'Valor',
        borderRadius: 10, // ✨ MELHORIA SEGURA: Bordas arredondadas
        maxBarThickness: 40
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          display: false  
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            padding: 10
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      // ✨ MELHORIA SEGURA: Animação mais suave
      animation: {
        delay: (context) => context.dataIndex * 100,
        duration: 800,
        easing: 'easeOutQuart'
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  };
  
  const configAnnualBars = {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Receitas',
          data: [],
          borderRadius: 8, // ✨ MELHORIA SEGURA: Bordas arredondadas
          maxBarThickness: 20
        },
        {
          label: 'Despesas',
          data: [],
          borderRadius: 8, // ✨ MELHORIA SEGURA: Bordas arredondadas
          maxBarThickness: 20
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          stacked: false,
          grid: {
            drawBorder: false,
            color: 'rgba(200, 200, 200, 0.1)'
          },
          ticks: {
            padding: 10,
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          stacked: false,
          ticks: {
            padding: 10
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false 
        }
      },
      // ✨ MELHORIA SEGURA: Animação mais suave
      animation: {
        delay: (context) => context.dataIndex * 80,
        duration: 1000,
        easing: 'easeOutQuart'
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }
  };
  
  if ($('#categoryExpensesChart')) categoryExpensesChart = new Chart($('#categoryExpensesChart').getContext('2d'), configCategoryExpenses);
  if ($('#cardUsageDonutChart')) cardUsageDonutChart = new Chart($('#cardUsageDonutChart').getContext('2d'), configCardUsage);
  if ($('#fixedVsVariableChart')) fixedVsVariableChart = new Chart($('#fixedVsVariableChart').getContext('2d'), configFixedVsVariable);
  if ($('#personAnalysisChart')) personAnalysisChart = new Chart($('#personAnalysisChart').getContext('2d'), configPersonAnalysis);
  if ($('#annualBars')) annualBarsChart = new Chart($('#annualBars').getContext('2d'), configAnnualBars);
  
  // Configurar eventos de hover para tooltips
  if ($('#categoryExpensesChart')) {
    $('#categoryExpensesChart').addEventListener('mousemove', (e) => {
      const points = categoryExpensesChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
      if (points.length) {
        const index = points[0].index;
        const value = categoryExpensesChart.data.datasets[0].data[index];
        const label = categoryExpensesChart.data.labels[index];
        showTooltip(categoryExpensesChart, `<strong>${label}</strong><br>${formatCurrency(value)}`, e);
      } else {
        hideTooltip();
      }
    });
    $('#categoryExpensesChart').addEventListener('mouseout', hideTooltip);
  }
  
  if ($('#cardUsageDonutChart')) {
    $('#cardUsageDonutChart').addEventListener('mousemove', (e) => {
      const points = cardUsageDonutChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
      if (points.length) {
        const index = points[0].index;
        const value = cardUsageDonutChart.data.datasets[0].data[index];
        const label = cardUsageDonutChart.data.labels[index];
        
        const totalForPercentage = cardUsageDonutChart.data.datasets[0].data.slice(0, 2).reduce((a, b) => a + b, 0);
        const percentage = totalForPercentage > 0 ? ((value / totalForPercentage) * 100).toFixed(1) : 0;
        
        let content = `<strong>${label}</strong><br>${formatCurrency(value)}`;
        
        if (index < 2) { 
          content += `<br>${percentage}% do limite`;
        }
        
        showTooltip(cardUsageDonutChart, content, e);
      } else {
        hideTooltip();
      }
    });
    $('#cardUsageDonutChart').addEventListener('mouseout', hideTooltip);
  }
  
  if ($('#fixedVsVariableChart')) {
    $('#fixedVsVariableChart').addEventListener('mousemove', (e) => {
      const points = fixedVsVariableChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
      if (points.length) {
        const index = points[0].index;
        const value = fixedVsVariableChart.data.datasets[0].data[index];
        const label = fixedVsVariableChart.data.labels[index];
        
        const total = fixedVsVariableChart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
        
        showTooltip(fixedVsVariableChart, `<strong>${label}</strong><br>${formatCurrency(value)}<br>${percentage}% do total`, e);
      } else {
        hideTooltip();
      }
    });
    $('#fixedVsVariableChart').addEventListener('mouseout', hideTooltip);
  }
  
  if ($('#personAnalysisChart')) {
    $('#personAnalysisChart').addEventListener('mousemove', (e) => {
      const points = personAnalysisChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
      if (points.length) {
        const index = points[0].index;
        const value = personAnalysisChart.data.datasets[0].data[index];
        const label = personAnalysisChart.data.labels[index];
        showTooltip(personAnalysisChart, `<strong>${label}</strong><br>${formatCurrency(value)}`, e);
      } else {
        hideTooltip();
      }
    });
    $('#personAnalysisChart').addEventListener('mouseout', hideTooltip);
  }
  
  if ($('#annualBars')) {
    $('#annualBars').addEventListener('mousemove', (e) => {
      const points = annualBarsChart.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
      if (points.length) {
        const index = points[0].index;
        const income = annualBarsChart.data.datasets[0].data[index] || 0;
        const expense = annualBarsChart.data.datasets[1].data[index] || 0;
        const month = annualBarsChart.data.labels[index];
        const balance = income - expense;
        
        let content = `<strong>${month}</strong><br>` +
                     `Receitas: ${formatCurrency(income)}<br>` +
                     `Despesas: ${formatCurrency(expense)}<br>` +
                     `<span style="color:${balance >= 0 ? 'var(--color-income)' : 'var(--color-error)'}">` +
                     `Saldo: ${formatCurrency(balance)}</span>`;
        
        showTooltip(annualBarsChart, content, e);
      } else {
        hideTooltip();
      }
    });
    $('#annualBars').addEventListener('mouseout', hideTooltip);
  }
  
  updateChartColors();
};

// Função para atualizar os dados dos gráficos - MANTIDA ORIGINAL
const updateCharts = () => {
  if (!categoryExpensesChart) createCharts();
  const currentMonthTransactions = state.filteredTransactions;

  // 1. Atualiza o gráfico de despesas por categoria
  const expenseCategories = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const catName = state.categories.expense.find(c => c.id === t.category)?.name || t.categoryName || 'Outros';
      const catIcon = state.categories.expense.find(c => c.id === t.category)?.icon || '';
      const displayName = catIcon ? `${catIcon} ${catName}` : catName;
      acc[displayName] = (acc[displayName] || 0) + parseFloat(t.amount);
      return acc;
    }, {});
    
  const sortedCategories = Object.entries(expenseCategories)
    .sort((a, b) => b[1] - a[1])
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
    
  categoryExpensesChart.data.labels = Object.keys(sortedCategories);
  categoryExpensesChart.data.datasets[0].data = Object.values(sortedCategories);
  
  categoryExpensesChart.options.animation = {
    y: { duration: 1000, from: 0 },
    x: { delay: (context) => context.dataIndex * 100 }
  };
  categoryExpensesChart.update();
  
  // 2. Atualiza o gráfico de uso do cartão de crédito - CORRIGIDO
  const totalLimitAllCards = state.cards.reduce((sum, c) => sum + parseFloat(c.limit || 0), 0);
  const totalAvailableAllCards = state.cards.reduce((sum, c) => sum + parseFloat(c.availableLimit || 0), 0);
  const totalUsedAllCards = totalLimitAllCards - totalAvailableAllCards;
  
  if (cardUsageDonutChart) {
    if (totalLimitAllCards > 0) {
      cardUsageDonutChart.data.labels = ['Utilizado', 'Disponível'];
      cardUsageDonutChart.data.datasets[0].data = [totalUsedAllCards, totalAvailableAllCards];
      
      const percentUsed = totalLimitAllCards > 0 ? Math.round((totalUsedAllCards / totalLimitAllCards) * 100) : 0;
      if($('.limit-value')) {
        $('.limit-value').textContent = `${percentUsed}%`;
        $('.limit-value').style.fontWeight = '600';
        $('.limit-value').style.fontSize = '24px';
        
        if (percentUsed > 80) {
          $('.limit-value').style.color = '#dc2626';
        } else if (percentUsed > 60) {
          $('.limit-value').style.color = '#d97706';
        } else {
          $('.limit-value').style.color = '#16a34a';
        }
      }
    } else {
      cardUsageDonutChart.data.labels = ['Nenhum Limite'];
      cardUsageDonutChart.data.datasets[0].data = [1];
      if ($('.limit-value')) {
        $('.limit-value').textContent = `0%`;
        $('.limit-value').style.color = getComputedStyle(document.documentElement).getPropertyValue('--color-on-surface').trim();
      }
    }
    cardUsageDonutChart.options.animation = { animateRotate: true, animateScale: true, duration: 1000 };
    cardUsageDonutChart.update();
  }
  
  // 3. Atualiza o gráfico de despesas fixas vs variáveis
  const fixed = currentMonthTransactions
    .filter(t => t.type === 'expense' && t.isFixed === 'fixed')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
    
  const variable = currentMonthTransactions
    .filter(t => t.type === 'expense' && t.isFixed === 'variable')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
    
  fixedVsVariableChart.data.datasets[0].data = [fixed, variable];
  fixedVsVariableChart.options.animation = { animateRotate: true, animateScale: true, duration: 1000 };
  fixedVsVariableChart.update();
  
  // 4. Atualiza o gráfico de despesas por pessoa
  const personExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense' && t.person)
    .reduce((acc, t) => {
      const person = state.people.find(p => p.id === t.person);
      const personName = person ? `${person.icon || ''} ${person.name}` : 'Não atribuído';
      acc[personName] = (acc[personName] || 0) + parseFloat(t.amount);
      return acc;
    }, {});
    
  const sortedPersons = Object.entries(personExpenses)
    .sort((a, b) => b[1] - a[1])
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
    
  personAnalysisChart.data.labels = Object.keys(sortedPersons);
  personAnalysisChart.data.datasets[0].data = Object.values(sortedPersons);
  personAnalysisChart.options.animation = {
    x: { duration: 1000, from: 0 },
    y: { delay: (context) => context.dataIndex * 100 }
  };
  personAnalysisChart.update();
  
  // 5. Atualiza o gráfico anual de receitas x despesas
  const annualData = Array(12).fill(null).map(() => ({ income: 0, expense: 0 }));
  const todayForAnnual = new Date(Date.UTC(state.year, state.month, 1));
  
  state.transactions.forEach(t => {
    const tLaunchDate = parseLocalDateString(t.date);
    if (!tLaunchDate) return;
    
    let effectiveDateForAnnualChart = tLaunchDate;
    
    if (t.type === 'expense') {
      if (t.paymentMethod === 'credito' && t.creditCardId) {
        const card = state.cards.find(c => c.id === t.creditCardId);
        if (card) {
          const realDueDate = calcularVencimentoReal(tLaunchDate, card);
          if (realDueDate) effectiveDateForAnnualChart = realDueDate;
        }
      } else if (t.dueDate) {
        const explicitDueDate = parseLocalDateString(t.dueDate);
        if (explicitDueDate) effectiveDateForAnnualChart = explicitDueDate;
      }
    }
    
    const monthDiff = (todayForAnnual.getUTCFullYear() - effectiveDateForAnnualChart.getUTCFullYear()) * 12 + 
                    (todayForAnnual.getUTCMonth() - effectiveDateForAnnualChart.getUTCMonth());
    
    if (monthDiff >= 0 && monthDiff < 12) {
      const indexInAnnualArray = 11 - monthDiff;
      if (t.type === 'income') annualData[indexInAnnualArray].income += parseFloat(t.amount);
      else if (t.type === 'expense') annualData[indexInAnnualArray].expense += parseFloat(t.amount);
    }
  });
  
  annualBarsChart.data.labels = Array(12).fill(null).map((_, i) => {
    const d = new Date(todayForAnnual);
    d.setUTCMonth(todayForAnnual.getUTCMonth() - (11 - i));
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  });
  
  annualBarsChart.data.datasets[0].data = annualData.map(d => d.income);
  annualBarsChart.data.datasets[1].data = annualData.map(d => d.expense);
  annualBarsChart.options.animation = {
    y: { duration: 1000, easing: 'easeOutQuad', from: 0 },
    delay: (context) => context.dataIndex * 100
  };
  annualBarsChart.update();
  
  updateChartColors();
};