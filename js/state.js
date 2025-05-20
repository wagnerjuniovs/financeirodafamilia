// Estado Global - O cérebro do nosso site
const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  transactions: [],
  cards: [],
  filteredTransactions: [],
  insights: [],
  sortColumn: 'dueDate', 
  sortDirection: 'asc', 
  filters: {
    category: '',
    status: '',
    paymentMethod: '',
    person: '',
    transactionType: '' 
  },
  categories: {
    income: [
      { id: 'salario', name: 'Salário', icon: '💰', type: 'income' },
      { id: 'investimentos_income', name: 'Rend. Investimentos', icon: '📈', type: 'income' },
      { id: 'freelance', name: 'Freelance', icon: '💻', type: 'income' },
      { id: 'presente', name: 'Presente', icon: '🎁', type: 'income' },
      { id: 'outros_income', name: 'Outros', icon: 'ℹ️', type: 'income' }
    ],
    expense: [
      { id: 'alimentacao', name: 'Alimentação', icon: '🍔', type: 'expense' },
      { id: 'moradia', name: 'Moradia', icon: '🏠', type: 'expense' },
      { id: 'transporte', name: 'Transporte', icon: '🚗', type: 'expense' },
      { id: 'saude', name: 'Saúde', icon: '⚕️', type: 'expense' },
      { id: 'educacao', name: 'Educação', icon: '📚', type: 'expense' },
      { id: 'lazer', name: 'Lazer', icon: '🎮', type: 'expense' },
      { id: 'compras', name: 'Compras', icon: '🛍️', type: 'expense' },
      { id: 'contas', name: 'Contas e serviços', icon: '📝', type: 'expense' },
      { id: 'impostos', name: 'Impostos', icon: '💸', type: 'expense' },
      { id: 'outros_expense', name: 'Outros', icon: 'ℹ️', type: 'expense' }
    ],
    investment: [
      { id: 'viagem', name: 'Viagem', icon: '✈️', type: 'investment' },
      { id: 'emergencia', name: 'Emergência', icon: '🚨', type: 'investment' },
      { id: 'filho', name: 'Filho', icon: '👶', type: 'investment' },
      { id: 'tesouro', name: 'Tesouro Direto', icon: '🏛️', type: 'investment' },
      { id: 'acoes', name: 'Ações', icon: '📊', type: 'investment' },
      { id: 'outro_investment', name: 'Outro', icon: '💰', type: 'investment' }
    ]
  },
  paymentMethods: [
    { id: 'dinheiro', name: 'Dinheiro', icon: '💵' },
    { id: 'pix', name: 'Pix', icon: '⚡' },
    { id: 'debito', name: 'Débito', icon: '💳' },
    { id: 'debito_conta', name: 'Débito em Conta', icon: '🏦' },
    { id: 'transferencia', name: 'Transferência Bancária', icon: '🔄' },
    { id: 'boleto', name: 'Boleto', icon: '📄' },
    { id: 'credito', name: 'Cartão de Crédito', icon: '💳' }
  ],
  people: [
    { id: 'familia', name: 'Família', icon: '👨‍👩‍👧‍👦' },
    { id: 'wagner', name: 'Wagner', icon: '👨‍💻' },
    { id: 'barbara', name: 'Bárbara', icon: '👩‍🎨' },
    { id: 'joaquim', name: 'Joaquim', icon: '👶' }
  ],
  investments: [],
  investmentContributions: [],
  currentTransaction: null,
  currentCard: null,
  currentCategory: null,
  currentInvestment: null,
  currentContribution: null,
  themePreference: 'light'
};