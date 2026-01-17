import React, { useEffect, useState } from "react";
import { auth, provider, db } from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  addDoc
} from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [todayPassengers, setTodayPassengers] = useState([]);
  const [suggestedDriver, setSuggestedDriver] = useState("");
  const [debts, setDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState("light");

  // Login / Logout
  const login = async () => await signInWithPopup(auth, provider);
  const logout = async () => await signOut(auth);

  // Observador de sesión
  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Cargar participantes y deudas
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, "participants"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParticipants(data);
    });

    const unsubD = onSnapshot(doc(db, "debts", "all"), (docSnap) => {
      if (docSnap.exists()) setDebts(docSnap.data());
    });

    const unsubH = onSnapshot(collection(db, "history"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistory(data.sort((a,b)=> new Date(b.date)-new Date(a.date)));
    });

    return () => {
      unsubP();
      unsubD();
      unsubH();
    };
  }, []);

  // Añadir participante
  const addParticipant = async (name) => {
    const p = await addDoc(collection(db, "participants"), { name });
    alert(`Participante ${name} añadido`);
  };

  // Editar participante
  const editParticipant = async (id, newName) => {
    if (!window.confirm(`Confirmas cambiar el nombre?`)) return;
    await updateDoc(doc(db, "participants", id), { name: newName });
    alert(`Nombre cambiado a ${newName}`);
  };

  // Eliminar participante
  const removeParticipant = async (id) => {
    if (!window.confirm(`Confirmas eliminar participante?`)) return;
    await updateDoc(doc(db, "participants", id), { deleted: true });
    alert(`Participante eliminado`);
  };

  // Sugerir conductor
  const suggestDriver = () => {
    if (todayPassengers.length === 0) return;
    let minDebt = Infinity;
    let driver = todayPassengers[0];
    todayPassengers.forEach((p) => {
      let total = 0;
      todayPassengers.forEach((other) => {
        if (other !== p) total += debts[p]?.[other] || 0;
      });
      if (total < minDebt) {
        minDebt = total;
        driver = p;
      }
    });
    setSuggestedDriver(driver);
  };

  useEffect(() => suggestDriver(), [todayPassengers, debts]);

  // Confirmar viaje
  const confirmTrip = async () => {
    if (!suggestedDriver) return;
    const trip = {
      date: new Date().toISOString(),
      driver: suggestedDriver,
      passengers: todayPassengers
    };
    await addDoc(collection(db, "history"), trip);

    // Actualizar deudas
    const newDebts = { ...debts };
    todayPassengers.forEach((p) => {
      if (p !== suggestedDriver) {
        newDebts[p] = newDebts[p] || {};
        newDebts[p][suggestedDriver] = (newDebts[p][suggestedDriver] || 0) + 1;
      }
    });
    setDebts(newDebts);
    await setDoc(doc(db, "debts", "all"), newDebts);

    setTodayPassengers([]);
    alert("Viaje confirmado");
  };

  // Reset seguro
  const resetAll = async () => {
    if (!window.confirm("¿Estás seguro de resetear todo?")) return;
    if (!window.confirm("Esto borrará todo historial y deudas. Confirmar de nuevo")) return;

    // Reset deudas
    await setDoc(doc(db, "debts", "all"), {});
    // Reset historial
    const hCol = collection(db, "history");
    history.forEach(async (h) => await updateDoc(doc(db, "history", h.id), { deleted: true }));

    alert("Todo reseteado");
  };

  const toggleTheme = () => setTheme(theme==="light"?"dark":"light");

  if (!user) return <button onClick={login}>Login con Google</button>;

  return (
    <div className={theme}>
      <header>
        <h1>Coche Compartido</h1>
        <button onClick={logout}>Salir</button>
        <button onClick={toggleTheme}>Modo {theme==="light"?"Oscuro":"Claro"}</button>
      </header>

      <section>
        <h2>Participantes</h2>
        <ul>
          {participants.filter(p=>!p.deleted).map(p => (
            <li key={p.id}>
              {p.name}
              <button onClick={()=>editParticipant(p.id,p.name)}>Editar</button>
              <button onClick={()=>removeParticipant(p.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
        <input id="newP" placeholder="Nuevo participante" />
        <button onClick={()=>{const n=document.getElementById("newP").value; if(n) addParticipant(n)}}>Añadir</button>
      </section>

      <section>
        <h2>Viaje de hoy</h2>
        <select multiple value={todayPassengers} onChange={(e)=>setTodayPassengers([...e.target.selectedOptions].map(o=>o.value))}>
          {participants.filter(p=>!p.deleted).map(p=>(
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div>
          <h3>Conductor sugerido:</h3>
          <input value={suggestedDriver} onChange={e=>setSuggestedDriver(e.target.value)} />
        </div>
        <button onClick={confirmTrip}>Confirmar Viaje</button>
        <button onClick={resetAll}>Reset Seguro</button>
      </section>

      <section>
        <h2>Historial (últimos 20 viajes)</h2>
        <ul>
          {history.slice(0,20).map(h => (
            <li key={h.id}>{new Date(h.date).toLocaleDateString()} - {h.driver} - {h.passengers.join(", ")}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
