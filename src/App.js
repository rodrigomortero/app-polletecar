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
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [todayPassengers, setTodayPassengers] = useState([]);
  const [suggestedDriver, setSuggestedDriver] = useState("");
  const [debts, setDebts] = useState({});
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState("light");

  // LOGIN GOOGLE
  const login = async () => await signInWithPopup(auth, provider);
  const logout = async () => await signOut(auth);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // CARGAR PARTICIPANTES, DEUDAS E HISTORIAL
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, "participants"), snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p=>!p.deleted));
    });
    const unsubD = onSnapshot(doc(db, "debts", "all"), docSnap => {
      if(docSnap.exists()) setDebts(docSnap.data());
    });
    const q = query(collection(db, "history"), orderBy("date", "desc"), limit(20));
    const unsubH = onSnapshot(q, snap => setHistory(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => { unsubP(); unsubD(); unsubH(); };
  }, []);

  // PARTICIPANTES
  const addParticipant = async (name) => { 
    if(!name) return; 
    await addDoc(collection(db, "participants"), { name }); 
  };
  const editParticipant = async (id) => {
    const newName = prompt("Nuevo nombre del participante:");
    if(!newName) return;
    if(!window.confirm("Confirmar cambio de nombre?")) return;
    await updateDoc(doc(db, "participants", id), { name: newName });
  };
  const removeParticipant = async (id) => {
    if(!window.confirm("Confirmar eliminar participante?")) return;
    await updateDoc(doc(db, "participants", id), { deleted: true });
  };

  // SUGERIR CONDUCTOR
  const suggestDriver = () => {
    if(todayPassengers.length===0) return setSuggestedDriver("");
    let minDebt = Infinity;
    let driver = todayPassengers[0];
    todayPassengers.forEach(p => {
      let total=0;
      todayPassengers.forEach(other => {
        if(other!==p) total += debts[p]?.[other] || 0;
      });
      if(total<minDebt){ minDebt = total; driver=p; }
    });
    setSuggestedDriver(driver);
  };

  useEffect(() => suggestDriver(), [todayPassengers, debts]);

  // CONFIRMAR VIAJE
  const confirmTrip = async () => {
    if(!suggestedDriver) return alert("Selecciona un conductor");

    const trip = {
      date: new Date().toISOString(),
      driver: suggestedDriver,
      passengers: todayPassengers,
      modifiedBy: user.displayName || user.email
    };
    await addDoc(collection(db, "history"), trip);

    // ACTUALIZAR DEUDAS
    const newDebts = { ...debts };
    todayPassengers.forEach(p => {
      if(p !== suggestedDriver){
        newDebts[p] = newDebts[p] || {};
        newDebts[p][suggestedDriver] = (newDebts[p][suggestedDriver]||0)+1;
      }
    });
    setDebts(newDebts);
    await setDoc(doc(db, "debts", "all"), newDebts);

    setTodayPassengers([]);
    setSuggestedDriver("");
    alert("Viaje confirmado");
  };

  // EDITAR ÚLTIMOS 5 VIAJES
  const editRecentTrip = async (tripId) => {
    const newDriver = prompt("Nuevo conductor para este viaje:");
    if(!newDriver) return;
    if(!window.confirm("Confirmar cambio de conductor?")) return;
    await updateDoc(doc(db, "history", tripId), { driver:newDriver, modifiedBy: user.displayName || user.email });
    alert("Viaje modificado");
  };

  // RESET TOTAL
  const resetAll = async () => {
    if(!window.confirm("¿Estás seguro de resetear todo?")) return;
    if(!window.confirm("Esto borrará TODO: participantes, viajes, historial y deudas. Confirmar de nuevo")) return;

    // borrar participantes
    participants.forEach(async(p)=> await updateDoc(doc(db,"participants",p.id), {deleted:true}));
    // borrar deudas
    await setDoc(doc(db,"debts","all"), {});
    // borrar historial
    history.forEach(async(h)=> await updateDoc(doc(db,"history",h.id), {deleted:true}));
    alert("Todo reseteado");
  };

  const toggleTheme = ()=>setTheme(theme==="light"?"dark":"light");

  if(!user) return <button onClick={login}>Login con Google</button>;

  return (
    <div className={theme}>
      <header>
        <h1>Coche Compartido</h1>
        <button onClick={logout}>Salir</button>
        <button onClick={toggleTheme}>Modo {theme==="light"?"Oscuro":"Claro"}</button>
      </header>

      {/* PARTICIPANTES HABITUALES */}
      <section>
        <h2>Participantes Habituales</h2>
        <ul>
          {participants.map(p => (
            <li key={p.id}>
              {p.name}
              <button onClick={()=>editParticipant(p.id)}>Editar</button>
              <button onClick={()=>removeParticipant(p.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
        <input id="newP" placeholder="Nuevo participante" />
        <button onClick={()=>{
          const n = document.getElementById("newP").value.trim();
          if(n){ addParticipant(n); document.getElementById("newP").value=""; }
        }}>Añadir</button>
      </section>

      {/* PASAJEROS DE HOY */}
      <section>
        <h2>Pasajeros del día</h2>
        <select multiple value={todayPassengers} onChange={(e)=>setTodayPassengers([...e.target.selectedOptions].map(o=>o.value))}>
          {participants.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
        </select>

        <div>
          <h3>Conductor sugerido:</h3>
          <input value={suggestedDriver} onChange={e=>setSuggestedDriver(e.target.value)} />
          <h4>Deudas del conductor con pasajeros de hoy:</h4>
          <ul>
            {todayPassengers.filter(p=>p!==suggestedDriver).map(p => (
              <li key={p}>{suggestedDriver} debe {debts[suggestedDriver]?.[p]||0} a {p}</li>
            ))}
          </ul>
        </div>
        <button onClick={confirmTrip}>Confirmar Viaje</button>
        <button onClick={resetAll}>Reset Total</button>
      </section>

      {/* HISTORIAL */}
      <section>
        <h2>Historial (últimos 20 viajes)</h2>
        <ul>
          {history.filter(h=>!h.deleted).slice(0,20).map((h,i)=>(
            <li key={h.id}>
              {new Date(h.date).toLocaleDateString()} - {h.driver} - {h.passengers.join(", ")}
              {h.modifiedBy ? `(Modificado por: ${h.modifiedBy})` : ""}
              {i<5 && <button onClick={()=>editRecentTrip(h.id)}>Editar últimos 5</button>}
            </li>
          ))}
        </ul>
      </section>

      {/* DEUDAS GLOBALES */}
      <section>
        <h2>Deudas Globales</h2>
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              {participants.map(p => <th key={p.id}>{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {participants.map(row => (
              <tr key={row.id}>
                <td>{row.name}</td>
                {participants.map(col => (
                  <td key={col.id} onClick={()=>{
                    const val = prompt(`${row.name} debe a ${col.name}:`, debts[row.name]?.[col.name]||0);
                    if(val!==null && !isNaN(val)){
                      if(!window.confirm("Confirmar cambio de deuda?")) return;
                      const newDebts = {...debts};
                      newDebts[row.name] = newDebts[row.name]||{};
                      newDebts[row.name][col.name] = parseInt(val);
                      setDebts(newDebts);
                      setDoc(doc(db,"debts","all"), newDebts);
                      alert(`Deuda actualizada: ${row.name} debe ${val} a ${col.name}`);
                    }
                  }}>
                    {debts[row.name]?.[col.name]||0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;
