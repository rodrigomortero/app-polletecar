// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDFz376Q836_lhBgf4rFRXEn9HgS3JZz2E",
  authDomain: "app-polletecar.firebaseapp.com",
  projectId: "app-polletecar",
  storageBucket: "app-polletecar.firebasestorage.app",
  messagingSenderId: "977283664483",
  appId: "1:977283664483:web:dfbd5518c3ac19d7acc656"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

