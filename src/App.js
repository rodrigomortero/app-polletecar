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
  setDoc,
  getDoc,
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

  // Login
  const login = async () => {
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Observador de sesión
  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  // Cargar participantes y deudas de Firebase
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, "participants"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParticipants(data);
    });

    const unsubH = onSnapshot(collection(db, "history"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistory(data.sort((a,b)=> new Date(b.date)-new Date(a.date)));
    });

    return () => {
      unsubP();
      unsubH();
    };
  }, []);

  // Función para sugerir conductor
  const suggestDriver = () => {
    if (todayPassengers.length === 0) return;

    let minDebt = Infinity;
    let driver = todayPassengers[0];

    todayPassengers.forEach((p) => {
      let total = 0;
      todayPassengers.forEach((other) => {
        if (other !== p) {
          total += debts[p]?.[other] || 0;
        }
      });
      if (total < minDebt) {
        minDebt = total;
        driver = p;
      }
    });

    setSuggestedDriver(driver);
  };

  useEffect(() => {
    suggestDriver();
  }, [todayPassengers, debts]);

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
  };

  // Toggle tema
  const toggleTheme = () => {
    setTheme(theme==="light"?"dark":"light");
  };

  if (!user) {
    return <button onClick={login}>Login con Google</button>;
  }

  return (
    <div className={theme}>
      <header>
        <h1>App Coche Compartido</h1>
        <button onClick={logout}>Salir</button>
        <button onClick={toggleTheme}>Modo {theme==="light"?"Oscuro":"Claro"}</button>
      </header>

      <section>
        <h2>Participantes</h2>
        <ul>
          {participants.map(p => <li key={p.id}>{p.name}</li>)}
        </ul>
      </section>

      <section>
        <h2>Viaje de hoy</h2>
        <select multiple
          value={todayPassengers}
          onChange={(e)=>setTodayPassengers([...e.target.selectedOptions].map(o=>o.value))}
        >
          {participants.map(p=>(
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div>
          <h3>Conductor sugerido:</h3>
          <input value={suggestedDriver} onChange={e=>setSuggestedDriver(e.target.value)} />
        </div>
        <button onClick={confirmTrip}>Confirmar Viaje</button>
      </section>

      <section>
        <h2>Historial (últimos 20 viajes)</h2>
        <ul>
          {history.slice(0,20).map(h=>(
            <li key={h.id}>{new Date(h.date).toLocaleDateString()} - {h.driver} - Pasajeros: {h.passengers.join(", ")}</li>
          ))}
        </ul>
      </section>

    </div>
  );
}

export default App;
