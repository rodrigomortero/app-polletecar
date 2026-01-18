import React, { useState, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [todayPassengers, setTodayPassengers] = useState([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [suggestedDriver, setSuggestedDriver] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [debts, setDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [activity, setActivity] = useState([]);

  // Autenticación
  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
  }, []);

  const login = async () => {
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // Cargar datos de Firestore
  useEffect(() => {
    const unsubPart = onSnapshot(doc(db, "carpool", "participants"), (docSnap) => {
      if (docSnap.exists()) setParticipants(docSnap.data().list || []);
    });
    const unsubDebt = onSnapshot(doc(db, "carpool", "debts"), (docSnap) => {
      if (docSnap.exists()) setDebts(docSnap.data() || {});
    });
    const unsubHist = onSnapshot(doc(db, "carpool", "history"), (docSnap) => {
      if (docSnap.exists()) setHistory(docSnap.data().list || []);
    });
    const unsubAct = onSnapshot(doc(db, "carpool", "activity"), (docSnap) => {
      if (docSnap.exists()) setActivity(docSnap.data().list || []);
    });
    return () => {
      unsubPart(); unsubDebt(); unsubHist(); unsubAct();
    };
  }, []);

  // Añadir participante
  const addParticipant = async () => {
    if (!newParticipant.trim() || participants.includes(newParticipant.trim())) return;
    const updated = [...participants, newParticipant.trim()];
    await setDoc(doc(db, "carpool", "participants"), { list: updated });
    setActivity(prev => [...prev, {
      user: user.email,
      action: "Añadió participante",
      target: newParticipant.trim(),
      timestamp: new Date().toISOString()
    }]);
    setNewParticipant("");
  };

  // Eliminar participante con doble confirmación
  const removeParticipant = async (p) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${p}?`)) return;
    if (!window.confirm(`¿Realmente quieres eliminar a ${p}? Esta acción no se puede deshacer.`)) return;
    const updated = participants.filter(x => x !== p);
    await setDoc(doc(db, "carpool", "participants"), { list: updated });
    setActivity(prev => [...prev, {
      user: user.email,
      action: "Eliminó participante",
      target: p,
      timestamp: new Date().toISOString()
    }]);
  };

  // Seleccionar quién va hoy
  const toggleTodayPassenger = (p) => {
    if (todayPassengers.includes(p)) {
      setTodayPassengers(todayPassengers.filter(x => x !== p));
    } else {
      setTodayPassengers([...todayPassengers, p]);
    }
  };

  // Calcular sugerencia de conductor según deudas
  const suggestDriver = () => {
    if (todayPassengers.length === 0) {
      setSuggestedDriver("");
      return;
    }
    let maxDebt = -1;
    let driver = todayPassengers[0];
    todayPassengers.forEach(p => {
      let totalDebt = 0;
      todayPassengers.forEach(other => {
        if (other !== p) {
          const key = `${p}-${other}`;
          totalDebt += debts[key] || 0;
        }
      });
      if (totalDebt > maxDebt) {
        maxDebt = totalDebt;
        driver = p;
      }
    });
    setSuggestedDriver(driver);
    setSelectedDriver(driver);
  };

  // Confirmar viaje
  const confirmTrip = async () => {
    if (!selectedDriver) return;
    // Actualizar deudas
    const updatedDebts = { ...debts };
    todayPassengers.forEach(p => {
      if (p !== selectedDriver) {
        const key = `${p}-${selectedDriver}`;
        const revKey = `${selectedDriver}-${p}`;
        const prev = updatedDebts[key] || 0;
        const rev = updatedDebts[revKey] || 0;
        const net = prev - rev + 1;
        if (net >= 0) {
          updatedDebts[key] = net;
          updatedDebts[revKey] = 0;
        } else {
          updatedDebts[key] = 0;
          updatedDebts[revKey] = -net;
        }
      }
    });
    await setDoc(doc(db, "carpool", "debts"), updatedDebts);

    // Actualizar historial
    const newEntry = {
      date: new Date().toISOString(),
      passengers: [...todayPassengers],
      driver: selectedDriver
    };
    const updatedHistory = [...history, newEntry].slice(-20);
    await setDoc(doc(db, "carpool", "history"), { list: updatedHistory });

    setActivity(prev => [...prev, {
      user: user.email,
      action: "Confirmó viaje",
      target: selectedDriver,
      timestamp: new Date().toISOString()
    }]);

    setTodayPassengers([]);
    setSuggestedDriver("");
    setSelectedDriver("");
  };

  // Reset total con doble confirmación
  const resetAll = async () => {
    if (!window.confirm("¿Seguro que quieres borrar TODO?")) return;
    if (!window.confirm("Realmente quieres borrar TODOS los datos?")) return;
    await setDoc(doc(db, "carpool", "participants"), { list: [] });
    await setDoc(doc(db, "carpool", "debts"), {});
    await setDoc(doc(db, "carpool", "history"), { list: [] });
    await setDoc(doc(db, "carpool", "activity"), { list: [] });
  };

  // Mostrar deudas de conductor con pasajeros de hoy
  const driverDebts = () => {
    if (!selectedDriver) return [];
    return todayPassengers
      .filter(p => p !== selectedDriver)
      .map(p => {
        const key = `${p}-${selectedDriver}`;
        const revKey = `${selectedDriver}-${p}`;
        const net = (debts[key] || 0) - (debts[revKey] || 0);
        return `${selectedDriver} ↔ ${p}: ${net}`;
      });
  };

  return (
    <div className="App">
      <h1>App Polletecar</h1>
      {!user ? (
        <button onClick={login}>Entrar con Google</button>
      ) : (
        <div>
          <p>Conectado como {user.email} <button onClick={logout}>Salir</button></p>

          <h2>Participantes habituales</h2>
          <input value={newParticipant} onChange={e => setNewParticipant(e.target.value)} placeholder="Nuevo participante" />
          <button onClick={addParticipant}>Añadir</button>
          <ul>
            {participants.map(p => (
              <li key={p}>
                {p} <button onClick={() => removeParticipant(p)}>Eliminar</button>
                <button onClick={() => toggleTodayPassenger(p)}>
                  {todayPassengers.includes(p) ? "No va hoy" : "Va hoy"}
                </button>
              </li>
            ))}
          </ul>

          <h2>Selección de conductor</h2>
          <button onClick={suggestDriver}>Sugerir conductor</button>
          {suggestedDriver && <p><b>Sugerencia:</b> {suggestedDriver}</p>}
          {selectedDriver && (
            <div>
              <p>Deudas del conductor con pasajeros de hoy:</p>
              <ul>
                {driverDebts().map(d => <li key={d}>{d}</li>)}
              </ul>
            </div>
          )}
          <h3>Seleccionar conductor manualmente</h3>
          {todayPassengers.map(p => (
            <button key={p} onClick={() => setSelectedDriver(p)}>
              {p}
            </button>
          ))}
          <div>
            <button onClick={confirmTrip}>Confirmar viaje</button>
          </div>

          <h2>Deudas actuales</h2>
          <table border="1">
            <thead>
              <tr>
                <th>De</th>
                {participants.map(p => <th key={p}>{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {participants.map(p1 => (
                <tr key={p1}>
                  <td>{p1}</td>
                  {participants.map(p2 => {
                    if (p1 === p2) return <td key={p2}>-</td>;
                    const key = `${p1}-${p2}`;
                    const revKey = `${p2}-${p1}`;
                    const net = (debts[key] || 0) - (debts[revKey] || 0);
                    return <td key={p2}>{net > 0 ? net : 0}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Historial de últimos 20 viajes</h2>
          <ul>
            {history.map((h,i) => (
              <li key={i}>{new Date(h.date).toLocaleString()}: {h.driver} condujo, pasajeros: {h.passengers.join(", ")}</li>
            ))}
          </ul>

          <h2>Actividad reciente</h2>
          <ul>
            {activity.slice(-20).map((a,i) => (
              <li key={i}>{new Date(a.timestamp).toLocaleString()}: {a.user} - {a.action} {a.target}</li>
            ))}
          </ul>

          <button onClick={resetAll}>Reset total</button>
        </div>
      )}
    </div>
  );
}

export default App;
