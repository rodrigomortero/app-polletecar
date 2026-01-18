// src/App.js
import React, { useEffect, useState } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [pasajerosDia, setPasajerosDia] = useState([]);
  const [conductorSugerido, setConductorSugerido] = useState("");
  const [deudas, setDeudas] = useState({});
  const [historial, setHistorial] = useState([]);

  // --- Google Auth ---
  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert("Error de login: " + err.message);
    }
  };
  const logout = async () => await signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  // --- Cargar participantes, deudas e historial desde Firestore ---
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

  // --- Sugerir conductor ---
  useEffect(() => {
    if (pasajerosDia.length === 0) return;

    let maxDeuda = -1;
    let sugerido = pasajerosDia[0];

    pasajerosDia.forEach(p => {
      let total = 0;
      pasajerosDia.forEach(q => {
        if (p === q) return;
        const clave = [p, q].sort().join("|");
        total += deudas[clave]?.cantidad || 0;
      });
      if (total > maxDeuda) {
        maxDeuda = total;
        sugerido = p;
      }
    });

    setConductorSugerido(sugerido);
  }, [pasajerosDia, deudas]);

  // --- Confirmar viaje ---
  const confirmarViaje = async () => {
    if (!conductorSugerido) return alert("Selecciona conductor");

    try {
      // Actualizar deudas
      const nuevasDeudas = {...deudas};
      pasajerosDia.forEach(p => {
        if (p === conductorSugerido) return;
        const clave = [p, conductorSugerido].sort().join("|");
        const cantidad = nuevasDeudas[clave]?.cantidad || 0;

        // Cancelar si se devuelve el viaje
        if (conductorSugerido === p) return;
        if (nuevasDeudas[clave]) {
          nuevasDeudas[clave].cantidad = Math.max(0, nuevasDeudas[clave].cantidad - 1);
          if (nuevasDeudas[clave].cantidad === 0) delete nuevasDeudas[clave];
        } else {
          nuevasDeudas[clave] = { deudor: p, cantidad: 1 };
        }
      });

      await setDoc(doc(db, "deudas", "global"), nuevasDeudas);
      setDeudas(nuevasDeudas);

      // Actualizar historial
      const nuevoHistorial = [
        { fecha: new Date().toISOString(), conductor: conductorSugerido, pasajeros: [...pasajerosDia] },
        ...historial.slice(0, 19)
      ];
      await setDoc(doc(db, "historial", "viajes"), { viajes: nuevoHistorial });
      setHistorial(nuevoHistorial);

      // Reset pasajerosDia para siguiente día
      setPasajerosDia([]);

    } catch (error) {
      console.error("Error al confirmar viaje:", error);
      alert("Ha ocurrido un error al confirmar viaje.");
    }
  };

  // --- Editar participantes ---
  const eliminarParticipante = async (nombre) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${nombre}?`)) return;
    const nuevaLista = participantes.filter(p => p !== nombre);
    setParticipantes(nuevaLista);
    await setDoc(doc(db, "participantes", "global"), { lista: nuevaLista });
  };

  return (
    <div className="App">
      {!user ? (
        <button onClick={login}>Entrar con Google</button>
      ) : (
        <>
          <button onClick={logout}>Salir</button>
          <h1>Gestión de Coche</h1>

          <h2>Participantes</h2>
          <ul>
            {participantes.map(p => (
              <li key={p}>
                {p} <button onClick={() => eliminarParticipante(p)}>Eliminar</button>
              </li>
            ))}
          </ul>

          <h2>Pasajeros de hoy</h2>
          {participantes.map(p => (
            <label key={p}>
              <input
                type="checkbox"
                checked={pasajerosDia.includes(p)}
                onChange={(e) => {
                  if (e.target.checked)
                    setPasajerosDia([...pasajerosDia, p]);
                  else
                    setPasajerosDia(pasajerosDia.filter(x => x !== p));
                }}
              />
              {p}
            </label>
          ))}

          {pasajerosDia.length > 0 && (
            <div className="conductor-sugerido">
              <h2>Sugerencia de conductor: {conductorSugerido}</h2>
              <button onClick={confirmarViaje}>Confirmar viaje</button>
            </div>
          )}

          <h2>Deudas</h2>
          <table className="deudas-table">
            <thead>
              <tr>
                <th>Deudor</th>
                <th>Acreedor</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(deudas).map(([clave, valor]) => {
                const [a, b] = clave.split("|");
                return (
                  <tr key={clave}>
                    <td>{valor.deudor}</td>
                    <td>{valor.deudor === a ? b : a}</td>
                    <td>{valor.cantidad}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2>Historial últimos 20 viajes</h2>
          <ul className="historial-list">
            {historial.map((v, idx) => (
              <li key={idx}>
                {v.fecha.split("T")[0]}: Conductor → {v.conductor}, Pasajeros → {v.pasajeros.join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
