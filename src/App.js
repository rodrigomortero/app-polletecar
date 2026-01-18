import React, { useEffect, useState } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [activeToday, setActiveToday] = useState({});
  const [debts, setDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [suggestedDriver, setSuggestedDriver] = useState(null);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  /* ---------- FIRESTORE ---------- */
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "app", "state"), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setParticipants(d.participants || []);
      setDebts(d.debts || {});
      setHistory(d.history || []);
    });
  }, [user]);

  /* ---------- HELPERS ---------- */
  const k = (a, b) => `${a}__${b}`;
  const getDebt = (a, b) => debts[k(a, b)] || 0;

  /* ---------- PARTICIPANTS ---------- */
  const addParticipant = async () => {
    if (!newParticipant.trim()) return;
    if (participants.includes(newParticipant)) return;

    const updated = [...participants, newParticipant.trim()];
    await setDoc(doc(db, "app", "state"), {
      participants: updated,
      debts,
      history
    });
    setNewParticipant("");
  };

  const removeParticipant = async (p) => {
    if (!window.confirm(`Eliminar a ${p}?`)) return;

    const updated = participants.filter(x => x !== p);
    let newDebts = { ...debts };
    Object.keys(newDebts).forEach(key => {
      if (key.includes(p)) delete newDebts[key];
    });

    await setDoc(doc(db, "app", "state"), {
      participants: updated,
      debts: newDebts,
      history
    });
  };

  /* ---------- SUGGEST DRIVER ---------- */
  const calculateSuggestion = () => {
    const active = participants.filter(p => activeToday[p]);
    if (active.length < 2) return;

    let score = {};
    active.forEach(p => score[p] = 0);

    active.forEach(a => {
      active.forEach(b => {
        if (a !== b) score[a] += getDebt(a, b);
      });
    });

    const sorted = Object.entries(score).sort((a,b) => b[1]-a[1]);
    setSuggestedDriver(sorted[0][0]);
  };

  /* ---------- CONFIRM TRIP ---------- */
  const confirmTrip = async () => {
    if (!suggestedDriver) return;

    const active = participants.filter(p => activeToday[p]);
    let newDebts = { ...debts };

    active.forEach(p => {
      if (p === suggestedDriver) return;
      const pay = k(p, suggestedDriver);
      const owe = k(suggestedDriver, p);

      if ((newDebts[pay] || 0) > 0) newDebts[pay] -= 1;
      else newDebts[owe] = (newDebts[owe] || 0) + 1;
    });

    const newHistory = [{
      date: new Date().toLocaleDateString(),
      driver: suggestedDriver,
      passengers: active,
      by: user.email
    }, ...history].slice(0, 20);

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
        <div>{user.displayName} <button onClick={logout}>Salir</button></div>
      </header>

      <section className="box">
        <h2>Participantes</h2>
        <input
          value={newParticipant}
          onChange={e => setNewParticipant(e.target.value)}
          placeholder="Nuevo participante"
        />
        <button onClick={addParticipant}>Añadir</button>

        {participants.map(p => (
          <div key={p} className="row">
            <label>
              <input
                type="checkbox"
                checked={!!activeToday[p]}
                onChange={() =>
                  setActiveToday(prev => ({ ...prev, [p]: !prev[p] }))
                }
              />
              Va hoy: {p}
            </label>
            <button onClick={() => removeParticipant(p)}>Eliminar</button>
          </div>
        ))}
      </section>

      <section className="box">
        <button onClick={calculateSuggestion}>Calcular sugerencia</button>
        {suggestedDriver && <h3>Debe conducir: {suggestedDriver}</h3>}
        <button disabled={!suggestedDriver} onClick={confirmTrip}>
          Confirmar viaje
        </button>
      </section>

      <section className="box">
        <h2>Deudas</h2>
        <table>
          <tbody>
            {Object.entries(debts).filter(([,v])=>v>0).map(([k,v])=>{
              const [a,b]=k.split("__");
              return <tr key={k}><td>{a}</td><td>→</td><td>{b}</td><td>{v}</td></tr>;
            })}
          </tbody>
        </table>
      </section>

      <section className="box">
        <h2>Historial</h2>
        {history.map((h,i)=>(
          <div key={i}>
            {h.date} — <b>{h.driver}</b> — {h.passengers.join(", ")}
          </div>
        ))}
      </section>
    </div>
  );
}
