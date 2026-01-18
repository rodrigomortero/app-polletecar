// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDFz376Q836_lhBgf4rFRXEn9HgS3JZz2E",
  authDomain: "app-polletecar.firebaseapp.com",
  projectId: "app-polletecar",
  storageBucket: "app-polletecar.firebasestorage.app",
  messagingSenderId: "977283664483",
  appId: "1:977283664483:web:dfbd5518c3ac19d7acc656"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Autenticación y proveedor Google
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Base de datos Firestore
const db = getFirestore(app);

// Exportamos para poder usarlos en App.js
export { auth, provider, db };
