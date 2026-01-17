// Importa Firebase
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDFz376Q836_lhBgf4rFRXEn9HgS3JZz2E",
  authDomain: "app-polletecar.firebaseapp.com",
  projectId: "app-polletecar",
  storageBucket: "app-polletecar.appspot.com",
  messagingSenderId: "977283664483",
  appId: "1:977283664483:web:dfbd5518c3ac19d7acc656"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
