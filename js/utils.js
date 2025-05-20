// Funções Auxiliares - Nossos pequenos ajudantes

// Formatar valores em reais
const formatCurrency = value => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

// Converter datas para o formato certo
const parseLocalDateString = (dateInput) => {
  if (dateInput instanceof Date && !isNaN(dateInput)) return new Date(Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate()));
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)); 
  }
  return null;
};

// Formatar datas para mostrar na tela
const formatDate = (date, options = {}) => {
  const dateObj = parseLocalDateString(date);
  if (!dateObj) return '--/--/----';
  return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC', ...options });
};

// Converter data para string
const localDateToISOString = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : parseLocalDateString(date);
  if (!d) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Gerar IDs únicos
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Funções para encontrar elementos na página
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

// Mostrar mensagens na tela
const showToast = (message, type = 'success') => {
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let iconName = type === 'success' ? 'icon-check' : type === 'error' ? 'icon-x' : type === 'warning' ? 'icon-alert' : 'icon-info';
  toast.innerHTML = `<div class="toast-icon"><svg width="24" height="24"><use href="#${iconName}"></use></svg></div><div class="toast-content">${message}</div><button class="toast-close" aria-label="Fechar"><svg width="16" height="16"><use href="#icon-x"></use></svg></button>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
};

// Abrir e fechar janelinhas pop-up
const openModal = modalId => {
  const modal = $(`#${modalId}`);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

const closeModal = modalId => {
  const modal = $(`#${modalId}`);
  if (modal) {
    modal.classList.remove('active');
    if (!$$('.modal-backdrop.active').length) { 
      document.body.style.overflow = '';
    }
  }
};

// Lidar com datas em campos de formulário
const setDateInputValue = (inputId, date) => {
  const input = $(`#${inputId}`);
  if (input) input.value = localDateToISOString(date);
};

const getDateInputValue = inputId => {
  const input = $(`#${inputId}`);
  return input && input.value ? parseLocalDateString(input.value) : null;
};

// Trocar entre tema claro e escuro
  const toggleTheme = () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    state.themePreference = newTheme;
    localStorage.setItem('themePreference', newTheme);
    updateChartColors();
  };

// Inicializar tema
  const initTheme = () => {
    const savedTheme = localStorage.getItem('themePreference') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    state.themePreference = savedTheme;
    $('#themeToggle').addEventListener('click', toggleTheme);
  };