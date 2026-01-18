// src/App.js
import React, { useState, useEffect } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  deleteDoc,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selectedToday, setSelectedToday] = useState([]);
  const [conductorSug, setConductorSug] = useState(null);
  const [conductorConfirm, setConductorConfirm] = useState(null);
  const [deudas, setDeudas] = useState({});
  const [historial, setHistorial] = useState([]);
  const [actividad, setActividad] = useState([]);

  // ===== AUTH GOOGLE =====
  useEffect(() => {
    onAuthStateChanged(auth, (current) => {
      setUser(current);
    });
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // ===== FIREBASE LOAD =====
  useEffect(() => {
    const unsubParticipants = onSnapshot(
      collection(db, "participants"),
      (snap) => {
        setParticipants(snap.docs.map((d) => d.data().name));
      }
    );
    const unsubDeudas = onSnapshot(doc(db, "data", "deudas"), (docSnap) => {
      if (docSnap.exists()) setDeudas(docSnap.data());
    });
    const unsubHistorial = onSnapshot(
      query(collection(db, "historial"), orderBy("fecha", "desc"), limit(20)),
      (snap) => {
        setHistorial(snap.docs.map((d) => d.data()));
      }
    );
    const unsubActividad = onSnapshot(
      query(collection(db, "actividad"), orderBy("fecha", "desc"), limit(50)),
      (snap) => setActividad(snap.docs.map((d) => d.data()))
    );

    return () => {
      unsubParticipants();
      unsubDeudas();
      unsubHistorial();
      unsubActividad();
    };
  }, []);

  // ===== PARTICIPANTS =====
  const addParticipant = async () => {
    const name = prompt("Nombre del participante:");
    if (!name) return;
    if (participants.includes(name)) {
      alert("Ya existe");
      return;
    }
    await setDoc(doc(db, "participants", name), { name });
    await logActividad(`Añadido participante: ${name}`);
  };

  const removeParticipant = async (name) => {
    if (!window.confirm(`Seguro quieres eliminar a ${name}?`)) return;
    if (!window.confirm(`ESTÁS SEGURO DOS VECES de eliminar a ${name}?`)) return;
    await deleteDoc(doc(db, "participants", name));
    await logActividad(`Eliminado participante: ${name}`);
  };

  // ===== LOG ACTIVIDAD =====
  const logActividad = async (accion) => {
    if (!user) return;
    await setDoc(doc(collection(db, "actividad")), {
      usuario: user.displayName,
      email: user.email,
      accion,
      fecha: new Date().toISOString(),
    });
  };

  // ===== CALCULAR SUGERENCIA =====
  const calcularConductor = () => {
    if (selectedToday.length === 0) return null;
    let maxDeuda = -Infinity;
    let elegido = selectedToday[0];

    selectedToday.forEach((p) => {
      let deudaTotal = 0;
      selectedToday.forEach((q) => {
        if (p !== q) {
          deudaTotal += deudas[p]?.[q] || 0;
        }
      });
      if (deudaTotal > maxDeuda) {
        maxDeuda = deudaTotal;
        elegido = p;
      }
    });
    setConductorSug(elegido);
  };

  useEffect(() => {
    calcularConductor();
  }, [selectedToday, deudas]);

  // ===== CONFIRMAR VIAJE =====
  const confirmarViaje = async () => {
    if (!conductorConfirm && !conductorSug) {
      alert("Selecciona conductor o usa la sugerencia");
      return;
    }
    const conductor = conductorConfirm || conductorSug;

    // actualizar deudas
    const nuevasDeudas = { ...deudas };
    selectedToday.forEach((p) => {
      if (p !== conductor) {
        if (!nuevasDeudas[conductor]) nuevasDeudas[conductor] = {};
        if (!nuevasDeudas[p]) nuevasDeudas[p] = {};
        // compensar
        const prev = nuevasDeudas[conductor][p] || 0;
        const prev2 = nuevasDeudas[p][conductor] || 0;
        nuevasDeudas[conductor][p] = prev + 1 + prev2 < 0 ? 0 : prev + 1 + prev2;
        nuevasDeudas[p][conductor] = -nuevasDeudas[conductor][p];
      }
    });
    await setDoc(doc(db, "data", "deudas"), nuevasDeudas);
    setDeudas(nuevasDeudas);

    // historial
    const viaje = {
      fecha: new Date().toISOString(),
      conductor,
      pasajeros: [...selectedToday],
      quienConfirmo: user.displayName,
    };
    await setDoc(doc(collection(db, "historial")), viaje);

    await logActividad(`Confirmado viaje por ${user.displayName}, conductor: ${conductor}`);
    setConductorConfirm(null);
    setSelectedToday([]);
  };

  // ===== RESET TOTAL =====
  const resetTotal = async () => {
    if (!window.confirm("¿Seguro que quieres RESETear todo?")) return;
    if (!window.confirm("¡CONFIRMACIÓN FINAL! Todo se borrará")) return;

    // borrar participantes
    const pDocs = await getDocs(collection(db, "participants"));
    for (const d of pDocs.docs) await deleteDoc(d.ref);

    // borrar deudas
    await setDoc(doc(db, "data", "deudas"), {});

    // borrar historial
    const hDocs = await getDocs(collection(db, "historial"));
    for (const d of hDocs.docs) await deleteDoc(d.ref);

    await logActividad(`${user.displayName} ha reseteado TODO`);

    setParticipants([]);
    setDeudas({});
    setHistorial([]);
    setSelectedToday([]);
    setConductorSug(null);
    setConductorConfirm(null);
  };

  return (
    <div className="app">
      <h1>App Car Pool</h1>
      {!user ? (
        <button onClick={login}>Entrar con Google</button>
      ) : (
        <div>
          <p>Hola, {user.displayName}</p>
          <button onClick={logout}>Salir</button>
        </div>
      )}

      <h2>Participantes</h2>
      <ul>
        {participants.map((p) => (
          <li key={p}>
            {p}{" "}
            <button onClick={() => removeParticipant(p)}>Eliminar</button>
          </li>
        ))}
      </ul>
      <button onClick={addParticipant}>Añadir participante</button>

      <h2>Pasajeros de hoy</h2>
      {participants.map((p) => (
        <label key={p}>
          <input
            type="checkbox"
            checked={selectedToday.includes(p)}
            onChange={(e) => {
              if (e.target.checked)
                setSelectedToday([...selectedToday, p]);
              else setSelectedToday(selectedToday.filter((x) => x !== p));
            }}
          />
          {p}
        </label>
      ))}

      <h2>Sugerencia de conductor</h2>
      <p>
        {conductorSug || "No hay pasajeros seleccionados"}
      </p>
      <select
        value={conductorConfirm || ""}
        onChange={(e) => setConductorConfirm(e.target.value)}
      >
        <option value="">Usar sugerencia</option>
        {selectedToday.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button onClick={confirmarViaje}>Confirmar viaje</button>
      <button onClick={resetTotal}>Reset total</button>

      <h2>Deudas</h2>
      <table>
        <thead>
          <tr>
            <th>De</th>
            {participants.map((p) => (
              <th key={p}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr key={p}>
              <td>{p}</td>
              {participants.map((q) => (
                <td key={q}>
                  {deudas[p]?.[q] || 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Historial últimos 20 viajes</h2>
      <ul>
        {historial.map((v, idx) => (
          <li key={idx}>
            {new Date(v.fecha).toLocaleString()} - Conductor: {v.conductor} - Pasajeros: {v.pasajeros.join(", ")}
          </li>
        ))}
      </ul>

      <h2>Actividad reciente</h2>
      <ul>
        {actividad.map((a, idx) => (
          <li key={idx}>
            {new Date(a.fecha).toLocaleString()} - {a.usuario} ({a.email}) - {a.accion}
          </li>
        ))}
      </ul>
    </div>
  );
}
