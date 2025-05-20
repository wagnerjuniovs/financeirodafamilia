// Configurações do Firebase - Nossa ponte para a nuvem
const firebaseConfig = {
  apiKey: "AIzaSyDvL_nYWhv_8rPouejiWbDZtDCKHYOQyEY",
  authDomain: "calculadora-da-familia.firebaseapp.com",
  projectId: "calculadora-da-familia",
  storageBucket: "calculadora-da-familia.appspot.com",
  messagingSenderId: "69721783786",
  appId: "1:69721783786:web:c4703b5c182e3681e8c693",
  measurementId: "G-YM5TR661S6"
};

// Inicializando o Firebase
let db;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  db.enablePersistence({experimentalForceOwningTab: true}).catch(err => console.warn('Firebase persistence error:', err.code));
  console.log('Firebase inicializado.');
} catch (error) {
  console.error('Erro Firebase:', error);
  // Criamos um "banco de dados falso" se o Firebase não funcionar
  db = { 
    collection: () => ({ 
      get: () => Promise.resolve({ docs: [], empty: true }), 
      doc: () => ({ 
        get: () => Promise.resolve({ exists: false, data: () => ({}) }), 
        set: () => Promise.resolve(), 
        update: () => Promise.resolve(), 
        delete: () => Promise.resolve() 
      }), 
      add: () => Promise.resolve({ id: 'temp-id' }) 
    }) 
  };
}