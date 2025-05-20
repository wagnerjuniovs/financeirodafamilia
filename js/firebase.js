// Funções do Firebase - Nossa ponte mágica para a nuvem ☁️

// Função para carregar categorias, métodos de pagamento e pessoas
  const loadCategoriesAndPaymentMethods = async () => {
    try {
      const collectionsToLoad = [
        { name: 'categories', stateKey: 'categories', defaultKey: true, typeField: 'type' },
        { name: 'paymentMethods', stateKey: 'paymentMethods', defaultKey: false },
        { name: 'people', stateKey: 'people', defaultKey: false }
      ];

      for (const coll of collectionsToLoad) {
        const snapshot = await db.collection(coll.name).get();
        if (!snapshot.empty) {
          if (coll.defaultKey) { 
            state[coll.stateKey].income = [];
            state[coll.stateKey].expense = [];
            state[coll.stateKey].investment = [];
            snapshot.docs.forEach(doc => {
              const item = { id: doc.id, ...doc.data() };
              if (item[coll.typeField] === 'income') state[coll.stateKey].income.push(item);
              else if (item[coll.typeField] === 'expense') state[coll.stateKey].expense.push(item);
              else if (item[coll.typeField] === 'investment') state[coll.stateKey].investment.push(item);
            });
          } else {
            state[coll.stateKey] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
        } else if (state[coll.stateKey]) { 
          const batch = db.batch();
          if (coll.defaultKey) {
            Object.values(state[coll.stateKey]).flat().forEach(item => {
              const docRef = db.collection(coll.name).doc(item.id);
              batch.set(docRef, item); 
            });
          } else {
            state[coll.stateKey].forEach(item => {
              const docRef = db.collection(coll.name).doc(item.id);
              batch.set(docRef, item);
            });
          }
          await batch.commit();
        }
      }
      updateAllSelectsAndLists();
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      showToast('Erro ao carregar dados. Tente novamente.', 'error');
    }
  };

// Função para carregar cartões
  const loadCards = async () => {
    try {
      const snapshot = await db.collection('cards').get();
      state.cards = snapshot.docs.map(doc => {
          const card = { id: doc.id, ...doc.data() };
          card.currentInvoice = card.currentInvoice || 0; 
          card.availableLimit = card.limit - card.currentInvoice;
          return card;
      });
      updateCardsList();
      updateCreditCardSelects();
    } catch (error) {
      console.error('Erro ao carregar cartões:', error);
      showToast('Erro ao carregar cartões.', 'error');
    }
  };

// Função para carregar investimentos
  const loadInvestments = async () => {
    try {
      const [invSnapshot, contribSnapshot] = await Promise.all([
        db.collection('investments').get(),
        db.collection('investmentContributions').get()
      ]);
      state.investments = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      state.investmentContributions = contribSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderInvestmentCards();
    } catch (error) {
      console.error('Erro ao carregar investimentos:', error);
      showToast('Erro ao carregar investimentos.', 'error');
    }
  };

// Função para carregar transações
  const loadTransactions = async () => {
    try {
      const snapshot = await db.collection('transactions').get();
      state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await fullUIRefresh(); 
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      showToast('Erro ao carregar transações.', 'error');
    }
  };

// Função para adicionar transação
  const addTransaction = async (transactionData) => {
    try {
      const transaction = { ...transactionData, createdAt: localDateToISOString(new Date()) };
      const catList = transaction.type === 'income' ? state.categories.income : state.categories.expense;
      const category = catList.find(c => c.id === transaction.category);
      if (category) { transaction.categoryName = category.name; transaction.categoryIcon = category.icon; }
      
      const payment = state.paymentMethods.find(p => p.id === transaction.paymentMethod);
      if (payment) { transaction.paymentMethodName = payment.name; transaction.paymentMethodIcon = payment.icon; }

      if (transaction.person) {
          const personObj = state.people.find(p => p.id === transaction.person);
          if (personObj) { transaction.personName = personObj.name; transaction.personIcon = personObj.icon; }
      }

      if (transaction.type === 'expense' && transaction.paymentMethod === 'credito' && transaction.creditCardId && !transaction.isRecurrent) {
        await updateCardLimits(transaction.creditCardId, parseFloat(transaction.amount), 'add');
        const card = state.cards.find(c => c.id === transaction.creditCardId);
        if (card) transaction.creditCardName = card.name;
      }

      const docRef = await db.collection('transactions').add(transaction);
      transaction.id = docRef.id;
      state.transactions.push(transaction);
      await fullUIRefresh(); 
      showToast(`${transaction.type === 'income' ? 'Receita' : 'Despesa'} adicionada!`, 'success');
      return transaction;
    } catch (e) { console.error(e); showToast('Erro ao adicionar transação.', 'error'); return null; }
  };

// Função para adicionar transações recorrentes
  const addRecurrentTransactions = async (baseTransaction, installments) => {
    try {
      const recurrenceId = generateId();
      const batch = db.batch();
      const transactionsToAdd = [];
      const installmentAmount = parseFloat(baseTransaction.amount) / installments; 
      const totalPurchaseAmount = parseFloat(baseTransaction.amount);


      for (let i = 0; i < installments; i++) {
        const currentInstallmentLaunchDate = parseLocalDateString(baseTransaction.date);
        currentInstallmentLaunchDate.setUTCMonth(currentInstallmentLaunchDate.getUTCMonth() + i);
        
        let currentEffectiveDueDate = null;
        if (baseTransaction.paymentMethod === 'credito' && baseTransaction.creditCardId) {
            const card = state.cards.find(c => c.id === baseTransaction.creditCardId);
            if (card) {
                currentEffectiveDueDate = calcularVencimentoReal(currentInstallmentLaunchDate, card);
            }
        } else if (baseTransaction.dueDate) { 
            currentEffectiveDueDate = parseLocalDateString(baseTransaction.dueDate);
            currentEffectiveDueDate.setUTCMonth(currentEffectiveDueDate.getUTCMonth() + i);
        }


        const installment = { 
          ...baseTransaction, 
          amount: installmentAmount, 
          date: localDateToISOString(currentInstallmentLaunchDate), 
          dueDate: currentEffectiveDueDate ? localDateToISOString(currentEffectiveDueDate) : null, 
          recurrenceId, 
          installmentNumber: i + 1, 
          installments,
          isRecurrent: true 
        };
        delete installment.id; 

        const docRef = db.collection('transactions').doc(); 
        batch.set(docRef, installment);
        installment.id = docRef.id; 
        transactionsToAdd.push(installment);
      }
      
      if (baseTransaction.type === 'expense' && baseTransaction.paymentMethod === 'credito' && baseTransaction.creditCardId) {
          await updateCardLimits(baseTransaction.creditCardId, totalPurchaseAmount, 'add'); 
      }

      await batch.commit();
      state.transactions.push(...transactionsToAdd);
      await fullUIRefresh(); 
      showToast('Transação parcelada adicionada!', 'success');
      return transactionsToAdd;
    } catch (e) { console.error(e); showToast('Erro ao adicionar parcelas.', 'error'); return null; }
  };

// Função para atualizar transação
  const updateTransaction = async (id, updates) => {
    try {
      const transaction = state.transactions.find(t => t.id === id);
      if (!transaction) return;

      const oldAmount = parseFloat(transaction.amount);
      const oldPaymentMethod = transaction.paymentMethod;
      const oldCardId = transaction.creditCardId;
      const oldIsRecurrent = transaction.isRecurrent;

      if (updates.category) {
        const catList = updates.type === 'income' ? state.categories.income : state.categories.expense;
        const cat = catList.find(c => c.id === updates.category);
        if (cat) { updates.categoryName = cat.name; updates.categoryIcon = cat.icon; }
      }
      if (updates.paymentMethod) {
        const pay = state.paymentMethods.find(p => p.id === updates.paymentMethod);
        if (pay) { updates.paymentMethodName = pay.name; updates.paymentMethodIcon = pay.icon; }
      }
      if (updates.person) {
        const pers = state.people.find(p => p.id === updates.person);
        if (pers) { updates.personName = pers.name; updates.personIcon = pers.icon; }
      }
      if (updates.creditCardId) {
        const cardUpd = state.cards.find(c => c.id === updates.creditCardId);
        if (cardUpd) updates.creditCardName = cardUpd.name;
      }


      const newAmount = updates.amount !== undefined ? parseFloat(updates.amount) : oldAmount;
      const newPaymentMethod = updates.paymentMethod || oldPaymentMethod;
      const newCardId = updates.creditCardId || oldCardId;

      if (!oldIsRecurrent) { 
        if (oldPaymentMethod === 'credito' && newPaymentMethod === 'credito') { 
          if (oldCardId === newCardId) { 
            if (newAmount !== oldAmount) {
              await updateCardLimits(oldCardId, newAmount, 'update', oldAmount);
            }
          } else { 
            if (oldCardId) await updateCardLimits(oldCardId, oldAmount, 'subtract');
            if (newCardId) await updateCardLimits(newCardId, newAmount, 'add');
          }
        }
        else if (oldPaymentMethod !== 'credito' && newPaymentMethod === 'credito') { 
          if (newCardId) await updateCardLimits(newCardId, newAmount, 'add');
        }
        else if (oldPaymentMethod === 'credito' && newPaymentMethod !== 'credito') { 
          if (oldCardId) await updateCardLimits(oldCardId, oldAmount, 'subtract');
          updates.creditCardId = null; updates.creditCardName = null; 
        }
      }
      
      if (updates.date && updates.date instanceof Date) updates.date = localDateToISOString(updates.date);
      if (updates.dueDate && updates.dueDate instanceof Date) updates.dueDate = localDateToISOString(updates.dueDate);
      if (updates.scheduledDate && updates.scheduledDate instanceof Date) updates.scheduledDate = localDateToISOString(updates.scheduledDate);


      await db.collection('transactions').doc(id).update(updates);
      Object.assign(transaction, updates); 
      await fullUIRefresh(); 
      showToast('Transação atualizada!', 'success');
      return transaction;
    } catch (e) { console.error(e); showToast('Erro ao atualizar transação.', 'error'); return null; }
  };

// Função para deletar transação
  const deleteTransaction = async (id, options = {}) => {
    try {
      const transaction = state.transactions.find(t => t.id === id);
      if (!transaction) return;

      const isRecurrentSeries = transaction.isRecurrent && transaction.recurrenceId;
      
      if (isRecurrentSeries && options.deleteOption === 'future') {
        const futureParcels = state.transactions.filter(t => t.recurrenceId === transaction.recurrenceId && t.installmentNumber >= transaction.installmentNumber);
        const batch = db.batch();
        
        if (transaction.type === 'expense' && transaction.paymentMethod === 'credito' && transaction.creditCardId) {
            const firstParcelInSeries = state.transactions.find(t_series => 
                t_series.recurrenceId === transaction.recurrenceId && t_series.installmentNumber === 1
            );
            if (firstParcelInSeries) { 
                const totalPurchaseAmount = parseFloat(firstParcelInSeries.amount) * firstParcelInSeries.installments;
                await updateCardLimits(transaction.creditCardId, totalPurchaseAmount, 'subtract');
            }
        }

        futureParcels.forEach(parcel => {
          batch.delete(db.collection('transactions').doc(parcel.id));
        });
        await batch.commit();
        state.transactions = state.transactions.filter(t => !(t.recurrenceId === transaction.recurrenceId && t.installmentNumber >= transaction.installmentNumber));
      } else { 
        if (transaction.type === 'expense' && transaction.paymentMethod === 'credito' && transaction.creditCardId) {
            if (transaction.isRecurrent && transaction.recurrenceId) {
                await updateCardLimits(transaction.creditCardId, parseFloat(transaction.amount), 'subtract');
            } else { 
                 await updateCardLimits(transaction.creditCardId, parseFloat(transaction.amount), 'subtract');
            }
        }
        await db.collection('transactions').doc(id).delete();
        state.transactions = state.transactions.filter(t => t.id !== id);
      }
      await fullUIRefresh(); 
      showToast('Transação excluída!', 'success');
      return true;
    } catch (e) { console.error(e); showToast('Erro ao excluir transação.', 'error'); return false; }
  };

// Função para atualizar status da transação
  const updateTransactionStatus = async (id, status) => {
    try {
      const transaction = state.transactions.find(t => t.id === id);
      if (!transaction) return;
      
      const oldStatus = transaction.status;
      transaction.status = status; 
      
      await db.collection('transactions').doc(id).update({ status });

      if (transaction.type === 'expense' && transaction.paymentMethod === 'credito' && transaction.creditCardId) {
        const card = state.cards.find(c => c.id === transaction.creditCardId);
        if (card) {
            let amountChange = 0;
            if (status === 'paid' && oldStatus !== 'paid') { 
                amountChange = -parseFloat(transaction.amount);
            } else if (status !== 'paid' && oldStatus === 'paid') { 
                amountChange = parseFloat(transaction.amount);
            }

            if (amountChange !== 0) {
                card.currentInvoice = Math.max(0, (card.currentInvoice || 0) + amountChange);
                card.availableLimit = card.limit - card.currentInvoice;
                await db.collection('cards').doc(card.id).update({
                    currentInvoice: card.currentInvoice,
                    availableLimit: card.availableLimit
                });
            }
        }
      }
      await fullUIRefresh(); 
      showToast('Status da transação atualizado!', 'success');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status.', 'error');
    }
  };