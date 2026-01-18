// src/App.js
import React, { useEffect, useState } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [nuevoParticipante, setNuevoParticipante] = useState("");
  const [pasajerosDia, setPasajerosDia] = useState([]);
  const [conductorSugerido, setConductorSugerido] = useState("");
  const [deudas, setDeudas] = useState({});
  const [historial, setHistorial] = useState([]);

  // --- Google Auth ---
  const login = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (err) { alert("Error login: " + err.message); }
  };
  const logout = async () => await signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  // --- Cargar datos desde Firestore ---
  useEffect(() => {
    const fetchData = async () => {
      const partSnap = await getDoc(doc(db, "participantes", "global"));
      if (partSnap.exists()) setParticipantes(partSnap.data().lista || []);

      const deudaSnap = await getDoc(doc(db, "deudas", "global"));
      if (deudaSnap.exists()) setDeudas(deudaSnap.data() || {});

      const histSnap = await getDoc(doc(db, "historial", "viajes"));
      if (histSnap.exists()) setHistorial(histSnap.data().viajes || []);
    };
    fetchData();
  }, []);

  // --- Agregar participante ---
  const agregarParticipante = async () => {
    const nombre = nuevoParticipante.trim();
    if (!nombre) return;
    if (participantes.includes(nombre)) return alert("Participante ya existe");
    const nuevaLista = [...participantes, nombre];
    setParticipantes(nuevaLista);
    setNuevoParticipante("");
    await setDoc(doc(db, "participantes", "global"), { lista: nuevaLista });
  };

  // --- Eliminar participante con confirmación ---
  const eliminarParticipante = async (nombre) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${nombre}?`)) return;
    const nuevaLista = participantes.filter(p => p !== nombre);
    setParticipantes(nuevaLista);
    await setDoc(doc(db, "participantes", "global"), { lista: nuevaLista });
  };

  // --- Selección de pasajeros del día ---
  const togglePasajero = (nombre) => {
    if (pasajerosDia.includes(nombre)) {
      setPasajerosDia(pasajerosDia.filter(p => p !== nombre));
    } else {
      setPasajerosDia([...pasajerosDia, nombre]);
    }
  };

  // --- Sugerir conductor según deudas ---
  useEffect(() => {
    if (pasajerosDia.length === 0) return;
    let maxDeuda = -1;
    let sugerido = pasajerosDia[0];

    pasajerosDia.forEach(p => {
      let totalDeuda = 0;
      pasajerosDia.forEach(q => {
        if (p === q) return;
        const clave = [p, q].sort().join("|");
        const info = deudas[clave];
        if (info) {
          if (info.deudor === p) totalDeuda += info.cantidad; // p debe a q
          else totalDeuda -= info.cantidad; // q debe a p
        }
      });
      if (totalDeuda > maxDeuda) {
        maxDeuda = totalDeuda;
        sugerido = p;
      }
    });

    setConductorSugerido(sugerido);
  }, [pasajerosDia, deudas]);

  // --- Confirmar viaje ---
  const confirmarViaje = async () => {
    if (!conductorSugerido) return alert("Selecciona conductor");

    const nuevasDeudas = {...deudas};

    // Ajustar deudas según conductor
    pasajerosDia.forEach(p => {
      if (p === conductorSugerido) return;
      const clave = [p, conductorSugerido].sort().join("|");
      const info = nuevasDeudas[clave];
      if (info) {
        // Si p debía al conductor, se anula deuda
        if (info.deudor === p) {
          delete nuevasDeudas[clave];
        } else {
          // conductor adquirirá deuda con p
          info.cantidad += 1;
          info.deudor = conductorSugerido;
        }
      } else {
        nuevasDeudas[clave] = { deudor: p, cantidad: 1 };
      }
    });

    setDeudas(nuevasDeudas);
    await setDoc(doc(db, "deudas", "global"), nuevasDeudas);

    const nuevoHistorial = [
      { fecha: new Date().toISOString(), conductor: conductorSugerido, pasajeros: [...pasajerosDia] },
      ...historial.slice(0, 19)
    ];
    setHistorial(nuevoHistorial);
    await setDoc(doc(db, "historial", "viajes"), { viajes: nuevoHistorial });

    setPasajerosDia([]);
  };

  return (
    <div className="App">
      {!user ? (
        <button onClick={login}>Entrar con Google</button>
      ) : (
        <>
          <button onClick={logout}>Salir</button>
          <h1>Gestión de Coche</h1>

          <div className="participantes-section">
            <h2>Participantes</h2>
            <div className="agregar-participante">
              <input
                type="text"
                placeholder="Nombre del participante"
                value={nuevoParticipante}
                onChange={(e) => setNuevoParticipante(e.target.value)}
              />
              <button onClick={agregarParticipante}>Agregar</button>
            </div>
            <ul>
              {participantes.map(p => (
                <li key={p}>
                  {p} <button onClick={() => eliminarParticipante(p)}>Eliminar</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="pasajeros-section">
            <h2>Pasajeros de hoy</h2>
            {participantes.map(p => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={pasajerosDia.includes(p)}
                  onChange={() => togglePasajero(p)}
                />
                {p}
              </label>
            ))}
          </div>

          {pasajerosDia.length > 0 && (
            <div className="conductor-sugerido">
              <h2>Sugerencia de conductor: {conductorSugerido}</h2>
              <button onClick={confirmarViaje}>Confirmar viaje</button>

              <div className="deudas-conductor">
                <h3>Deudas del conductor con pasajeros de hoy:</h3>
                <ul>
                  {pasajerosDia.filter(p => p !== conductorSugerido).map(p => {
                    const clave = [p, conductorSugerido].sort().join("|");
                    const info = deudas[clave];
                    let cantidad = 0;
                    if (info) {
                      cantidad = info.deudor === conductorSugerido ? info.cantidad : 0;
                    }
                    return <li key={p}>{conductorSugerido} → {p}: {cantidad} viaje(s)</li>;
                  })}
                </ul>
              </div>
            </div>
          )}

          <h2>Deudas globales</h2>
          <table>
            <thead>
              <tr><th>Deudor</th><th>Acreedor</th><th>Cantidad</th></tr>
            </thead>
            <tbody>
              {Object.entries(deudas).map(([clave, info]) => {
                const [a,b] = clave.split("|");
                const acreedor = info.deudor === a ? b : a;
                return (
                  <tr key={clave}>
                    <td>{info.deudor}</td>
                    <td>{acreedor}</td>
                    <td>{info.cantidad}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <h2>Historial últimos 20 viajes</h2>
          <ul>
            {historial.map((v, idx) => (
              <li key={idx}>{v.fecha.split("T")[0]}: Conductor → {v.conductor}, Pasajeros → {v.pasajeros.join(", ")}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
