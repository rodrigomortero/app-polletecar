import React, { useEffect, useState } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  setDoc,
  onSnapshot
} from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [todayPassengers, setTodayPassengers] = useState({});
  const [debts, setDebts] = useState({});
  const [suggestedDriver, setSuggestedDriver] = useState(null);
  const [history, setHistory] = useState([]);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  const login = () => {
    signInWithPopup(auth, provider);
  };

  const logout = () => {
    signOut(auth);
  };

  /* ---------- LOAD DATA ---------- */
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "app", "state"), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setParticipants(data.participants || []);
      setDebts(data.debts || {});
      setHistory(data.history || []);
    });

    return () => unsub();
  }, [user]);

  /* ---------- HELPERS ---------- */
  const debtKey = (from, to) => `${from}__${to}`;

  const getDebt = (from, to) => debts[debtKey(from, to)] || 0;

  /* ---------- SUGGEST DRIVER ---------- */
  const calculateSuggestion = () => {
    const active = participants.filter((p) => todayPassengers[p]);

    if (active.length < 2) {
      setSuggestedDriver(null);
      return;
    }

    let scores = {};
    active.forEach((p) => {
      scores[p] = 0;
    });

    active.forEach((a) => {
      active.forEach((b) => {
        if (a !== b) {
          scores[a] -= getDebt(a, b);
        }
      });
    });

    const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
    setSuggestedDriver(sorted[0][0]);
  };

  /* ---------- CONFIRM TRIP ---------- */
  const confirmTrip = async () => {
    if (!suggestedDriver) return;

    const active = participants.filter((p) => todayPassengers[p]);
    let newDebts = { ...debts };

    active.forEach((p) => {
      if (p === suggestedDriver) return;

      const k1 = debtKey(p, suggestedDriver);
      const k2 = debtKey(suggestedDriver, p);

      if ((newDebts[k1] || 0) > 0) {
        newDebts[k1] -= 1;
      } else {
        newDebts[k2] = (newDebts[k2] || 0) + 1;
      }
    });

    const newHistory = [
      {
        date: new Date().toLocaleDateString(),
        driver: suggestedDriver,
        passengers: active,
        by: user.email
      },
      ...history
    ].slice(0, 20);

    await setDoc(doc(db, "app", "state"), {
      participants,
      debts: newDebts,
      history: newHistory
    });

    setSuggestedDriver(null);
    setTodayPassengers({});
  };

  /* ---------- UI ---------- */
  if (!user) {
    return (
      <div className="login">
        <h1>Polletecar</h1>
        <button onClick={login}>Entrar con Google</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Polletecar</h1>
        <span>{user.displayName}</span>
        <button onClick={logout}>Salir</button>
      </header>

      <section>
        <h2>Pasajeros de hoy</h2>
        {participants.map((p) => (
          <label key={p} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={!!todayPassengers[p]}
              onChange={() =>
                setTodayPassengers((prev) => ({
                  ...prev,
                  [p]: !prev[p]
                }))
              }
            />
            {p}
          </label>
        ))}
      </section>

      <button onClick={calculateSuggestion}>
        Calcular sugerencia de conductor
      </button>

      {suggestedDriver && (
        <h3>Sugerencia de conductor: {suggestedDriver}</h3>
      )}

      <button onClick={confirmTrip} disabled={!suggestedDriver}>
        Confirmar viaje
      </button>

      <section>
        <h2>Tabla de deudas</h2>
        <table>
          <thead>
            <tr>
              <th>Deudor</th>
              <th>Acreedor</th>
              <th>Viajes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(debts)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => {
                const [from, to] = k.split("__");
                return (
                  <tr key={k}>
                    <td>{from}</td>
                    <td>{to}</td>
                    <td>{v}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Historial</h2>
        {history.map((h, i) => (
          <div key={i}>
            {h.date} – {h.driver} – {h.passengers.join(", ")}
          </div>
        ))}
      </section>
    </div>
  );
}
