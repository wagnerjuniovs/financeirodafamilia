  const closeAllModals = () => {
    $$('.modal-backdrop.active').forEach(modal => closeModal(modal.id));
  };

  const calcularVencimentoReal = (dataCompraInput, cartao) => {
    if (!dataCompraInput || !cartao || !cartao.closingDay || !cartao.dueDay) return null;
    
    const compraDate = parseLocalDateString(dataCompraInput);
    if (!compraDate) return null;

    const compraDay = compraDate.getUTCDate();
    let mesFechamentoFatura = compraDate.getUTCMonth(); 
    let anoFechamentoFatura = compraDate.getUTCFullYear();

    if (compraDay > cartao.closingDay) {
        mesFechamentoFatura++;
        if (mesFechamentoFatura > 11) {
            mesFechamentoFatura = 0;
            anoFechamentoFatura++;
        }
    }

    let mesVencimentoFinal = mesFechamentoFatura;
    let anoVencimentoFinal = anoFechamentoFatura;

    if (cartao.dueDay < cartao.closingDay) {
        mesVencimentoFinal++;
        if (mesVencimentoFinal > 11) {
            mesVencimentoFinal = 0;
            anoVencimentoFinal++;
        }
    }
    return new Date(Date.UTC(anoVencimentoFinal, mesVencimentoFinal, cartao.dueDay));
  };
  
  const calcularMelhorDiaCompras = (cartao) => {
    if (!cartao || !cartao.closingDay) return null;
    const dataFechamentoNoMesAtual = new Date(Date.UTC(state.year, state.month, cartao.closingDay));
    const dataMelhorDia = new Date(dataFechamentoNoMesAtual);
    dataMelhorDia.setUTCDate(dataFechamentoNoMesAtual.getUTCDate() + 1);
    return dataMelhorDia.getUTCDate();
  };

  const handleStatusField = (formPrefix) => {
    const paymentMethodEl = $(`#${formPrefix}PaymentMethod`);
    const isRecurrentEl = $(`#${formPrefix}IsRecurrent`);
    const statusGroupEl = $(`#${formPrefix}StatusGroup`);
    const statusPendingRadio = $(`#${formPrefix}StatusPending`); 

    if (!paymentMethodEl || !statusGroupEl || !statusPendingRadio) return;
    
    const isCreditCard = paymentMethodEl.value === 'credito';
    const isRecurrent = isRecurrentEl ? isRecurrentEl.checked : false;

    if (isCreditCard || (isRecurrent && formPrefix.includes('expense'))) { 
        statusGroupEl.style.display = 'none';
        statusPendingRadio.checked = true;
    } else if (isRecurrent && formPrefix.includes('income')) { 
        statusGroupEl.style.display = 'none';
        statusPendingRadio.checked = true; 
    } else {
        statusGroupEl.style.display = 'block'; 
    }
  };

  async function updateCardLimits(cardId, transactionAmount, operation, oldTransactionAmount = 0) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    let amountChange = 0;
    if (operation === 'add') {
        amountChange = transactionAmount;
    } else if (operation === 'subtract') {
        amountChange = -transactionAmount;
    } else if (operation === 'update') {
        amountChange = transactionAmount - oldTransactionAmount;
    }

    card.currentInvoice = (card.currentInvoice || 0) + amountChange;
    card.currentInvoice = Math.max(0, card.currentInvoice); 
    card.availableLimit = card.limit - card.currentInvoice;

    try {
        await db.collection('cards').doc(card.id).update({
            currentInvoice: card.currentInvoice, 
            availableLimit: card.availableLimit
        });
    } catch (error) {
        console.error("Error updating card limits in DB:", error);
        showToast('Erro ao atualizar limite do cartão.', 'error');
    }
    updateCreditCardSelects();
  }

  const addCard = async (cardData) => {
    try {
      const card = {
        ...cardData,
        currentInvoice: 0, 
        availableLimit: cardData.limit, 
        createdAt: localDateToISOString(new Date())
      };
      const docRef = await db.collection('cards').add(card);
      card.id = docRef.id;
      state.cards.push(card);
      await fullUIRefresh(); 
      showToast('Cartão adicionado!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error);
      showToast('Erro ao adicionar cartão.', 'error');
    }
  };

  const updateCard = async (cardId, updates) => {
    try {
      if (updates.limit !== undefined) {
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
            updates.availableLimit = updates.limit - (card.currentInvoice || 0);
        }
      }
      await db.collection('cards').doc(cardId).update(updates);
      const index = state.cards.findIndex(c => c.id === cardId);
      if (index !== -1) state.cards[index] = { ...state.cards[index], ...updates };
      await fullUIRefresh(); 
      showToast('Cartão atualizado!', 'success');
    } catch (error) {
      console.error('Erro ao atualizar cartão:', error);
      showToast('Erro ao atualizar cartão.', 'error');
    }
  };

  const deleteCard = async (cardId) => {
    try {
      if (!confirm('Tem certeza que deseja excluir este cartão? Transações associadas não serão alteradas, mas perderão o vínculo com este cartão.')) return;

      await db.collection('cards').doc(cardId).delete();
      state.cards = state.cards.filter(c => c.id !== cardId);
      const batch = db.batch();
      let changed = false;
      state.transactions.forEach(t => {
        if (t.creditCardId === cardId) {
            batch.update(db.collection('transactions').doc(t.id), { creditCardId: null, creditCardName: null });
            t.creditCardId = null; t.creditCardName = null;
            changed = true;
        }
      });
      if (changed) await batch.commit();

      await fullUIRefresh(); 
      showToast('Cartão excluído!', 'success');
    } catch (error) {
      console.error('Erro ao excluir cartão:', error);
      showToast('Erro ao excluir cartão.', 'error');
    }
  };

  const payCardInvoice = async (cardId) => {
    try {
      const card = state.cards.find(c => c.id === cardId);
      if (!card) return;

      const faturaVencimentoRef = new Date(Date.UTC(state.year, state.month, card.dueDay));
      const { previousClosing, currentClosingDate } = getInvoicePeriod(card, faturaVencimentoRef);

      const batch = db.batch();
      let totalFaturaPagaEsteMes = 0;

      state.transactions.forEach(t => {
        if (t.type === 'expense' && t.paymentMethod === 'credito' && t.creditCardId === cardId) {
          const dataCompra = parseLocalDateString(t.date);
          if (dataCompra >= previousClosing && dataCompra < currentClosingDate && t.status !== 'paid') {
            const docRef = db.collection('transactions').doc(t.id);
            batch.update(docRef, { status: 'paid' });
            t.status = 'paid'; 
            totalFaturaPagaEsteMes += parseFloat(t.amount);
          }
        }
      });
      
      if (totalFaturaPagaEsteMes > 0) {
        card.currentInvoice = Math.max(0, (card.currentInvoice || 0) - totalFaturaPagaEsteMes);
        card.availableLimit = card.limit - card.currentInvoice;
        batch.update(db.collection('cards').doc(card.id), {
            currentInvoice: card.currentInvoice,
            availableLimit: card.availableLimit
        });
      }
      
      await batch.commit();
      await fullUIRefresh(); 
      closeModal('payInvoiceConfirmModal');
      showToast('Fatura paga com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao pagar fatura:', error);
      showToast('Erro ao pagar fatura.', 'error');
    }
  };

  const openInvestmentDetail = (investmentId) => {
    const investment = state.investments.find(i => i.id === investmentId);
    if (!investment) return;
    state.currentInvestment = investment;
    const contributions = state.investmentContributions.filter(c => c.investmentId === investment.id);
    const totalContributed = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0) + parseFloat(investment.amount || 0);
    const category = state.categories.investment.find(c => c.id === investment.category);
    const hasGoal = investment.goal && parseFloat(investment.goal) > 0;
    const progress = hasGoal ? Math.min(100, (totalContributed / parseFloat(investment.goal)) * 100) : 0;

    $('#investmentDetailName').textContent = investment.name;
    $('#investmentDetailSaved').textContent = formatCurrency(totalContributed);
    $('#investmentDetailGoal').textContent = hasGoal ? formatCurrency(investment.goal) : 'N/A';
    $('#investmentDetailProgress').textContent = hasGoal ? `${progress.toFixed(0)}%` : 'N/A';
    $('#investmentDetailCategory').textContent = category ? `${category.icon} ${category.name}` : 'N/A';
    $('#investmentDetailCreatedAt').textContent = formatDate(investment.createdAt);
    $('#investmentDetailTarget').textContent = investment.targetDate ? formatDate(investment.targetDate) : 'N/A';
    $('#investmentDetailNotes').textContent = investment.notes || '-';
    renderInvestmentContributions(investmentId);
    closeModal('investmentsModal');
    openModal('investmentDetailModal');
  };

  const renderInvestmentContributions = (investmentId) => {
    const tableBody = $('#investmentHistoryTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const investment = state.investments.find(i => i.id === investmentId);
    let allContributions = [];
    if (investment && parseFloat(investment.amount) > 0) {
        allContributions.push({ id: 'initial', date: investment.createdAt, amount: investment.amount, description: 'Depósito inicial', isInitial: true });
    }
    allContributions = allContributions.concat(state.investmentContributions.filter(c => c.investmentId === investmentId));
    allContributions.sort((a, b) => parseLocalDateString(b.date) - parseLocalDateString(a.date));

    if (allContributions.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum aporte.</td></tr>';
      return;
    }
    allContributions.forEach(c => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${formatDate(c.date)}</td>
        <td>${formatCurrency(c.amount)}</td>
        <td>${c.description || '-'}</td>
        <td class="actions-cell">
          ${c.isInitial ? '-' : `
            <button class="btn btn-icon btn-outline edit-contribution-btn" data-id="${c.id}" aria-label="Editar"><svg width="16" height="16"><use href="#icon-edit"></use></svg></button>
            <button class="btn btn-icon btn-outline delete-contribution-btn" data-id="${c.id}" aria-label="Excluir"><svg width="16" height="16"><use href="#icon-trash"></use></svg></button>
          `}
        </td>`;
    });
    $$('#investmentHistoryTableBody .edit-contribution-btn').forEach(btn => btn.addEventListener('click', (e) => openEditContributionModal(e.currentTarget.dataset.id)));
    $$('#investmentHistoryTableBody .delete-contribution-btn').forEach(btn => btn.addEventListener('click', (e) => { if (confirm('Excluir este aporte?')) deleteContribution(e.currentTarget.dataset.id); }));
  };

  const addInvestment = async (data) => {
    try {
      const investment = { ...data, createdAt: localDateToISOString(new Date()) };
      const docRef = await db.collection('investments').add(investment);
      investment.id = docRef.id;
      state.investments.push(investment);
      await fullUIRefresh(); 
      showToast('Investimento adicionado!', 'success');
      return investment;
    } catch (e) { console.error(e); showToast('Erro ao adicionar investimento.', 'error'); return null; }
  };
  const updateInvestment = async (id, data) => {
    try {
      await db.collection('investments').doc(id).update(data);
      const index = state.investments.findIndex(i => i.id === id);
      if (index !== -1) state.investments[index] = { ...state.investments[index], ...data };
      await fullUIRefresh(); 
      showToast('Investimento atualizado!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao atualizar investimento.', 'error'); return false; }
  };
  const deleteInvestment = async (id) => {
    try {
      const batch = db.batch();
      batch.delete(db.collection('investments').doc(id));
      state.investmentContributions.filter(c => c.investmentId === id).forEach(c => batch.delete(db.collection('investmentContributions').doc(c.id)));
      await batch.commit();
      state.investments = state.investments.filter(i => i.id !== id);
      state.investmentContributions = state.investmentContributions.filter(c => c.investmentId !== id);
      await fullUIRefresh(); 
      if ($('#investmentDetailModal').classList.contains('active') && state.currentInvestment?.id === id) {
        closeModal('investmentDetailModal');
        openModal('investmentsModal');
      }
      showToast('Investimento excluído!', 'success');
    } catch (e) { console.error(e); showToast('Erro ao excluir investimento.', 'error'); }
  };
  const addContribution = async (data) => {
    try {
      const contribution = { ...data, createdAt: localDateToISOString(new Date()) };
      const docRef = await db.collection('investmentContributions').add(contribution);
      contribution.id = docRef.id;
      state.investmentContributions.push(contribution);
      await fullUIRefresh(); 
      if ($('#investmentDetailModal').classList.contains('active') && state.currentInvestment?.id === data.investmentId) {
        renderInvestmentContributions(data.investmentId); 
        openInvestmentDetail(data.investmentId); 
      }
      showToast('Aporte adicionado!', 'success'); return contribution;
    } catch (e) { console.error(e); showToast('Erro ao adicionar aporte.', 'error'); return null; }
  };
  const updateContribution = async (id, data) => {
    try {
      await db.collection('investmentContributions').doc(id).update(data);
      const index = state.investmentContributions.findIndex(c => c.id === id);
      if (index !== -1) state.investmentContributions[index] = { ...state.investmentContributions[index], ...data };
      await fullUIRefresh(); 
      if ($('#investmentDetailModal').classList.contains('active') && state.currentInvestment?.id === data.investmentId) {
        renderInvestmentContributions(data.investmentId);
        openInvestmentDetail(data.investmentId);
      }
      showToast('Aporte atualizado!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao atualizar aporte.', 'error'); return false; }
  };
  const deleteContribution = async (id) => {
    try {
      const contribToDelete = state.investmentContributions.find(c => c.id === id);
      if (!contribToDelete) return;
      await db.collection('investmentContributions').doc(id).delete();
      state.investmentContributions = state.investmentContributions.filter(c => c.id !== id);
      await fullUIRefresh(); 
      if ($('#investmentDetailModal').classList.contains('active') && state.currentInvestment?.id === contribToDelete.investmentId) {
        renderInvestmentContributions(contribToDelete.investmentId);
        openInvestmentDetail(contribToDelete.investmentId);
      }
      showToast('Aporte excluído!', 'success');
    } catch (e) { console.error(e); showToast('Erro ao excluir aporte.', 'error'); }
  };

  const openNewInvestmentModal = () => {
    $('#investmentForm').reset();
    setDateInputValue('investmentTargetDate', new Date());
    $('#newInvestmentModalTitle').textContent = 'Novo Investimento';
    $('#saveInvestmentBtn').textContent = 'Salvar Investimento';
    $('#saveInvestmentBtn').dataset.action = 'add';
    $('#saveInvestmentBtn').removeAttribute('data-id');
    updateInvestmentCategorySelects(); 
    closeModal('investmentsModal'); 
    openModal('newInvestmentModal');
  };
  const openEditInvestmentModal = (id) => {
    const inv = state.investments.find(i => i.id === id);
    if (!inv) return;
    state.currentInvestment = inv;
    $('#investmentName').value = inv.name;
    $('#investmentAmount').value = inv.amount || 0;
    $('#investmentGoal').value = inv.goal || '';
    updateInvestmentCategorySelects(); 
    $('#investmentCategorySelect').value = inv.category || '';
    if (inv.targetDate) setDateInputValue('investmentTargetDate', inv.targetDate); else $('#investmentTargetDate').value = '';
    $('#investmentNotes').value = inv.notes || '';
    $('#newInvestmentModalTitle').textContent = 'Editar Investimento';
    $('#saveInvestmentBtn').textContent = 'Atualizar Investimento';
    $('#saveInvestmentBtn').dataset.action = 'update';
    $('#saveInvestmentBtn').dataset.id = id;
    closeModal('investmentDetailModal'); 
    openModal('newInvestmentModal');
  };
  const openNewContributionModal = () => {
    $('#contributionForm').reset();
    setDateInputValue('contributionDate', new Date());
    $('#contributionInvestmentId').value = state.currentInvestment?.id || '';
    $('#newContributionModalTitle').textContent = 'Adicionar Novo Valor';
    $('#saveContributionBtn').textContent = 'Adicionar';
    $('#saveContributionBtn').dataset.action = 'add';
    $('#saveContributionBtn').removeAttribute('data-id');
    openModal('newContributionModal');
  };
  const openEditContributionModal = (id) => {
    const contrib = state.investmentContributions.find(c => c.id === id);
    if (!contrib) return;
    state.currentContribution = contrib;
    $('#contributionInvestmentId').value = contrib.investmentId;
    $('#contributionAmount').value = contrib.amount;
    setDateInputValue('contributionDate', contrib.date);
    $('#contributionDescription').value = contrib.description || '';
    $('#newContributionModalTitle').textContent = 'Editar Aporte';
    $('#saveContributionBtn').textContent = 'Atualizar';
    $('#saveContributionBtn').dataset.action = 'update';
    $('#saveContributionBtn').dataset.id = id;
    openModal('newContributionModal');
  };

  const getInvoicePeriod = (card, invoiceDueDateRef) => {
    const refDate = parseLocalDateString(invoiceDueDateRef);
    if (!refDate || !card) return { previousClosing: null, currentClosingDate: null };

    let closingDay = card.closingDay;
    let dueDay = card.dueDay;

    let currentClosingYear = refDate.getUTCFullYear();
    let currentClosingMonth = refDate.getUTCMonth(); 

    if (dueDay >= closingDay) {
        currentClosingMonth--;
        if (currentClosingMonth < 0) {
            currentClosingMonth = 11;
            currentClosingYear--;
        }
    }
    const currentClosingDate = new Date(Date.UTC(currentClosingYear, currentClosingMonth, closingDay));
    
    let previousClosingMonth = currentClosingMonth - 1;
    let previousClosingYear = currentClosingYear;
    if (previousClosingMonth < 0) {
        previousClosingMonth = 11;
        previousClosingYear--;
    }
    const previousClosing = new Date(Date.UTC(previousClosingYear, previousClosingMonth, closingDay));
    
    return { previousClosing, currentClosingDate }; 
  };

  const openCardInvoice = (cardId) => {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    state.currentCard = card; 

    const faturaVencimentoNoMesSelecionado = new Date(Date.UTC(state.year, state.month, card.dueDay));

    $('#cardInvoiceTitle').textContent = `Fatura ${card.name} - Venc. ${formatDate(faturaVencimentoNoMesSelecionado)}`;

    let currentInvoiceSum = 0;
    const invoiceTransactions = state.transactions.filter(t => {
        if (t.type === 'expense' && t.paymentMethod === 'credito' && t.creditCardId === cardId) {
            const effectiveDueDate = getEffectiveDueDateForSort(t); 
            return effectiveDueDate &&
                   effectiveDueDate.getUTCMonth() === state.month &&
                   effectiveDueDate.getUTCFullYear() === state.year;
        }
        return false; 
    }).sort((a,b) => parseLocalDateString(a.date) - parseLocalDateString(b.date)); 

    currentInvoiceSum = invoiceTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const { previousClosing, currentClosingDate } = getInvoicePeriod(card, faturaVencimentoNoMesSelecionado);
    let endOfPurchasePeriod = null;
    if (currentClosingDate) {
        endOfPurchasePeriod = new Date(currentClosingDate.getTime());
        endOfPurchasePeriod.setUTCDate(currentClosingDate.getUTCDate() - 1);
    }

    $('#cardInvoiceDetails').innerHTML = `
        <p><strong>Período de Compras (Referência):</strong> ${previousClosing ? formatDate(previousClosing) : 'N/A'} - ${endOfPurchasePeriod ? formatDate(endOfPurchasePeriod) : 'N/A'}</p>
        <p><strong>Vencimento desta Fatura:</strong> ${formatDate(faturaVencimentoNoMesSelecionado)}</p>
        <p><strong>Limite Total:</strong> ${formatCurrency(card.limit)} | <strong>Disponível:</strong> ${formatCurrency(card.availableLimit)}</p>
        <p><strong>Valor desta Fatura:</strong> <span id="currentInvoiceValueDisplay">${formatCurrency(currentInvoiceSum)}</span></p>
    `;

    const tableBody = $('#cardInvoiceTableBody');
    tableBody.innerHTML = '';

    if (invoiceTransactions.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhuma despesa nesta fatura.</td></tr>';
    } else {
      invoiceTransactions.forEach(t => {
        const row = tableBody.insertRow();
        row.innerHTML = `
          <td>${t.name} ${t.isRecurrent && t.installments > 1 ? `(${t.installmentNumber}/${t.installments})` : ''}</td>
          <td>${formatDate(t.date)}</td>
          <td>${formatCurrency(t.amount)}</td>
          <td>
            <div class="checkbox-wrapper">
              <input type="checkbox" class="checkbox invoice-paid-checkbox" id="invoice-paid-${t.id}"
                     data-id="${t.id}" ${t.status === 'paid' ? 'checked' : ''}>
              <label class="checkbox-label" for="invoice-paid-${t.id}"></label>
            </div>
          </td>`;
      });
      $$('.invoice-paid-checkbox').forEach(cb => cb.addEventListener('change', async (e) => {
          await updateTransactionStatus(e.target.dataset.id, e.target.checked ? 'paid' : 'pending');
          openCardInvoice(cardId);
      }));
    }
    $('#invoiceConfirmAmount').textContent = formatCurrency(currentInvoiceSum);
    closeModal('cardsListModal'); 
    openModal('cardInvoiceModal');
  };

  const toggleCommitments = () => {
    const content = $('#commitmentsContent');
    const icon = $('#commitmentToggleIcon use');
    if (!content || !icon) return;
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
      content.style.maxHeight = '0px';
      icon.setAttribute('href', '#icon-chevron-down');
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
      icon.setAttribute('href', '#icon-chevron-up');
    }
  };

  const generateInsights = () => {
    const container = $('#insightsBannerContainer');
    if (!container) return;
    container.innerHTML = '';
    state.insights = [];
    const today = new Date(); today.setUTCHours(0,0,0,0); 

    const overdue = state.transactions.filter(t => {
        if (t.type !== 'expense' || t.status === 'paid') return false;
        
        let effectiveDueDate = null;
        if (t.paymentMethod === 'credito' && t.creditCardId) {
            const card = state.cards.find(c => c.id === t.creditCardId);
            const launchDate = parseLocalDateString(t.date);
            if (card && launchDate) effectiveDueDate = calcularVencimentoReal(launchDate, card);
        } else if (t.dueDate) {
            effectiveDueDate = parseLocalDateString(t.dueDate);
        }
        
        if (!effectiveDueDate) return false;
        
        return effectiveDueDate < today;
    });

    if (overdue.length > 0) {
      state.insights.push({ id: 'overdue', level: 'danger', icon: 'icon-alert', message: `Você tem ${overdue.length} conta(s) vencida(s).`, actionText: 'Ver Detalhes', action: () => openDueTransactionsModal(overdue, 'Contas Vencidas', 'danger') });
    }

    const upcomingDateLimit = new Date(today); upcomingDateLimit.setUTCDate(today.getUTCDate() + 5);
    const upcoming = state.transactions.filter(t => {
        if (t.type !== 'expense' || t.status === 'paid') return false;
        
        let effectiveDueDate = null;
        if (t.paymentMethod === 'credito' && t.creditCardId) {
            const card = state.cards.find(c => c.id === t.creditCardId);
            const launchDate = parseLocalDateString(t.date);
            if (card && launchDate) effectiveDueDate = calcularVencimentoReal(launchDate, card);
        } else if (t.dueDate) {
            effectiveDueDate = parseLocalDateString(t.dueDate);
        }
        if (!effectiveDueDate) return false;

        return effectiveDueDate >= today && effectiveDueDate <= upcomingDateLimit;
    });
    if (upcoming.length > 0) {
      state.insights.push({ id: 'upcoming', level: 'warning', icon: 'icon-calendar', message: `Você tem ${upcoming.length} conta(s) a vencer nos próximos 5 dias.`, actionText: 'Ver Detalhes', action: () => openDueTransactionsModal(upcoming, 'Contas a Vencer', 'warning') }); 
    }
    
    state.cards.filter(c => c.availableLimit < (c.limit * 0.2)).forEach(c => {
        state.insights.push({ id: `low-limit-${c.id}`, level: 'warning', icon: 'icon-credit-card', message: `Limite baixo no cartão ${c.name}.`, actionText: 'Ver Cartão', action: () => { closeModal('insightsBannerContainer'); openModal('cardsListModal'); openCardInvoice(c.id); } });
    });

    state.insights.forEach(insight => {
      const el = document.createElement('div');
      el.className = `insight-banner insight-${insight.level}`;
      el.innerHTML = `<div class="insight-icon"><svg width="24" height="24"><use href="#${insight.icon}"></use></svg></div><div class="insight-content"><div class="insight-title">${insight.message}</div></div><button class="btn btn-outline insight-action" data-id="${insight.id}">${insight.actionText}</button>`;
      container.appendChild(el);
    });
    $$('.insight-action').forEach(btn => btn.addEventListener('click', e => {
      const insight = state.insights.find(i => i.id === e.currentTarget.dataset.id);
      if (insight && insight.action) insight.action();
    }));
  };
  
  const openDueTransactionsModal = (transactions, title, type) => {
    $('#dueTransactionsModalTitleText').textContent = title;
    const iconEl = $('#dueTransactionsModalIcon use');
    iconEl.setAttribute('href', type === 'danger' ? '#icon-alert' : '#icon-calendar');
    
    const tableBody = $('#dueTransactionsTableBody');
    tableBody.innerHTML = '';
    if (transactions.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhuma conta encontrada.</td></tr>`;
    } else {
      transactions.sort((a,b) => {
        let dueDateA_effective = null;
        if (a.paymentMethod === 'credito' && a.creditCardId) {
            const cardA = state.cards.find(c=>c.id===a.creditCardId);
            if(cardA) dueDateA_effective = calcularVencimentoReal(parseLocalDateString(a.date), cardA);
        } else if (a.dueDate) {
            dueDateA_effective = parseLocalDateString(a.dueDate);
        }

        let dueDateB_effective = null;
        if (b.paymentMethod === 'credito' && b.creditCardId) {
            const cardB = state.cards.find(c=>c.id===b.creditCardId);
            if(cardB) dueDateB_effective = calcularVencimentoReal(parseLocalDateString(b.date), cardB);
        } else if (b.dueDate) {
            dueDateB_effective = parseLocalDateString(b.dueDate);
        }
        
        if (!dueDateA_effective && !dueDateB_effective) return 0;
        if (!dueDateA_effective) return 1;
        if (!dueDateB_effective) return -1;
        return dueDateA_effective - dueDateB_effective;

      }).forEach(t => {
        const cat = state.categories.expense.find(c => c.id === t.category);
        let effectiveDueDateForDisplay = null;
        if (t.paymentMethod === 'credito' && t.creditCardId) {
            const card = state.cards.find(c=>c.id===t.creditCardId);
            const launchDate = parseLocalDateString(t.date);
            if(card && launchDate) effectiveDueDateForDisplay = calcularVencimentoReal(launchDate, card);
        } else if (t.dueDate) {
            effectiveDueDateForDisplay = parseLocalDateString(t.dueDate);
        }

        const row = tableBody.insertRow();
        row.innerHTML = `
          <td>${t.name}</td>
          <td>${cat ? `${cat.icon} ${cat.name}` : (t.categoryName || t.category)}</td>
          <td>${effectiveDueDateForDisplay ? formatDate(effectiveDueDateForDisplay) : formatDate(t.date)}</td>
          <td>${formatCurrency(t.amount)}</td>
          <td class="actions-cell">
            <button class="btn btn-success btn-sm mark-paid-due-btn" data-id="${t.id}">Pagar</button>
            <button class="btn btn-outline btn-sm edit-due-btn" data-id="${t.id}">Editar</button>
          </td>`;
      });
      $$('.mark-paid-due-btn').forEach(btn => btn.addEventListener('click', async e => {
          await updateTransactionStatus(e.target.dataset.id, 'paid');
          const remaining = transactions.filter(tr => tr.id !== e.target.dataset.id && tr.status !== 'paid'); 
          if (remaining.length > 0) openDueTransactionsModal(remaining, title, type);
          else closeModal('dueTransactionsModal');
          generateInsights(); 
      }));
      $$('.edit-due-btn').forEach(btn => btn.addEventListener('click', e => {
          const transaction = state.transactions.find(t => t.id === e.target.dataset.id);
          if (transaction) {
              closeModal('dueTransactionsModal');
              openEditModal(transaction);
          }
      }));
    }
    $('#payAllDueBtn').style.display = type === 'danger' && transactions.length > 0 ? 'inline-flex' : 'none';
    openModal('dueTransactionsModal');
  };


  const renderCommitments = () => {
    const content = $('#commitmentsContent');
    if (!content) return;
    content.innerHTML = '';
    const recurrent = state.transactions.filter(t => t.isRecurrent && t.installments && t.installmentNumber && t.installments > t.installmentNumber);
    if (recurrent.length === 0) {
      content.innerHTML = '<p style="text-align: center;">Nenhum compromisso longo.</p>';
      return;
    }
    const grouped = recurrent.reduce((acc, t) => {
        const key = t.recurrenceId || t.id; 
        if (!acc[key] || acc[key].installmentNumber > t.installmentNumber) { 
            acc[key] = t;
        }
        return acc;
    }, {});

    Object.values(grouped).sort((a,b) => (a.installmentNumber/a.installments) - (b.installmentNumber/b.installments)).forEach(c => {
      const progress = (c.installmentNumber / c.installments) * 100;
      const cat = c.type === 'income' ? state.categories.income.find(cat=>cat.id===c.category) : state.categories.expense.find(cat=>cat.id===c.category);
      const item = document.createElement('div');
      item.className = 'commitment-item';
      item.innerHTML = `
        <div class="transaction-icon" style="background-color: ${c.type==='income'?'var(--color-income)':'var(--color-expense)'}20; color: ${c.type==='income'?'var(--color-income)':'var(--color-expense)'};">
          ${cat?.icon || (c.type === 'income' ? '💰' : '📦')}
        </div>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between;"><span>${c.name}</span> <span>${formatCurrency(c.amount)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--color-on-surface-variant);">
            <span>${cat?.name || c.categoryName || c.category}</span>
            <span>${c.installmentNumber}/${c.installments}</span>
          </div>
          <div class="commitment-progress"><div class="commitment-progress-bar" style="width:${progress}%; background-color:${c.type==='income'?'var(--color-income)':'var(--color-expense)'};"></div></div>
        </div>`;
      content.appendChild(item);
    });
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = content.scrollHeight + 'px';
    }
  };

  const createTransactionFilters = () => {
    const container = $('#transaction-filters');
    if (!container) return;
    container.innerHTML = ''; 

    const typeSelect = document.createElement('div');
    typeSelect.className = 'select-wrapper';
    typeSelect.innerHTML = `
      <select id="filter-transaction-type" class="select">
        <option value="">Todos os Tipos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
      </select>
      <svg class="select-icon" width="16" height="16"><use href="#icon-chevron-down"></use></svg>`;
    container.appendChild(typeSelect);
    $('#filter-transaction-type').addEventListener('change', e => { state.filters.transactionType = e.target.value; updateTransactionsTable(); });
    
    const commonFilters = [
        { id: 'filter-category', label: 'Todas as categorias', options: [...state.categories.income, ...state.categories.expense].map(c => ({value: c.id, text: `${c.icon||''} ${c.name}`})) },
        { id: 'filter-status', label: 'Todos os status', options: [{value:'paid',text:'Pago'},{value:'pending',text:'Pendente'},{value:'scheduled',text:'Agendado'},{value:'received',text:'Recebido'}] },
        { id: 'filter-payment-method', label: 'Todos os pagamentos', options: state.paymentMethods.map(p => ({value: p.id, text: `${p.icon||''} ${p.name}`})) },
        { id: 'filter-person', label: 'Todas as pessoas', options: state.people.map(p => ({value: p.id, text: `${p.icon||''} ${p.name}`})) },
    ];
    commonFilters.forEach(f => {
        const selWrap = document.createElement('div');
        selWrap.className = 'select-wrapper';
        let optionsHTML = `<option value="">${f.label}</option>`;
        f.options.forEach(opt => optionsHTML += `<option value="${opt.value}">${opt.text}</option>`);
        selWrap.innerHTML = `<select id="${f.id}" class="select">${optionsHTML}</select><svg class="select-icon" width="16" height="16"><use href="#icon-chevron-down"></use></svg>`;
        container.appendChild(selWrap);
        $(`#${f.id}`).addEventListener('change', e => { state.filters[f.id.split('-')[1]] = e.target.value; updateTransactionsTable(); });
    });
  };

  const setupSortableColumns = () => {
    $$('#transactionsTable th.sortable').forEach(header => {
      header.addEventListener('click', () => {
        const column = header.dataset.sort;
        if (state.sortColumn === column) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = column;
          if (column === 'date' || column === 'dueDate') {
            state.sortDirection = 'asc'; 
          } else if (column === 'amount') {
            state.sortDirection = 'desc'; 
          } else {
            state.sortDirection = 'asc'; 
          }
        }
        $$('#transactionsTable th.sortable').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        header.classList.add(`sorted-${state.sortDirection}`);
        updateTransactionsTable();
      });
    });
  };

  const getEffectiveDueDateForSort = (transaction) => {
    let effectiveDate = parseLocalDateString(transaction.date); 

    if (transaction.type === 'expense') {
        if (transaction.paymentMethod === 'credito' && transaction.creditCardId) {
            const card = state.cards.find(c => c.id === transaction.creditCardId);
            if (card) {
                const realCardDueDate = calcularVencimentoReal(parseLocalDateString(transaction.date), card);
                if (realCardDueDate) effectiveDate = realCardDueDate;
            }
        } else if (transaction.dueDate) {
            const explicitDueDate = parseLocalDateString(transaction.dueDate);
            if (explicitDueDate) effectiveDate = explicitDueDate;
        }
    }
    return effectiveDate;
  };


  const updateTransactionsTable = () => {
    const tableBody = $('#transactionsTableBody');
    if (!tableBody) return;
    if (!$('#filter-transaction-type')) createTransactionFilters(); 
    const sortableHeaders = $$('#transactionsTable th.sortable');
    if (sortableHeaders.length > 0 && !sortableHeaders[0].classList.contains('has-listener')) { 
        setupSortableColumns();
        sortableHeaders.forEach(h => h.classList.add('has-listener'));
    }

    let transactionsToDisplay = [...state.filteredTransactions]; 
    if (state.filters.transactionType) transactionsToDisplay = transactionsToDisplay.filter(t => t.type === state.filters.transactionType);
    if (state.filters.category) transactionsToDisplay = transactionsToDisplay.filter(t => t.category === state.filters.category);
    if (state.filters.status) transactionsToDisplay = transactionsToDisplay.filter(t => t.status === state.filters.status);
    if (state.filters.paymentMethod) transactionsToDisplay = transactionsToDisplay.filter(t => t.paymentMethod === state.filters.paymentMethod);
    if (state.filters.person) transactionsToDisplay = transactionsToDisplay.filter(t => t.person === state.filters.person);

    transactionsToDisplay.sort((a, b) => {
      let valA, valB;
      
      switch(state.sortColumn) {
        case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
        case 'person': 
            valA = (state.people.find(p=>p.id===a.person)?.name || '').toLowerCase(); 
            valB = (state.people.find(p=>p.id===b.person)?.name || '').toLowerCase(); 
            break;
        case 'date': 
            valA = parseLocalDateString(a.date); 
            valB = parseLocalDateString(b.date); 
            break; 
        case 'dueDate': 
            valA = getEffectiveDueDateForSort(a);
            valB = getEffectiveDueDateForSort(b);
            if (valA === null && valB !== null) return state.sortDirection === 'asc' ? 1 : -1; 
            if (valA !== null && valB === null) return state.sortDirection === 'asc' ? -1 : 1; 
            if (valA === null && valB === null) return 0;
            break;
        case 'amount': valA = parseFloat(a.amount); valB = parseFloat(b.amount); break;
        case 'status': valA = a.status; valB = b.status; break;
        case 'paymentMethod': 
            valA = (state.paymentMethods.find(p=>p.id===a.paymentMethod)?.name || '').toLowerCase(); 
            valB = (state.paymentMethods.find(p=>p.id===b.paymentMethod)?.name || '').toLowerCase(); 
            break;
        default: 
            valA = getEffectiveDueDateForSort(a); 
            valB = getEffectiveDueDateForSort(b);
      }
      const comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
      return state.sortDirection === 'desc' ? -comparison : comparison;
    });

    tableBody.innerHTML = '';
    if (transactionsToDisplay.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: var(--spacing-lg);">Nenhuma transação para este mês/filtros.</td></tr>`;
      return;
    }
    transactionsToDisplay.forEach(t => {
      const row = tableBody.insertRow();
      const cat = t.type === 'income' ? state.categories.income.find(c=>c.id===t.category) : state.categories.expense.find(c=>c.id===t.category);
      const person = state.people.find(p=>p.id===t.person);
      const payment = state.paymentMethods.find(p=>p.id===t.paymentMethod);
      
      let statusText = t.status;
      let statusClass = 'badge-info';
      if (t.type === 'income') {
          if (t.status === 'received') { statusText = 'Recebido'; statusClass = 'badge-success'; }
          else { statusText = 'A Receber'; statusClass = 'badge-warning'; }
      } else { 
          if (t.status === 'paid') { statusText = 'Pago'; statusClass = 'badge-success'; }
          else if (t.status === 'scheduled') { statusText = 'Agendado'; statusClass = 'badge-info'; }
          else { statusText = 'Pendente'; statusClass = 'badge-warning'; }
      }
      
      const effectiveDueDateForDisplay = getEffectiveDueDateForSort(t);
      
      row.innerHTML = `
        <td class="transaction-name-cell">
            <div class="transaction-icon" style="background-color: ${t.type==='income'?'var(--color-income)':'var(--color-expense)'}20; color: ${t.type==='income'?'var(--color-income)':'var(--color-expense)'};">
              ${cat?.icon || (t.type === 'income' ? '💰' : '📦')}
            </div>
            ${t.name} ${t.isRecurrent && t.installments > 1 ? `(${t.installmentNumber}/${t.installments})` : ''}
        </td>
        <td>${person ? `${person.icon||''} ${person.name}` : '-'}</td>
        <td>${formatDate(t.date)}</td> 
        <td>${effectiveDueDateForDisplay ? formatDate(effectiveDueDateForDisplay) : '-'}</td> 
        <td>${formatCurrency(t.amount)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>${payment ? `${payment.icon||''} ${payment.name}` : (t.paymentMethodName || t.paymentMethod || '-')}</td>
        <td>
          <div class="checkbox-wrapper">
            <input type="checkbox" class="checkbox transaction-paid-checkbox" id="paid-${t.id}" 
                   data-id="${t.id}" data-type="${t.type}" 
                   ${t.status === (t.type === 'income' ? 'received' : 'paid') ? 'checked' : ''}>
            <label class="checkbox-label" for="paid-${t.id}"></label>
          </div>
        </td>
        <td class="actions-cell">
          <button class="btn btn-icon btn-outline edit-transaction-btn" data-id="${t.id}" aria-label="Editar"><svg width="16" height="16"><use href="#icon-edit"></use></svg></button>
          <button class="btn btn-icon btn-outline delete-transaction-btn" data-id="${t.id}" aria-label="Excluir"><svg width="16" height="16"><use href="#icon-trash"></use></svg></button>
        </td>`;
    });
    $$('.transaction-paid-checkbox').forEach(cb => cb.addEventListener('change', e => updateTransactionStatus(e.target.dataset.id, e.target.checked ? (e.target.dataset.type === 'income' ? 'received' : 'paid') : 'pending')));
    $$('.edit-transaction-btn').forEach(btn => btn.addEventListener('click', e => openEditModal(state.transactions.find(t => t.id === e.currentTarget.dataset.id))));
    $$('.delete-transaction-btn').forEach(btn => btn.addEventListener('click', e => openDeleteConfirmModal(state.transactions.find(t => t.id === e.currentTarget.dataset.id))));
  };

  const openEditModal = (transaction) => {
    if (!transaction) return;
    state.currentTransaction = transaction;
    $('#editTransactionId').value = transaction.id;
    $('#editTransactionType').value = transaction.type;
    $('#editName').value = transaction.name;
    $('#editAmount').value = transaction.amount;

    const categorySelect = $('#editCategory');
    categorySelect.dataset.type = transaction.type; 
    updateCategorySelects(); 
    categorySelect.value = transaction.category;

    $('#editPerson').value = transaction.person || '';
    
    const expenseTypeGroup = $('#editExpenseTypeGroup');
    if (transaction.type === 'expense') {
        expenseTypeGroup.style.display = 'block';
        if (transaction.isFixed === 'fixed') $('#editExpenseTypeFixed').checked = true;
        else $('#editExpenseTypeVariable').checked = true;
    } else {
        expenseTypeGroup.style.display = 'none';
    }

    setDateInputValue('editDate', transaction.date); 
    
    const dueDateGroup = $('#editDueDateGroup');
    const dueDateInput = $('#editDueDate');

    let effectiveDueDateForEdit = transaction.dueDate ? parseLocalDateString(transaction.dueDate) : null; 
    if (transaction.type === 'expense' && transaction.paymentMethod === 'credito' && transaction.creditCardId) {
        const card = state.cards.find(c => c.id === transaction.creditCardId);
        const launchDate = parseLocalDateString(transaction.date);
        if (card && launchDate) {
            const realCardDueDate = calcularVencimentoReal(launchDate, card);
            if (realCardDueDate) effectiveDueDateForEdit = realCardDueDate;
        }
    }
    
    if (effectiveDueDateForEdit) {
        dueDateGroup.style.display = 'block';
        setDateInputValue('editDueDate', effectiveDueDateForEdit);
    } else { 
        dueDateGroup.style.display = 'block'; 
        setDateInputValue('editDueDate', transaction.date); 
    }
    dueDateInput.disabled = (transaction.type === 'expense' && transaction.paymentMethod === 'credito');


    $('#editPaymentMethod').value = transaction.paymentMethod;
    handleEditCreditCardVisibility(); 
    if (transaction.paymentMethod === 'credito') {
        $('#editCreditCard').value = transaction.creditCardId || '';
        handleEditDueDateForCard(); 
    }
    
    $('#editIsRecurrent').checked = transaction.isRecurrent || false;
    const isParcelOfSeries = !!transaction.recurrenceId;
    $('#editIsRecurrent').disabled = isParcelOfSeries;
    $('#editInstallments').disabled = !transaction.isRecurrent || isParcelOfSeries; 
    
    handleEditRecurrenceGroupVisibility();
    if (transaction.isRecurrent) {
      $('#editInstallments').value = transaction.installments || 2;
    }

    const statusGroup = $('#editStatusGroup');
    statusGroup.innerHTML = ''; 
    if (transaction.type === 'income') {
      statusGroup.innerHTML = `
        <div class="radio-wrapper"><input type="radio" class="radio" id="editStatusReceived" name="editStatus" value="received"><label class="radio-label" for="editStatusReceived">Recebido</label></div>
        <div class="radio-wrapper"><input type="radio" class="radio" id="editStatusPendingIncome" name="editStatus" value="pending"><label class="radio-label" for="editStatusPendingIncome">A Receber</label></div>`;
      if (transaction.status === 'received') $('#editStatusReceived').checked = true; else $('#editStatusPendingIncome').checked = true;
    } else { 
      statusGroup.innerHTML = `
        <div class="radio-wrapper"><input type="radio" class="radio" id="editStatusPaid" name="editStatus" value="paid"><label class="radio-label" for="editStatusPaid">Pago</label></div>
        <div class="radio-wrapper"><input type="radio" class="radio" id="editStatusPendingExpense" name="editStatus" value="pending"><label class="radio-label" for="editStatusPendingExpense">Pendente</label></div>
        <div class="radio-wrapper"><input type="radio" class="radio" id="editStatusScheduled" name="editStatus" value="scheduled"><label class="radio-label" for="editStatusScheduled">Agendado</label></div>`;
      if (transaction.status === 'paid') $('#editStatusPaid').checked = true;
      else if (transaction.status === 'scheduled') $('#editStatusScheduled').checked = true;
      else $('#editStatusPendingExpense').checked = true;
    }
    handleEditStatusFieldVisibility(); 
    handleEditScheduledDateVisibility();

    if (transaction.status === 'scheduled' && transaction.scheduledDate) {
      setDateInputValue('editScheduledDate', transaction.scheduledDate);
    }

    $('#editNotes').value = transaction.notes || '';
    $('#editModalTitle').textContent = transaction.type === 'income' ? 'Editar Receita' : 'Editar Despesa';
    openModal('editModal');
  };

  const openDeleteConfirmModal = (transaction) => {
    if (!transaction) return;
    state.currentTransaction = transaction;
    const reccOptions = $('#recurrenceDeleteOptions');
    const isPartOfRecurrentSeries = transaction.isRecurrent && transaction.recurrenceId && transaction.installments > 1;
    reccOptions.style.display = isPartOfRecurrentSeries ? 'block' : 'none';
    if (isPartOfRecurrentSeries) $('#deleteSingle').checked = true;
    openModal('deleteConfirmModal');
  };

  const addCategory = async (name, icon, type) => {
    if (!name.trim()) { showToast('Nome não pode ser vazio.', 'error'); return null; }
    const id = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${generateId().substring(0,6)}`;
    const category = { id, name, icon, type }; 
    try {
      await db.collection('categories').doc(id).set(category);
      if (type === 'income') state.categories.income.push(category);
      else if (type === 'expense') state.categories.expense.push(category);
      else if (type === 'investment') state.categories.investment.push(category);
      await fullUIRefresh(); 
      showToast('Categoria adicionada!', 'success'); return category;
    } catch (e) { console.error(e); showToast('Erro ao adicionar categoria.', 'error'); return null; }
  };
  const addPaymentMethod = async (name, icon) => {
    if (!name.trim()) { showToast('Nome não pode ser vazio.', 'error'); return null; }
    const id = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${generateId().substring(0,6)}`;
    const method = { id, name, icon };
    try {
      await db.collection('paymentMethods').doc(id).set(method);
      state.paymentMethods.push(method);
      await fullUIRefresh(); 
      showToast('Forma de pagamento adicionada!', 'success'); return method;
    } catch (e) { console.error(e); showToast('Erro ao adicionar forma de pagamento.', 'error'); return null; }
  };
  const addPerson = async (name, icon) => {
    if (!name.trim()) { showToast('Nome não pode ser vazio.', 'error'); return null; }
    const id = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${generateId().substring(0,6)}`;
    const person = { id, name, icon };
    try {
      await db.collection('people').doc(id).set(person);
      state.people.push(person);
      await fullUIRefresh(); 
      showToast('Pessoa adicionada!', 'success'); return person;
    } catch (e) { console.error(e); showToast('Erro ao adicionar pessoa.', 'error'); return null; }
  };

  const updateCategory = async (id, updates, type) => {
    try {
      await db.collection('categories').doc(id).update(updates);
      let listToUpdate;
      if (type === 'income') listToUpdate = state.categories.income;
      else if (type === 'expense') listToUpdate = state.categories.expense;
      else if (type === 'investment') listToUpdate = state.categories.investment;
      
      const index = listToUpdate.findIndex(c => c.id === id);
      if (index !== -1) listToUpdate[index] = { ...listToUpdate[index], ...updates };
      
      const batch = db.batch();
      let transactionsUpdated = false;
      state.transactions.forEach(t => {
        if (t.category === id) {
          batch.update(db.collection('transactions').doc(t.id), { categoryName: updates.name, categoryIcon: updates.icon });
          t.categoryName = updates.name; t.categoryIcon = updates.icon; 
          transactionsUpdated = true;
        }
      });
      if (transactionsUpdated) await batch.commit();
      
      await fullUIRefresh(); 
      showToast('Categoria atualizada!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao atualizar categoria.', 'error'); return false; }
  };
  const updatePaymentMethod = async (id, updates) => {
    try {
      await db.collection('paymentMethods').doc(id).update(updates);
      const index = state.paymentMethods.findIndex(m => m.id === id);
      if (index !== -1) state.paymentMethods[index] = { ...state.paymentMethods[index], ...updates };
      
      const batch = db.batch();
      let transactionsUpdated = false;
      state.transactions.forEach(t => {
        if (t.paymentMethod === id) {
          batch.update(db.collection('transactions').doc(t.id), { paymentMethodName: updates.name, paymentMethodIcon: updates.icon });
          t.paymentMethodName = updates.name; t.paymentMethodIcon = updates.icon;
          transactionsUpdated = true;
        }
      });
      if (transactionsUpdated) await batch.commit();

      await fullUIRefresh(); 
      showToast('Forma de pagamento atualizada!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao atualizar forma de pagamento.', 'error'); return false; }
  };
  const updatePerson = async (id, updates) => {
    try {
      await db.collection('people').doc(id).update(updates);
      const index = state.people.findIndex(p => p.id === id);
      if (index !== -1) state.people[index] = { ...state.people[index], ...updates };

      const batch = db.batch();
      let transactionsUpdated = false;
      state.transactions.forEach(t => {
        if (t.person === id) {
          batch.update(db.collection('transactions').doc(t.id), { personName: updates.name, personIcon: updates.icon });
          t.personName = updates.name; t.personIcon = updates.icon;
          transactionsUpdated = true;
        }
      });
      if (transactionsUpdated) await batch.commit();

      await fullUIRefresh(); 
      showToast('Pessoa atualizada!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao atualizar pessoa.', 'error'); return false; }
  };

  const deleteCategory = async (id, type) => {
    if (!confirm(`Excluir esta categoria? Transações associadas perderão esta categoria.`)) return false;
    try {
      await db.collection('categories').doc(id).delete();
      if (type === 'income') state.categories.income = state.categories.income.filter(c => c.id !== id);
      else if (type === 'expense') state.categories.expense = state.categories.expense.filter(c => c.id !== id);
      else if (type === 'investment') state.categories.investment = state.categories.investment.filter(c => c.id !== id);
      state.transactions.forEach(t => { if (t.category === id) { t.category = null; t.categoryName = 'Sem Categoria'; t.categoryIcon = '❓'; }});
      await fullUIRefresh(); 
      showToast('Categoria excluída!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao excluir categoria.', 'error'); return false; }
  };
  const deletePaymentMethod = async (id) => {
    if (!confirm(`Excluir esta forma de pagamento? Transações associadas perderão esta forma de pagamento.`)) return false;
    try {
      await db.collection('paymentMethods').doc(id).delete();
      state.paymentMethods = state.paymentMethods.filter(m => m.id !== id);
      state.transactions.forEach(t => { if (t.paymentMethod === id) { t.paymentMethod = null; t.paymentMethodName = 'N/A'; t.paymentMethodIcon = '❓'; }});
      await fullUIRefresh(); 
      showToast('Forma de pagamento excluída!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao excluir forma de pagamento.', 'error'); return false; }
  };
  const deletePerson = async (id) => {
    if (!confirm(`Excluir esta pessoa? Transações associadas perderão esta pessoa.`)) return false;
    try {
      await db.collection('people').doc(id).delete();
      state.people = state.people.filter(p => p.id !== id);
      state.transactions.forEach(t => { if (t.person === id) { t.person = null; t.personName = 'N/A'; t.personIcon = '❓'; }});
      await fullUIRefresh(); 
      showToast('Pessoa excluída!', 'success'); return true;
    } catch (e) { console.error(e); showToast('Erro ao excluir pessoa.', 'error'); return false; }
  };

  function handleDueDateForCard(formPrefix) {
    const paymentMethodEl = $(`#${formPrefix}PaymentMethod`);
    const creditCardEl = $(`#${formPrefix}CreditCard`);
    const dateEl = $(`#${formPrefix}Date`); 
    const dueDateEl = $(`#${formPrefix}DueDate`); 
    const dueDateGroupEl = $(`#${formPrefix}DueDateGroup`);

    if (!paymentMethodEl || !dueDateEl || !dueDateGroupEl) return;

    if (paymentMethodEl.value === 'credito') {
        dueDateGroupEl.style.display = 'block'; 
        dueDateEl.disabled = true; 
        if (creditCardEl && creditCardEl.value && dateEl && dateEl.value) {
            const card = state.cards.find(c => c.id === creditCardEl.value);
            const launchDate = getDateInputValue(`${formPrefix}Date`);
            if (card && launchDate) {
                const realDueDate = calcularVencimentoReal(launchDate, card);
                if (realDueDate) setDateInputValue(`${formPrefix}DueDate`, realDueDate);
            } else {
                 setDateInputValue(`${formPrefix}DueDate`, null); 
            }
        } else {
            setDateInputValue(`${formPrefix}DueDate`, null); 
        }
    } else { 
        dueDateEl.disabled = false;
        dueDateGroupEl.style.display = 'block';
        if (!dueDateEl.value && formPrefix !== 'edit') { 
            if (dateEl && dateEl.value) {
                setDateInputValue(`${formPrefix}DueDate`, getDateInputValue(`${formPrefix}Date`));
            }
        }
    }
  }
  
  function handleStatusFieldVisibility(formPrefix) {
    const paymentMethodEl = $(`#${formPrefix}PaymentMethod`);
    const isRecurrentEl = $(`#${formPrefix}IsRecurrent`);
    const statusGroupEl = $(`#${formPrefix}StatusGroup`) || $(`#${formPrefix}StatusOuterGroup`); 
    const statusPendingRadioExpense = $(`#${formPrefix}StatusPending`) || $(`#${formPrefix}StatusPendingExpense`);
    const statusPendingRadioIncome = $(`#${formPrefix}StatusPending`) || $(`#${formPrefix}StatusPendingIncome`);


    if (!paymentMethodEl || !statusGroupEl ) return;
    
    const isCreditCard = paymentMethodEl.value === 'credito';
    const isRecurrent = isRecurrentEl ? isRecurrentEl.checked : false;
    const isExpenseForm = formPrefix.toLowerCase().includes('expense') || (state.currentTransaction && state.currentTransaction.type === 'expense');


    if (isCreditCard || isRecurrent) {
        statusGroupEl.style.display = 'none';
        if (isExpenseForm && statusPendingRadioExpense) statusPendingRadioExpense.checked = true;
        else if (!isExpenseForm && statusPendingRadioIncome) statusPendingRadioIncome.checked = true; 
    } else {
        statusGroupEl.style.display = 'block'; 
    }
  }

  function handleCreditCardGroupVisibility(formPrefix) {
    const paymentMethodEl = $(`#${formPrefix}PaymentMethod`);
    const creditCardGroupEl = $(`#${formPrefix}CreditCardGroup`) || $(`#creditCardGroup`); 
    if (paymentMethodEl && creditCardGroupEl) {
        creditCardGroupEl.style.display = paymentMethodEl.value === 'credito' ? 'block' : 'none';
    }
  }
  function handleRecurrenceGroupVisibility(formPrefix) {
    const isRecurrentEl = $(`#${formPrefix}IsRecurrent`);
    const recurrenceGroupEl = $(`#${formPrefix}RecurrenceGroup`);
    const installmentsInput = $(`#${formPrefix}Installments`); 
    if (isRecurrentEl && recurrenceGroupEl) {
        recurrenceGroupEl.style.display = isRecurrentEl.checked ? 'block' : 'none';
        if(installmentsInput) installmentsInput.disabled = !isRecurrentEl.checked;

    }
  }
  function handleScheduledDateVisibility(formPrefix) {
    const statusRadioScheduled = $(`#${formPrefix}StatusScheduled`);
    const scheduledDateGroupEl = $(`#${formPrefix}ScheduledDateGroup`);
    if (scheduledDateGroupEl) { 
        scheduledDateGroupEl.style.display = (statusRadioScheduled && statusRadioScheduled.checked) ? 'block' : 'none';
        if (statusRadioScheduled && statusRadioScheduled.checked && !$(`#${formPrefix}ScheduledDate`).value) {
            setDateInputValue(`${formPrefix}ScheduledDate`, new Date());
        }
    }
  }
  const handleEditCreditCardVisibility = () => handleCreditCardGroupVisibility('edit');
  const handleEditRecurrenceGroupVisibility = () => handleRecurrenceGroupVisibility('edit');
  const handleEditScheduledDateVisibility = () => handleScheduledDateVisibility('edit');
  const handleEditDueDateForCard = () => handleDueDateForCard('edit');
  const handleEditStatusFieldVisibility = () => handleStatusFieldVisibility('edit');


  const initEventListeners = () => {
    $('#yearSelect').addEventListener('change', async e => { state.year = parseInt(e.target.value); await fullUIRefresh(); });
    $('#monthSelect').addEventListener('change', async e => { state.month = parseInt(e.target.value); await fullUIRefresh(); });

    $('#newIncomeBtn').addEventListener('click', () => {
      $('#incomeForm').reset();
      setDateInputValue('incomeDate', new Date());
      handleStatusFieldVisibility('income'); 
      handleRecurrenceGroupVisibility('income');
      openModal('incomeModal');
    });
    $('#newExpenseBtn').addEventListener('click', () => {
      $('#expenseForm').reset();
      const today = new Date();
      setDateInputValue('expenseDate', today); 
      setDateInputValue('expenseDueDate', today); 
      $('#expenseTypeVariable').checked = true; 
      $('#expenseStatusPending').checked = true; 
      handleCreditCardGroupVisibility('expense'); 
      handleDueDateForCard('expense'); 
      handleStatusFieldVisibility('expense'); 
      handleRecurrenceGroupVisibility('expense');
      handleScheduledDateVisibility('expense');
      openModal('expenseModal');
    });

    $('#cardsBtn').addEventListener('click', () => { updateCardsList(); openModal('cardsListModal'); });
    $('#categoriesBtn').addEventListener('click', () => {
        renderCategoriesList();
        renderExpenseCategoriesList(); 
        renderPaymentMethodsList();
        renderInvestmentCategoriesList();
        updatePeopleList();
        const firstTabLink = $('#income-cat-tab');
        const firstTabPane = $('#income-cat');
        if (firstTabLink && firstTabPane) {
            $$('.nav-link').forEach(link => link.classList.remove('active'));
            $$('.tab-pane').forEach(pane => pane.classList.remove('active', 'show'));
            firstTabLink.classList.add('active');
            firstTabPane.classList.add('active', 'show');
        }
        openModal('categoriesModal');
    });
    $('#investmentsBtn').addEventListener('click', () => { loadInvestments(); openModal('investmentsModal'); });

    $$('.modal-close, .btn-outline[id^="cancel"], #closeCategoriesBtn, #closeInvestmentsBtn, #closeInvestmentDetailModal, #closeNewInvestmentModal, #closeNewContributionModal, #closeDueTransactionsBtn, #backToCardsBtn, #closePayInvoiceConfirmModal, #closeDeleteConfirmModal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.currentTarget.closest('.modal-backdrop');
        if (modal) {
          if (e.currentTarget.id === 'backToCardsBtn') {
              closeModal('cardInvoiceModal');
              openModal('cardsListModal');
          } else {
              closeModal(modal.id);
          }
        }
      });
    });

    $$('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          closeModal(backdrop.id);
        }
      });
    });


    $('#saveIncomeBtn').addEventListener('click', async () => {
      const name = $('#incomeName').value.trim();
      const amount = parseFloat($('#incomeAmount').value);
      if (!name || !amount || amount <= 0) { showToast('Nome e valor válido são obrigatórios.', 'error'); return; }

      const formData = {
        type: 'income', name, amount,
        category: $('#incomeCategory').value,
        date: localDateToISOString(getDateInputValue('incomeDate')), 
        paymentMethod: $('#incomePaymentMethod').value,
        status: $('input[name="incomeStatus"]:checked') ? $('input[name="incomeStatus"]:checked').value : 'pending', 
        notes: $('#incomeNotes').value.trim(),
        isRecurrent: $('#incomeIsRecurrent').checked,
        dueDate: localDateToISOString(getDateInputValue('incomeDate')) 
      };

      if (formData.isRecurrent) {
          formData.status = 'pending'; 
      }

      if (formData.isRecurrent) {
        const installments = parseInt($('#incomeInstallments').value);
        if (installments >= 2) await addRecurrentTransactions(formData, installments);
        else await addTransaction(formData); 
      } else {
        await addTransaction(formData);
      }
      closeModal('incomeModal');
    });

    $('#saveExpenseBtn').addEventListener('click', async () => {
      const name = $('#expenseName').value.trim();
      const amount = parseFloat($('#expenseAmount').value);
      const paymentMethod = $('#expensePaymentMethod').value;
      const creditCardId = $('#expenseCreditCard').value;
      const isFixedChecked = $('input[name="expenseType"]:checked');

      if (!name || !amount || amount <= 0) { showToast('Nome e valor válido são obrigatórios.', 'error'); return; }
      if (!isFixedChecked) { showToast('Selecione se a despesa é Fixa ou Variável.', 'error'); return; }
      if (paymentMethod === 'credito' && !creditCardId) { showToast('Selecione um cartão de crédito.', 'error'); return; }

      let formData = {
        type: 'expense', name, amount, paymentMethod,
        category: $('#expenseCategory').value,
        person: $('#expensePerson').value || null, 
        isFixed: isFixedChecked.value,
        date: localDateToISOString(getDateInputValue('expenseDate')), 
        dueDate: null, 
        status: $('input[name="expenseStatus"]:checked') ? $('input[name="expenseStatus"]:checked').value : 'pending', 
        notes: $('#expenseNotes').value.trim(),
        isRecurrent: $('#expenseIsRecurrent').checked,
        creditCardId: paymentMethod === 'credito' ? creditCardId : null,
        scheduledDate: null
      };

      if (paymentMethod === 'credito' && creditCardId && formData.date) {
          const card = state.cards.find(c => c.id === creditCardId);
          const launchDate = parseLocalDateString(formData.date);
          if (card && launchDate) {
              const realDueDate = calcularVencimentoReal(launchDate, card);
              if (realDueDate) formData.dueDate = localDateToISOString(realDueDate);
          }
      } else if (getDateInputValue('expenseDueDate')) { 
          formData.dueDate = localDateToISOString(getDateInputValue('expenseDueDate'));
      } else { 
          formData.dueDate = formData.date;
      }


      if (paymentMethod === 'credito' || formData.isRecurrent) {
          formData.status = 'pending';
      } else if (formData.status === 'scheduled') {
          formData.scheduledDate = localDateToISOString(getDateInputValue('expenseScheduledDate'));
          if (!formData.scheduledDate) { showToast('Informe a data de agendamento.', 'error'); return; }
      }


      if (formData.isRecurrent) {
        const installments = parseInt($('#expenseInstallments').value);
        if (installments >= 2) await addRecurrentTransactions(formData, installments);
        else await addTransaction(formData);
      } else {
        await addTransaction(formData);
      }
      closeModal('expenseModal');
    });

    $('#saveEditBtn').addEventListener('click', async () => {
      const id = $('#editTransactionId').value;
      const type = $('#editTransactionType').value;
      const name = $('#editName').value.trim();
      const amount = parseFloat($('#editAmount').value);
      const paymentMethod = $('#editPaymentMethod').value;
      const creditCardId = $('#editCreditCard').value;
      const isFixedChecked = $('input[name="editExpenseType"]:checked');

      if (!name || !amount || amount <= 0) { showToast('Nome e valor válido são obrigatórios.', 'error'); return; }
      if (type === 'expense' && !isFixedChecked) { showToast('Selecione se a despesa é Fixa ou Variável.', 'error'); return; }
      if (paymentMethod === 'credito' && !creditCardId) { showToast('Selecione um cartão de crédito.', 'error'); return; }

      const updates = {
        name, amount, paymentMethod,
        category: $('#editCategory').value,
        person: $('#editPerson').value || null,
        date: localDateToISOString(getDateInputValue('editDate')), 
        notes: $('#editNotes').value.trim(),
        isRecurrent: $('#editIsRecurrent').checked, 
        creditCardId: paymentMethod === 'credito' ? creditCardId : null,
        dueDate: null 
      };

      if (paymentMethod === 'credito' && creditCardId && updates.date) {
          const card = state.cards.find(c => c.id === creditCardId);
          const launchDate = parseLocalDateString(updates.date);
          if (card && launchDate) {
              const realDueDate = calcularVencimentoReal(launchDate, card);
              if (realDueDate) updates.dueDate = localDateToISOString(realDueDate);
          }
      } else if (getDateInputValue('editDueDate')) { 
          updates.dueDate = localDateToISOString(getDateInputValue('editDueDate'));
      } else { 
          updates.dueDate = updates.date;
      }


      if (type === 'expense') {
        updates.isFixed = isFixedChecked.value;
        updates.status = $('input[name="editStatus"]:checked') ? $('input[name="editStatus"]:checked').value : 'pending';
        if (updates.status === 'scheduled') {
            updates.scheduledDate = localDateToISOString(getDateInputValue('editScheduledDate'));
            if (!updates.scheduledDate) { showToast('Informe a data de agendamento.', 'error'); return; }
        } else {
            updates.scheduledDate = null;
        }
      } else { 
        updates.status = $('input[name="editStatus"]:checked') ? $('input[name="editStatus"]:checked').value : 'pending';
      }

      const currentTransaction = state.transactions.find(t => t.id === id);
      if ((paymentMethod === 'credito' || updates.isRecurrent) &&
          currentTransaction?.status !== 'paid' && currentTransaction?.status !== 'received' &&
          updates.status !== 'paid' && updates.status !== 'received') { 
          updates.status = 'pending';
      }

      await updateTransaction(id, updates);
      closeModal('editModal');
    }); 

    $('#confirmDeleteBtn').addEventListener('click', async () => {
      const id = state.currentTransaction?.id;
      if (!id) return;
      const deleteOption = $('#deleteAllFuture').checked ? 'future' : 'single';
      await deleteTransaction(id, { deleteOption });
      closeModal('deleteConfirmModal');
    });

    $('#saveCardBtn').addEventListener('click', async () => {
      const name = $('#cardName').value.trim();
      const limit = parseFloat($('#cardLimit').value);
      const closingDay = parseInt($('#cardClosingDay').value);
      const dueDay = parseInt($('#cardDueDay').value);
      const cardId = $('#saveCardBtn').dataset.id;

      if (!name || !limit || limit <= 0 || !closingDay || closingDay < 1 || closingDay > 31 || !dueDay || dueDay < 1 || dueDay > 31) {
        showToast('Preencha todos os campos do cartão corretamente.', 'error'); return;
      }
      const cardData = { name, limit, closingDay, dueDay };
      if (cardId) await updateCard(cardId, cardData);
      else await addCard(cardData);
      closeModal('newCardModal');
    });

    $('#confirmPayInvoiceBtn').addEventListener('click', async () => {
      if (state.currentCard) await payCardInvoice(state.currentCard.id);
    });

    $('#payInvoiceBtn').addEventListener('click', () => {
      if (state.currentCard) {
        openModal('payInvoiceConfirmModal');
      }
    });

    $('#addIncomeCategoryBtn').addEventListener('click', async () => {
      const name = $('#newIncomeCategoryInput').value.trim();
      const icon = $('#newIncomeCategoryIconInput').value.trim();
      if (await addCategory(name, icon, 'income')) {
        $('#newIncomeCategoryInput').value = ''; $('#newIncomeCategoryIconInput').value = ''; $('#newIncomeCategoryIconPreview').innerHTML = '💰';
      }
    });
    $('#addExpenseCategoryBtn').addEventListener('click', async () => {
      const name = $('#newExpenseCategoryInput').value.trim();
      const icon = $('#newExpenseCategoryIconInput').value.trim();
      if (await addCategory(name, icon, 'expense')) {
        $('#newExpenseCategoryInput').value = ''; $('#newExpenseCategoryIconInput').value = ''; $('#newExpenseCategoryIconPreview').innerHTML = '🛍️';
      }
    });
    $('#addInvestmentCategoryBtn').addEventListener('click', async () => {
      const name = $('#newInvestmentCategoryInput').value.trim();
      const icon = $('#newInvestmentCategoryIconInput').value.trim();
      if (await addCategory(name, icon, 'investment')) {
        $('#newInvestmentCategoryInput').value = ''; $('#newInvestmentCategoryIconInput').value = ''; $('#newInvestmentCategoryIconPreview').innerHTML = '📈';
      }
    });
    $('#addPaymentMethodBtn').addEventListener('click', async () => {
      const name = $('#newPaymentMethodInput').value.trim();
      const icon = $('#newPaymentMethodIconInput').value.trim();
      if (await addPaymentMethod(name, icon)) {
        $('#newPaymentMethodInput').value = ''; $('#newPaymentMethodIconInput').value = ''; $('#newPaymentMethodIconPreview').innerHTML = '💳';
      }
    });
    $('#addPersonBtn').addEventListener('click', async () => {
      const name = $('#newPersonInput').value.trim();
      const icon = $('#newPersonIconInput').value.trim();
      if (await addPerson(name, icon)) {
        $('#newPersonInput').value = ''; $('#newPersonIconInput').value = ''; $('#newPersonIconPreview').innerHTML = '👤';
      }
    });

    $('#saveEditCategoryBtn').addEventListener('click', async () => {
      const id = $('#editCategoryId').value;
      const type = $('#editCategoryType').value;
      const name = $('#editCategoryName').value.trim();
      const icon = $('#editCategoryIconInput').value.trim();
      if (!name) { showToast('Nome não pode ser vazio.', 'error'); return; }
      const updates = { name, icon };
      let success = false;
      if (type === 'income' || type === 'expense' || type === 'investment') success = await updateCategory(id, updates, type);
      else if (type === 'paymentMethod') success = await updatePaymentMethod(id, updates);
      else if (type === 'person') success = await updatePerson(id, updates);
      if (success) closeModal('editCategoryModal');
    });

    $('#expensePaymentMethod').addEventListener('change', () => {
        handleCreditCardGroupVisibility('expense');
        handleDueDateForCard('expense');
        handleStatusFieldVisibility('expense');
    });
    $('#expenseCreditCard').addEventListener('change', () => handleDueDateForCard('expense'));
    $('#expenseDate').addEventListener('change', () => handleDueDateForCard('expense')); 
    $('#expenseDueDate').addEventListener('change', () => { /* Apenas para o usuário mudar manualmente se não for cartão */ });
    $('#expenseIsRecurrent').addEventListener('change', () => {
        handleRecurrenceGroupVisibility('expense');
        handleStatusFieldVisibility('expense');
    });
    $$('input[name="expenseStatus"]').forEach(r => r.addEventListener('change', () => handleScheduledDateVisibility('expense')));

    $('#incomeIsRecurrent').addEventListener('change', () => {
        handleRecurrenceGroupVisibility('income');
        handleStatusFieldVisibility('income');
    });

    $('#editPaymentMethod').addEventListener('change', () => {
        handleEditCreditCardVisibility();
        handleEditDueDateForCard();
        handleEditStatusFieldVisibility();
    });
    $('#editCreditCard').addEventListener('change', () => handleEditDueDateForCard());
    $('#editDate').addEventListener('change', () => handleEditDueDateForCard()); 
    $('#editDueDate').addEventListener('change', () => { /* Apenas para o usuário mudar manualmente se não for cartão */ });
    $('#editIsRecurrent').addEventListener('change', () => {
        handleEditRecurrenceGroupVisibility();
        handleEditStatusFieldVisibility();
        $('#editInstallments').disabled = !$('#editIsRecurrent').checked || !!state.currentTransaction?.recurrenceId; 
    });
    $('#editModal').addEventListener('change', e => {
        if (e.target.matches('input[name="editStatus"]')) {
            handleEditScheduledDateVisibility();
        }
    });


    const setupIconPreview = (inputId, previewId, defaultIcon) => {
      const input = $(`#${inputId}`); const preview = $(`#${previewId}`);
      if (input && preview) input.addEventListener('input', e => preview.innerHTML = e.target.value.trim() || defaultIcon);
    };
    setupIconPreview('newIncomeCategoryIconInput', 'newIncomeCategoryIconPreview', '💰');
    setupIconPreview('newExpenseCategoryIconInput', 'newExpenseCategoryIconPreview', '🛍️');
    setupIconPreview('newInvestmentCategoryIconInput', 'newInvestmentCategoryIconPreview', '📈');
    setupIconPreview('newPaymentMethodIconInput', 'newPaymentMethodIconPreview', '💳');
    setupIconPreview('newPersonIconInput', 'newPersonIconPreview', '👤');
    setupIconPreview('editCategoryIconInput', 'editCategoryIconPreview', '●');

    $('#newCardBtn').addEventListener('click', () => {
      $('#cardForm').reset();
      $('.modal-title', $('#newCardModal')).textContent = 'Novo Cartão';
      $('#saveCardBtn').textContent = 'Salvar Cartão';
      $('#saveCardBtn').removeAttribute('data-id');
      closeModal('cardsListModal');
      openModal('newCardModal');
    });

    $('#newInvestmentBtn').addEventListener('click', openNewInvestmentModal);

    $('#saveInvestmentBtn').addEventListener('click', async () => {
      const name = $('#investmentName').value.trim();
      const amount = parseFloat($('#investmentAmount').value);
      const goal = parseFloat($('#investmentGoal').value) || null;
      const category = $('#investmentCategorySelect').value;
      const targetDate = getDateInputValue('investmentTargetDate');
      const notes = $('#investmentNotes').value.trim();
      const action = $('#saveInvestmentBtn').dataset.action;
      const id = $('#saveInvestmentBtn').dataset.id;

      if (!name || amount === undefined || amount < 0) { showToast('Nome e valor inicial válido são obrigatórios.', 'error'); return; }
      if (!category) { showToast('Selecione uma categoria.', 'error'); return; }

      const formData = { name, amount, goal, category, targetDate: targetDate ? localDateToISOString(targetDate) : null, notes };

      let success = false;
      if (action === 'update' && id) success = await updateInvestment(id, formData);
      else success = await addInvestment(formData);

      if (success) {
          closeModal('newInvestmentModal');
          if (action === 'add' && success && typeof success === 'object' && success.id) {
              openInvestmentDetail(success.id);
          } else if (action === 'update' && state.currentInvestment?.id === id) {
              openInvestmentDetail(id);
          }
      }
    });

    $('#addInvestmentContributionBtn').addEventListener('click', openNewContributionModal);

    $('#saveContributionBtn').addEventListener('click', async () => {
      const amount = parseFloat($('#contributionAmount').value);
      const date = getDateInputValue('contributionDate');
      const description = $('#contributionDescription').value.trim();
      const investmentId = $('#contributionInvestmentId').value;
      const action = $('#saveContributionBtn').dataset.action;
      const id = $('#saveContributionBtn').dataset.id;

      if (!amount || amount <= 0 || !date || !investmentId) { showToast('Valor, data e ID do investimento são obrigatórios.', 'error'); return; }

      const formData = { investmentId, amount, date: localDateToISOString(date), description };

      let success = false;
      if (action === 'update' && id) success = await updateContribution(id, formData);
      else success = await addContribution(formData);

      if (success) closeModal('newContributionModal');
    });

    $('#editInvestmentBtn').addEventListener('click', () => {
      if (state.currentInvestment) openEditInvestmentModal(state.currentInvestment.id);
    });

    $('#deleteInvestmentBtn').addEventListener('click', () => {
      if (state.currentInvestment && confirm('Excluir este investimento e todos os aportes?')) {
        deleteInvestment(state.currentInvestment.id);
      }
    });

    $('#backToInvestmentsBtn').addEventListener('click', () => {
      closeModal('investmentDetailModal');
      openModal('investmentsModal');
    });

    $('#commitmentsHeader').addEventListener('click', toggleCommitments);

    initTabs();

  }; 

  const initTabs = () => {
    $$('[data-toggle="tab"]').forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('href');
        const targetPane = $(targetId);
        if (!targetPane) return;

        const tabGroup = e.currentTarget.closest('.nav-tabs');
        const contentGroup = targetPane.closest('.tab-content');
        if (!tabGroup || !contentGroup) return;

        tabGroup.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        contentGroup.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active', 'show'));

        e.currentTarget.classList.add('active');
        targetPane.classList.add('active');
        void targetPane.offsetWidth; 
        targetPane.classList.add('show');
      });
    });
  };

  const initApp = async () => {
    try {
      initTheme();
      initTabs();

      const today = new Date();
      state.year = today.getFullYear();
      state.month = today.getMonth();
      updateYearOptions();
      $('#yearSelect').value = state.year;
      $('#monthSelect').value = state.month;

      // Cria instâncias dos gráficos ANTES de carregar os dados
      createCharts(); 

      await loadCategoriesAndPaymentMethods();
      await loadCards();
      await loadInvestments();
      await loadTransactions(); // Esta função chama fullUIRefresh() que chama updateCharts()

      initEventListeners(); 

      showToast('Bem-vindo(a)!', 'success');
    } catch (error) {
      console.error('Erro ao inicializar:', error);
      showToast('Erro ao inicializar. Tente recarregar.', 'error');
    }
  };

  document.addEventListener('DOMContentLoaded', initApp);