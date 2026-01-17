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

  // Login/Logout
  const login = async () => await signInWithPopup(auth, provider);
  const logout = async () => await signOut(auth);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  // Cargar participantes, deudas e historial
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, "participants"), snap => {
      setParticipants(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
    const unsubD = onSnapshot(doc(db, "debts", "all"), docSnap => {
      if(docSnap.exists()) setDebts(docSnap.data());
    });
    const unsubH = onSnapshot(collection(db, "history"), snap => {
      setHistory(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b)=>new Date(b.date)-new Date(a.date)));
    });
    return () => { unsubP(); unsubD(); unsubH(); };
  }, []);

  // Participantes
  const addParticipant = async (name) => { if(!name) return; await addDoc(collection(db,"participants"),{name}); };
  const editParticipant = async (id,newName) => { if(!window.confirm("Confirmas cambiar nombre?")) return; await updateDoc(doc(db,"participants",id),{name:newName}); };
  const removeParticipant = async (id) => { if(!window.confirm("Confirmas eliminar participante?")) return; await updateDoc(doc(db,"participants",id),{deleted:true}); };

  // Sugerir conductor
  const suggestDriver = () => {
    if(todayPassengers.length===0) return;
    let minDebt = Infinity;
    let driver = todayPassengers[0];
    todayPassengers.forEach(p=>{
      let total=0;
      todayPassengers.forEach(other=>{ if(other!==p) total+=(debts[p]?.[other]||0); });
      if(total<minDebt){ minDebt=total; driver=p; }
    });
    setSuggestedDriver(driver);
  };

  useEffect(()=>suggestDriver(), [todayPassengers, debts]);

  // Confirmar viaje
  const confirmTrip = async () => {
    if(!suggestedDriver) return;
    const trip = { date:new Date().toISOString(), driver:suggestedDriver, passengers:todayPassengers, modifiedBy:user.displayName||user.email };
    await addDoc(collection(db,"history"), trip);

    // Actualizar deudas
    const newDebts = {...debts};
    todayPassengers.forEach(p=>{
      if(p!==suggestedDriver){
        newDebts[p] = newDebts[p] || {};
        newDebts[p][suggestedDriver] = (newDebts[p][suggestedDriver]||0)+1;
      }
    });
    setDebts(newDebts);
    await setDoc(doc(db,"debts","all"), newDebts);

    setTodayPassengers([]);
    alert("Viaje confirmado");
  };

  // Editar últimos 5 viajes
  const editRecentTrip = async (tripId) => {
    const newDriver = prompt("Nuevo conductor para este viaje:");
    if(!newDriver) return;
    if(!window.confirm("Confirmar cambio de conductor?")) return;
    await updateDoc(doc(db,"history",tripId), { driver:newDriver, modifiedBy:user.displayName||user.email });
    alert("Viaje modificado");
  };

  // Reset seguro
  const resetAll = async () => {
    if(!window.confirm("¿Estás seguro de resetear todo?")) return;
    if(!window.confirm("Esto borrará todo historial y deudas. Confirmar de nuevo")) return;
    await setDoc(doc(db,"debts","all"), {});
    history.forEach(async(h)=>await updateDoc(doc(db,"history",h.id),{deleted:true}));
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

      <section>
        <h2>Participantes</h2>
        <ul>
          {participants.filter(p=>!p.deleted).map(p=>(
            <li key={p.id}>
              {p.name} 
              <button onClick={()=>editParticipant(p.id,p.name)}>Editar</button>
              <button onClick={()=>removeParticipant(p.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
        <input id="newP" placeholder="Nuevo participante" />
        <button onClick={()=>{const n=document.getElementById("newP").value; if(n)addParticipant(n)}}>Añadir</button>
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
        <div>
          <h4>Deudas del conductor con los pasajeros de hoy:</h4>
          <ul>
            {todayPassengers.filter(p=>p!==suggestedDriver).map(p=>(
              <li key={p}>{suggestedDriver} debe {debts[suggestedDriver]?.[p]||0} a {p}</li>
            ))}
          </ul>
        </div>
        <button onClick={confirmTrip}>Confirmar Viaje</button>
        <button onClick={resetAll}>Reset Seguro</button>
      </section>

      <section>
        <h2>Historial (últimos 20 viajes)</h2>
        <ul>
          {history.slice(0,20).map(h=>(
            <li key={h.id}>
              {new Date(h.date).toLocaleDateString()} - {h.driver} - {h.passengers.join(", ")}
              {h.modifiedBy ? `(Modificado por: ${h.modifiedBy})` : ""}
              {history.indexOf(h)<5 && <button onClick={()=>editRecentTrip(h.id)}>Editar últimos 5</button>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Deudas</h2>
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              {participants.filter(p=>!p.deleted).map(p=><th key={p.id}>{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {participants.filter(p=>!p.deleted).map(row=>(
              <tr key={row.id}>
                <td>{row.name}</td>
                {participants.filter(p=>!p.deleted).map(col=>(
                  <td key={col.id} onClick={()=>{
                    const val = prompt(`${row.name} debe a ${col.name}:`, debts[row.name]?.[col.name]||0);
                    if(val!==null && !isNaN(val)){
                      if(!window.confirm("Confirmar cambio de deuda?")) return;
                      const newDebts = {...debts};
                      newDebts[row.name] = newDebts[row.name]||{};
                      newDebts[row.name][col.name] = parseInt(val);
                      setDebts(newDebts);
                      setDoc(doc(db,"debts","all"),newDebts);
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

