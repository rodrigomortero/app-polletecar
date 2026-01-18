import React, { useEffect, useState } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [today, setToday] = useState({});
  const [debts, setDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [newName, setNewName] = useState("");
  const [suggested, setSuggested] = useState(null);
  const [manualDriver, setManualDriver] = useState("");

  /* ---------- AUTH ---------- */
  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u || null));
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  /* ---------- LOAD ---------- */
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "app", "state"), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setParticipants(d.participants || []);
      setDebts(d.debts || {});
      setHistory(d.history || []);
    });
  }, [user]);

  /* ---------- HELPERS ---------- */
  const key = (a, b) => `${a}__${b}`;
  const getDebt = (a, b) => debts[key(a, b)] || 0;

  /* ---------- PARTICIPANTS ---------- */
  const addParticipant = async () => {
    const name = newName.trim();
    if (!name || participants.includes(name)) return;
    const updated = [...participants, name];
    await setDoc(doc(db, "app", "state"), {
      participants: updated,
      debts,
      history
    });
    setNewName("");
  };

  const removeParticipant = async (p) => {
    if (!window.confirm(`Eliminar a ${p}?`)) return;
    let newDebts = { ...debts };
    Object.keys(newDebts).forEach(k => {
      if (k.includes(p)) delete newDebts[k];
    });
    await setDoc(doc(db, "app", "state"), {
      participants: participants.filter(x => x !== p),
      debts: newDebts,
      history
    });
  };

  /* ---------- SUGGESTION ---------- */
  const calculateSuggestion = () => {
    const active = participants.filter(p => today[p]);
    if (active.length < 2) return;

    let score = {};
    active.forEach(p => score[p] = 0);

    active.forEach(a => {
      active.forEach(b => {
        if (a !== b) score[a] += getDebt(a, b);
      });
    });

    const ordered = Object.entries(score).sort((a,b)=>b[1]-a[1]);
    setSuggested(ordered[0][0]);
    setManualDriver(ordered[0][0]);
  };

  /* ---------- CONFIRM TRIP ---------- */
  const confirmTrip = async () => {
    const driver = manualDriver;
    if (!driver) return;

    const active = participants.filter(p => today[p]);
    let newDebts = { ...debts };

    active.forEach(p => {
      if (p === driver) return;
      const pay = key(p, driver);
      const owe = key(driver, p);
      if ((newDebts[pay] || 0) > 0) newDebts[pay] -= 1;
      else newDebts[owe] = (newDebts[owe] || 0) + 1;
    });

    const newHistory = [{
      date: new Date().toLocaleDateString(),
      driver,
      passengers: active,
      by: user.email
    }, ...history].slice(0, 20);

    await setDoc(doc(db, "app", "state"), {
      participants,
      debts: newDebts,
      history: newHistory
    });

    setToday({});
    setSuggested(null);
    setManualDriver("");
  };

  /* ---------- RESET ---------- */
  const resetAll = async () => {
    if (!window.confirm("¿BORRAR TODO?")) return;
    if (!window.confirm("CONFIRMACIÓN FINAL")) return;
    await setDoc(doc(db, "app", "state"), {
      participants: [],
      debts: {},
      history: []
    });
    setToday({});
    setSuggested(null);
    setManualDriver("");
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
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre"/>
        <button onClick={addParticipant}>Añadir</button>

        {participants.map(p=>(
          <div key={p} className="row">
            <label>
              <input type="checkbox" checked={!!today[p]}
                onChange={()=>setToday(t=>({...t,[p]:!t[p]}))}/>
              Va hoy: {p}
            </label>
            <button onClick={()=>removeParticipant(p)}>Eliminar</button>
          </div>
        ))}
      </section>

      <section className="box">
        <button onClick={calculateSuggestion}>Calcular sugerencia</button>
        {suggested && <p>Sugerencia de conductor: <b>{suggested}</b></p>}
        {suggested && (
          <select value={manualDriver} onChange={e=>setManualDriver(e.target.value)}>
            {participants.filter(p=>today[p]).map(p=>
              <option key={p} value={p}>{p}</option>
            )}
          </select>
        )}
        <button disabled={!manualDriver} onClick={confirmTrip}>
          Confirmar viaje
        </button>
      </section>

      <section className="box">
        <h2>Deudas</h2>
        <table>
          <tbody>
            {Object.entries(debts).filter(([,v])=>v>0).map(([k,v])=>{
              const [a,b]=k.split("__");
              return <tr key={k}><td>{a}</td><td>debe</td><td>{v}</td><td>a</td><td>{b}</td></tr>;
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

      <button className="danger" onClick={resetAll}>RESET TOTAL</button>
    </div>
  );
}
