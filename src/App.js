import React, { useEffect, useState } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

/*
MODELO DE DEUDA:
debts["A__B"] = 2  => A debe 2 viajes a B
*/

export default function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activeToday, setActiveToday] = useState({});
  const [debts, setDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [suggestedDriver, setSuggestedDriver] = useState(null);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
    });
    return () => unsub();
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  /* ---------- LOAD FIRESTORE ---------- */
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "app", "state"), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setParticipants(d.participants || []);
      setDebts(d.debts || {});
      setHistory(d.history || []);
    });

    return () => unsub();
  }, [user]);

  /* ---------- HELPERS ---------- */
  const key = (a, b) => `${a}__${b}`;
  const getDebt = (a, b) => debts[key(a, b)] || 0;

  /* ---------- DRIVER SUGGESTION ---------- */
  const calculateSuggestion = () => {
    const active = participants.filter((p) => activeToday[p]);
    if (active.length < 2) {
      setSuggestedDriver(null);
      return;
    }

    // score > 0 => debe al grupo
    let score = {};
    active.forEach((p) => (score[p] = 0));

    active.forEach((a) => {
      active.forEach((b) => {
        if (a !== b) {
          score[a] += getDebt(a, b);
        }
      });
    });

    // el que MÁS debe conduce
    const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
    setSuggestedDriver(sorted[0][0]);
  };

  /* ---------- CONFIRM TRIP ---------- */
  const confirmTrip = async () => {
    if (!suggestedDriver) return;

    const active = participants.filter((p) => activeToday[p]);
    let newDebts = { ...debts };

    active.forEach((p) => {
      if (p === suggestedDriver) return;

      const payKey = key(p, suggestedDriver);
      const oweKey = key(suggestedDriver, p);

      if ((newDebts[payKey] || 0) > 0) {
        newDebts[payKey] -= 1;
      } else {
        newDebts[oweKey] = (newDebts[oweKey] || 0) + 1;
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

    setActiveToday({});
    setSuggestedDriver(null);
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
        <div>
          {user.displayName}
          <button onClick={logout}>Salir</button>
        </div>
      </header>

      <section>
        <h2>¿Quién va hoy?</h2>
        {participants.map((p) => (
          <label key={p} className="check">
            <input
              type="checkbox"
              checked={!!activeToday[p]}
              onChange={() =>
                setActiveToday((prev) => ({ ...prev, [p]: !prev[p] }))
              }
            />
            {p}
          </label>
        ))}
      </section>

      <button onClick={calculateSuggestion}>
        Calcular sugerencia
      </button>

      {suggestedDriver && (
        <h3>Debe conducir: {suggestedDriver}</h3>
      )}

      <button disabled={!suggestedDriver} onClick={confirmTrip}>
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
            {h.date} — <b>{h.driver}</b> — {h.passengers.join(", ")}
          </div>
        ))}
      </section>
    </div>
  );
}
