// src/App.js
import React, { useState, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import "./App.css";

export default function App() {
  // ------------------- ESTADOS -------------------
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [todayPassengers, setTodayPassengers] = useState([]);
  const [suggestedDriver, setSuggestedDriver] = useState("");
  const [driverDebts, setDriverDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [activity, setActivity] = useState([]);

  // ------------------- AUTH -------------------
  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.log("Error login", e);
    }
  };
  const logout = () => signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        loadData();
      } else setUser(null);
    });
    return () => unsub();
  }, []);

  // ------------------- FIRESTORE -------------------
  const loadData = async () => {
    const docRef = doc(db, "appData", "state");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setParticipants(data.participants || []);
      setTodayPassengers(data.todayPassengers || []);
      setHistory(data.history || []);
      setActivity(data.activity || []);
    } else {
      await setDoc(docRef, {
        participants: [],
        todayPassengers: [],
        history: [],
        activity: [],
        debts: {}
      });
    }
  };

  const saveData = async (newState) => {
    const docRef = doc(db, "appData", "state");
    await setDoc(docRef, newState, { merge: true });
  };

  // ------------------- PARTICIPANTES -------------------
  const addParticipant = async (name) => {
    if (!name || participants.includes(name)) return;
    const newParticipants = [...participants, name];
    setParticipants(newParticipants);
    await saveData({ participants: newParticipants });
    logActivity(`${user.displayName} añadió participante ${name}`);
  };

  const removeParticipant = async (name) => {
    if (!window.confirm(`¿Seguro que quieres eliminar ${name}?`)) return;
    const newParticipants = participants.filter((p) => p !== name);
    setParticipants(newParticipants);
    setTodayPassengers(todayPassengers.filter((p) => p !== name));
    await saveData({ participants: newParticipants, todayPassengers });
    logActivity(`${user.displayName} eliminó participante ${name}`);
  };

  // ------------------- HOY PASAJEROS -------------------
  const toggleTodayPassenger = (name) => {
    let newToday = [...todayPassengers];
    if (todayPassengers.includes(name)) newToday = newToday.filter((p) => p !== name);
    else newToday.push(name);
    setTodayPassengers(newToday);
    suggestDriver(newToday);
  };

  // ------------------- SUGERENCIA DE CONDUCTOR -------------------
  const suggestDriver = (passengers) => {
    if (passengers.length === 0) {
      setSuggestedDriver("");
      setDriverDebts({});
      return;
    }

    // Calcular deudas: conductor debe ir quien más deba a otros hoy
    const debts = {};
    passengers.forEach((p) => (debts[p] = 0));

    history.forEach((h) => {
      h.passengers.forEach((p) => {
        if (p !== h.driver && passengers.includes(p) && passengers.includes(h.driver)) {
          debts[h.driver] += 1; // conductor acumula deuda
        }
      });
    });

    // Elegir conductor con más deuda
    let maxDebt = -1;
    let driver = passengers[0];
    passengers.forEach((p) => {
      if (debts[p] > maxDebt) {
        maxDebt = debts[p];
        driver = p;
      }
    });

    setSuggestedDriver(driver);
    setDriverDebts(debts);
  };

  // ------------------- CONFIRMAR VIAJE -------------------
  const confirmTrip = async () => {
    if (!suggestedDriver) return;
    const newHistoryItem = {
      date: new Date().toLocaleDateString(),
      driver: suggestedDriver,
      passengers: [...todayPassengers]
    };
    const newHistory = [newHistoryItem, ...history].slice(0, 20);
    setHistory(newHistory);
    await saveData({ history: newHistory });
    logActivity(`${user.displayName} confirmó viaje. Conductor: ${suggestedDriver}`);
    alert("Viaje confirmado");
  };

  // ------------------- RESET -------------------
  const resetAll = async () => {
    if (!window.confirm("¿Seguro que quieres borrar todos los datos?")) return;
    if (!window.confirm("¡Confirmación final! Se eliminarán TODOS los datos")) return;
    setParticipants([]);
    setTodayPassengers([]);
    setSuggestedDriver("");
    setHistory([]);
    setActivity([]);
    await saveData({ participants: [], todayPassengers: [], history: [], activity: [] });
  };

  // ------------------- ACTIVIDAD -------------------
  const logActivity = async (message) => {
    const newAct = [{ date: new Date().toLocaleString(), message }, ...activity].slice(0, 50);
    setActivity(newAct);
    await saveData({ activity: newAct });
  };

  // ------------------- RENDER -------------------
  return (
    <div className="app-container">
      <h1>Polletecar</h1>

      {!user ? (
        <button className="btn-login" onClick={login}>
          Entrar con Google
        </button>
      ) : (
        <div>
          <p>Hola <strong>{user.displayName}</strong></p>
          <button className="btn-logout" onClick={logout}>Salir</button>

          <h2>Participantes</h2>
          <input
            type="text"
            placeholder="Añadir participante y Enter"
            onKeyDown={(e) => e.key === "Enter" && addParticipant(e.target.value)}
          />
          <div className="participants">
            {participants.map((p) => (
              <div className="participant" key={p}>
                {p}
                <button onClick={() => toggleTodayPassenger(p)}>
                  {todayPassengers.includes(p) ? "Quitar del coche" : "Va al coche"}
                </button>
                <button onClick={() => removeParticipant(p)}>Eliminar</button>
              </div>
            ))}
          </div>

          <h2>Sugerencia de conductor</h2>
          <p className="suggestion">
            {suggestedDriver ? `Sugerencia: ${suggestedDriver}` : "Seleccione pasajeros para sugerir"}
          </p>

          {Object.keys(driverDebts).length > 0 && (
            <div className="debts">
              <h4>Deudas del conductor con pasajeros hoy:</h4>
              <table>
                <thead>
                  <tr>
                    <th>Pasajero</th>
                    <th>Deuda viajes</th>
                  </tr>
                </thead>
                <tbody>
                  {todayPassengers.filter((p) => p !== suggestedDriver).map((p) => (
                    <tr key={p}>
                      <td>{p}</td>
                      <td>{driverDebts[suggestedDriver][p] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="buttons">
            <button onClick={confirmTrip}>Confirmar viaje</button>
            <button onClick={resetAll}>RESET TOTAL</button>
          </div>

          <h2>Historial de viajes (últimos 20)</h2>
          <table className="history">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Conductor</th>
                <th>Pasajeros</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={idx}>
                  <td>{h.date}</td>
                  <td>{h.driver}</td>
                  <td>{h.passengers.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Actividad reciente</h2>
          <ul className="activity">
            {activity.map((a, idx) => (
              <li key={idx}>
                {a.date} - {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
