// Caixa de Brinquedos da Interface - Todas as funções que fazem a mágica visual ✨

// Função para atualizar todas as listas e seleções
const updateAllSelectsAndLists = () => {
  updateCategorySelects();
  updatePaymentMethodSelects();
  updatePeopleSelects();
  updateInvestmentCategorySelects(); 
  renderCategoriesList(); 
  renderPaymentMethodsList();
  renderInvestmentCategoriesList();
  updatePeopleList();
};

// Função para atualizar as listas de categorias nos formulários
const updateCategorySelects = () => {
  const populateSelect = (selectEl, categories) => {
    if (selectEl) {
      const currentValue = selectEl.value;
      selectEl.innerHTML = '<option value="">Selecione...</option>';
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = `${category.icon || ''} ${category.name}`; 
        selectEl.appendChild(option);
      });
      if (categories.find(c => c.id === currentValue)) {
          selectEl.value = currentValue;
      }
    }
  };
  populateSelect($('#incomeCategory'), state.categories.income);
  populateSelect($('#expenseCategory'), state.categories.expense);
  
  const editCategorySelect = $('#editCategory');
  if (editCategorySelect && state.currentTransaction) {
      const categories = state.currentTransaction.type === 'income' ? state.categories.income : state.categories.expense;
      populateSelect(editCategorySelect, categories);
      editCategorySelect.value = state.currentTransaction.category;
  }
};

// Função para atualizar as listas de formas de pagamento
const updatePaymentMethodSelects = () => {
  const selects = [$('#incomePaymentMethod'), $('#expensePaymentMethod'), $('#editPaymentMethod')];
  selects.forEach(selectEl => {
    if (selectEl) {
      const currentValue = selectEl.value;
      selectEl.innerHTML = '<option value="">Selecione...</option>';
      state.paymentMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = `${method.icon || ''} ${method.name}`;
        selectEl.appendChild(option);
      });
       if (state.paymentMethods.find(m => m.id === currentValue)) {
          selectEl.value = currentValue;
      }
    }
  });
};

// Função para atualizar as listas de pessoas
const updatePeopleSelects = () => {
  const selects = [$('#expensePerson'), $('#editPerson')];
  selects.forEach(selectEl => {
    if (selectEl) {
      const currentValue = selectEl.value;
      selectEl.innerHTML = '<option value="">Ninguém</option>'; 
      state.people.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = `${person.icon || ''} ${person.name}`;
        selectEl.appendChild(option);
      });
      if (state.people.find(p => p.id === currentValue)) {
          selectEl.value = currentValue;
      }
    }
  });
};

// Função para atualizar as listas de categorias de investimento
const updateInvestmentCategorySelects = () => {
  const selectEl = $('#investmentCategorySelect'); 
  if (selectEl) {
      const currentValue = selectEl.value;
      selectEl.innerHTML = '<option value="">Selecione...</option>';
      state.categories.investment.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = `${category.icon || ''} ${category.name}`;
          selectEl.appendChild(option);
      });
      if (state.categories.investment.find(c => c.id === currentValue)) {
          selectEl.value = currentValue;
      }
  }
};

// Função para atualizar as listas de cartões
const updateCardsList = () => {
  const listEl = $('#cardsList');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (state.cards.length === 0) {
    listEl.innerHTML = '<p style="text-align: center;">Nenhum cartão cadastrado.</p>';
    return;
  }
  state.cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card'; 
      cardEl.style.marginBottom = 'var(--spacing-md)';
      
      const faturaVencimentoNoMesSelecionado = new Date(Date.UTC(state.year, state.month, card.dueDay));
      const { previousClosing, currentClosingDate } = getInvoicePeriod(card, faturaVencimentoNoMesSelecionado);

      let currentInvoiceAmountForMonth = 0;
      if (previousClosing && currentClosingDate) {
          const currentInvoiceTransactions = state.transactions.filter(t => {
              const tLaunchDate = parseLocalDateString(t.date);
              return t.type === 'expense' &&
                     t.paymentMethod === 'credito' &&
                     t.creditCardId === card.id &&
                     tLaunchDate >= previousClosing &&
                     tLaunchDate < currentClosingDate;
          });
          currentInvoiceAmountForMonth = currentInvoiceTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      const limitPercentage = card.limit > 0 ? ((card.limit - card.availableLimit) / card.limit) * 100 : 0;
      const melhorDia = calcularMelhorDiaCompras(card);
      const nomeMesFatura = new Date(state.year, state.month).toLocaleDateString('pt-BR', {month: 'long'});

      cardEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
              <h3>${card.name}</h3>
              <div>
                  <button class="btn btn-icon btn-outline edit-card-btn" data-id="${card.id}" aria-label="Editar"><svg width="16" height="16"><use href="#icon-edit"></use></svg></button>
                  <button class="btn btn-icon btn-outline delete-card-btn" data-id="${card.id}" aria-label="Excluir"><svg width="16" height="16"><use href="#icon-trash"></use></svg></button>
              </div>
          </div>
          <div>Limite: ${formatCurrency(card.limit)} | Disponível: ${formatCurrency(card.availableLimit)}</div>
          <div class="commitment-progress" style="margin: var(--spacing-xs) 0;">
              <div class="commitment-progress-bar" style="width: ${limitPercentage.toFixed(0)}%; background-color: ${limitPercentage > 80 ? 'var(--color-error)' : 'var(--color-primary)'};"></div>
          </div>
          <div><small>Sua Fatura fecha: dia ${card.closingDay} | Vencimento: dia ${card.dueDay}</small></div>
          <div><small>Fatura de ${nomeMesFatura}: ${formatCurrency(currentInvoiceAmountForMonth)}</small></div>
          ${melhorDia ? `<div><small style="color: var(--color-info);">Melhor dia p/ compra: dia ${melhorDia}</small></div>` : ''}
          <button class="btn btn-primary view-invoice-btn" data-id="${card.id}" style="margin-top: var(--spacing-sm);">Ver Fatura de ${new Date(state.year, state.month).toLocaleDateString('pt-BR', {month: 'short'})}</button>
      `;
      listEl.appendChild(cardEl);
  });
  
  // Conectar os botões
  $$('#cardsList .edit-card-btn').forEach(btn => btn.addEventListener('click', e => {
      const cardToEdit = state.cards.find(c => c.id === e.currentTarget.dataset.id);
      if(cardToEdit) openEditCardModal(cardToEdit);
  }));
  $$('#cardsList .delete-card-btn').forEach(btn => btn.addEventListener('click', e => deleteCard(e.currentTarget.dataset.id)));
  $$('#cardsList .view-invoice-btn').forEach(btn => btn.addEventListener('click', e => openCardInvoice(e.currentTarget.dataset.id)));
};

// Função para atualizar as listas de cartões de crédito nos formulários
const updateCreditCardSelects = () => {
  const selects = [$('#expenseCreditCard'), $('#editCreditCard')];
  selects.forEach(selectEl => {
    if (selectEl) {
      const currentValue = selectEl.value;
      selectEl.innerHTML = '';
      if (state.cards.length === 0) {
        selectEl.innerHTML = '<option value="" disabled selected>Nenhum cartão</option>';
      } else {
        selectEl.innerHTML = '<option value="">Selecione o cartão...</option>';
        state.cards.forEach(card => {
          const option = document.createElement('option');
          option.value = card.id;
          option.textContent = `${card.name} (Disp: ${formatCurrency(card.availableLimit)})`;
          selectEl.appendChild(option);
        });
      }
      if (state.cards.find(c => c.id === currentValue)) {
          selectEl.value = currentValue;
      }
    }
  });
};

// Função para abrir o modal de edição de cartão
const openEditCardModal = (card) => {
  if (!card) return;
  state.currentCard = card;
  $('#cardName').value = card.name;
  $('#cardLimit').value = card.limit;
  $('#cardClosingDay').value = card.closingDay;
  $('#cardDueDay').value = card.dueDay;
  $('.modal-title', $('#newCardModal')).textContent = 'Editar Cartão';
  $('#saveCardBtn').textContent = 'Salvar Alterações';
  $('#saveCardBtn').dataset.id = card.id;
  closeModal('cardsListModal');
  openModal('newCardModal');
};

// Função para atualizar ano nas opções
const updateYearOptions = () => {
  const yearSelect = $('#yearSelect');
  if (yearSelect) {
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 2; year <= currentYear + 5; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      option.selected = year === state.year;
      yearSelect.appendChild(option);
    }
  }
};

// Função para atualizar dados da página inteira
async function fullUIRefresh() {
  filterTransactionsByMonth(); 
  updateTransactionsTable(); 
  updateKPIs();             
  updateCharts();          
  updateCardsList();             
  updateCreditCardSelects();     
  renderCommitments();           
  generateInsights();            
  renderCategoriesList();        
  renderExpenseCategoriesList(); 
  renderInvestmentCategoriesList(); 
  renderPaymentMethodsList();    
  updatePeopleList();            
  updateCategorySelects();
  updatePaymentMethodSelects();
  updatePeopleSelects();
  updateInvestmentCategorySelects();
}

// Função para filtrar transações por mês
const filterTransactionsByMonth = () => {
  state.filteredTransactions = state.transactions.filter(transaction => {
      const transactionLaunchDate = parseLocalDateString(transaction.date); 
      if (!transactionLaunchDate) return false;

      let effectiveDateForFilter = transactionLaunchDate;

      if (transaction.type === 'expense') { 
          if (transaction.paymentMethod === 'credito' && transaction.creditCardId) {
              const card = state.cards.find(c => c.id === transaction.creditCardId);
              if (card) {
                  const realDueDate = calcularVencimentoReal(transactionLaunchDate, card);
                  if (realDueDate) effectiveDateForFilter = realDueDate;
              }
          } else if (transaction.dueDate) { 
              const explicitDueDate = parseLocalDateString(transaction.dueDate);
              if (explicitDueDate) effectiveDateForFilter = explicitDueDate;
          }
      }
      
      return effectiveDateForFilter.getUTCMonth() === state.month && 
             effectiveDateForFilter.getUTCFullYear() === state.year;
  });
};

// Função para atualizar título mês/ano
const updateMonthYearTitle = () => {
  // O título agora é implícito pelos selects de ano/mês
};

// Função para atualizar os valores principais (KPIs)
const updateKPIs = () => {
  filterTransactionsByMonth(); 
  const currentMonthTransactions = state.filteredTransactions;

  const totalIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const incomeReceived = currentMonthTransactions.filter(t => t.type === 'income' && t.status === 'received').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const incomePending = totalIncome - incomeReceived;
  const expensePaid = currentMonthTransactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const expensePending = totalExpense - expensePaid;

  const saldoReal = incomeReceived - expensePaid;
  const saldoComprometido = totalIncome - totalExpense;

  $('#incomeValue').textContent = formatCurrency(totalIncome);
  $('#expenseValue').textContent = formatCurrency(totalExpense); 
  $('#balanceValue').textContent = formatCurrency(saldoReal);
  if($('.kpi-balance .kpi-subtitle span')) $('.kpi-balance .kpi-subtitle span').textContent = `Saldo comprometido: ${formatCurrency(saldoComprometido)}`;
  $('#incomeReceivedValue').textContent = `${formatCurrency(incomeReceived)} recebidos`;
  $('#incomePendingValue').textContent = `${formatCurrency(incomePending)} pendentes`;
  $('#expensePaidValue').textContent = `${formatCurrency(expensePaid)} pagos`;
  $('#expensePendingValue').textContent = `${formatCurrency(expensePending)} pendentes`;

  let totalCardDueThisMonth = 0; 
  let earliestCardDueDateThisMonth = null; 

  state.transactions.forEach(t => {
      if (t.type === 'expense' && t.paymentMethod === 'credito') {
          const effectiveDueDate = getEffectiveDueDateForSort(t); 
          if (effectiveDueDate &&
              effectiveDueDate.getUTCMonth() === state.month &&
              effectiveDueDate.getUTCFullYear() === state.year) {
              totalCardDueThisMonth += parseFloat(t.amount);
              if (!earliestCardDueDateThisMonth || effectiveDueDate < earliestCardDueDateThisMonth) {
                  earliestCardDueDateThisMonth = effectiveDueDate;
              }
          }
      }
  });
  $('#invoiceValue').textContent = formatCurrency(totalCardDueThisMonth); 
  $('#invoiceDueDate').textContent = earliestCardDueDateThisMonth ? formatDate(earliestCardDueDateThisMonth) : '--/--/----';
};

// Função para renderizar listas genéricas
const renderGenericList = (containerId, items, type, editFn, deleteFn, nameField = 'name', iconField = 'icon') => {
  const listEl = $(`#${containerId}`);
  if (!listEl) return;
  listEl.innerHTML = '';
  items.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'category-item';
    itemEl.dataset.id = item.id;
    itemEl.dataset.type = type;
    itemEl.innerHTML = `
      <div class="category-item-content">
        <div class="category-item-icon">${item[iconField] || '●'}</div>
        <div>${item[nameField]}</div>
      </div>
      <div class="category-item-actions">
        <button class="btn btn-icon btn-outline edit-item-btn" aria-label="Editar"><svg width="16" height="16"><use href="#icon-edit"></use></svg></button>
        <button class="btn btn-icon btn-outline delete-item-btn" aria-label="Excluir"><svg width="16" height="16"><use href="#icon-trash"></use></svg></button>
      </div>`;
    listEl.appendChild(itemEl);
    itemEl.querySelector('.edit-item-btn').addEventListener('click', () => editFn(item, type));
    itemEl.querySelector('.delete-item-btn').addEventListener('click', () => deleteFn(item.id, type));
  });
};

// Funções para renderizar listas específicas
const renderCategoriesList = () => renderGenericList('incomeCategoriesList', state.categories.income, 'income', openEditCategoryModal, deleteCategory);
const renderExpenseCategoriesList = () => renderGenericList('expenseCategoriesList', state.categories.expense, 'expense', openEditCategoryModal, deleteCategory); 
const renderInvestmentCategoriesList = () => renderGenericList('investmentCategoriesList', state.categories.investment, 'investment', openEditCategoryModal, deleteCategory);
const renderPaymentMethodsList = () => renderGenericList('paymentMethodsList', state.paymentMethods, 'paymentMethod', openEditCategoryModal, deletePaymentMethod);
const updatePeopleList = () => renderGenericList('peopleList', state.people, 'person', openEditCategoryModal, deletePerson);

// Função para abrir modal de edição de categoria
const openEditCategoryModal = (item, type) => {
  state.currentCategory = item; 
  $('#editCategoryId').value = item.id;
  $('#editCategoryType').value = type; 
  $('#editCategoryName').value = item.name;
  $('#editCategoryIconInput').value = item.icon || '';
  $('#editCategoryIconPreview').innerHTML = item.icon || '●';
  const titles = {'income':'Editar Categoria de Receita', 'expense':'Editar Categoria de Despesa', 'investment':'Editar Categoria de Investimento', 'paymentMethod':'Editar Forma de Pagamento', 'person':'Editar Pessoa'};
  $('#editCategoryTitle').textContent = titles[type] || 'Editar Item';
  openModal('editCategoryModal');
};

// Função para renderizar investimentos
const renderInvestmentCards = () => {
  const grid = $('#investmentsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (state.investments.length === 0) {
    grid.innerHTML = '<p style="text-align: center; padding: var(--spacing-md);">Nenhum investimento.</p>';
    return;
  }
  state.investments.forEach(inv => {
    const contributions = state.investmentContributions.filter(c => c.investmentId === inv.id);
    const totalContributed = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0) + parseFloat(inv.amount || 0);
    const category = state.categories.investment.find(c => c.id === inv.category);
    const hasGoal = inv.goal && parseFloat(inv.goal) > 0;
    const progress = hasGoal ? Math.min(100, (totalContributed / parseFloat(inv.goal)) * 100) : 0;

    const cardEl = document.createElement('div');
    cardEl.className = 'investment-card card'; 
    cardEl.dataset.id = inv.id;
    cardEl.innerHTML = `
      <div class="investment-card-header">
        <h3 class="investment-card-title">${inv.name}</h3>
        <span class="badge" style="font-size: var(--font-size-xs);">${category ? `${category.icon} ${category.name}` : 'N/A'}</span>
      </div>
      <div class="investment-card-body">
        <div>Guardado: <strong>${formatCurrency(totalContributed)}</strong></div>
        ${hasGoal ? `<div>Meta: <strong>${formatCurrency(inv.goal)}</strong></div>` : ''}
        ${hasGoal ? `
          <div class="investment-progress">
            <div class="investment-progress-bar"><div class="investment-progress-fill" style="width: ${progress.toFixed(0)}%;"></div></div>
            <div class="investment-progress-text"><span>${progress.toFixed(0)}%</span> ${inv.targetDate ? `<span>Até: ${formatDate(inv.targetDate)}</span>` : ''}</div>
          </div>` : ''}
      </div>
      <div class="investment-card-footer">
        <small>Criado em: ${formatDate(inv.createdAt)}</small>
        <div>
          <button class="btn btn-icon btn-outline edit-investment-btn" aria-label="Editar"><svg width="16" height="16"><use href="#icon-edit"></use></svg></button>
          <button class="btn btn-icon btn-outline delete-investment-btn" aria-label="Excluir"><svg width="16" height="16"><use href="#icon-trash"></use></svg></button>
        </div>
      </div>`;
    cardEl.addEventListener('click', (e) => {
      if (!e.target.closest('.edit-investment-btn') && !e.target.closest('.delete-investment-btn')) {
        openInvestmentDetail(inv.id);
      }
    });
    grid.appendChild(cardEl);
  });
  $$('#investmentsGrid .edit-investment-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation(); openEditInvestmentModal(e.currentTarget.closest('.investment-card').dataset.id);
  }));
  $$('#investmentsGrid .delete-investment-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation(); if (confirm('Excluir este investimento e todos os aportes?')) deleteInvestment(e.currentTarget.closest('.investment-card').dataset.id);
  }));
};