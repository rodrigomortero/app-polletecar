import React, { useState, useEffect } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [pasajerosDia, setPasajerosDia] = useState([]);
  const [deudas, setDeudas] = useState({});
  const [conductorSugerido, setConductorSugerido] = useState(null);
  const [conductorSeleccionado, setConductorSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [nuevoParticipante, setNuevoParticipante] = useState("");

  // LOGIN GOOGLE
  const login = async () => {
    const result = await signInWithPopup(auth, provider);
    setUser(result.user);
  };
  const logout = () => signOut(auth);

  // Cargar datos de Firebase
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "appData", "estado");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setParticipantes(data.participantes || []);
        setDeudas(data.deudas || {});
        setHistorial(data.historial || []);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Guardar datos en Firebase
  const guardarDatos = async (nuevosDatos) => {
    if (!user) return;
    const docRef = doc(db, "appData", "estado");
    await setDoc(docRef, nuevosDatos, { merge: true });
  };

  // Añadir participante
  const agregarParticipante = async () => {
    if (!nuevoParticipante || participantes.includes(nuevoParticipante)) return;
    const nuevos = [...participantes, nuevoParticipante];
    setParticipantes(nuevos);
    setNuevoParticipante("");
    await guardarDatos({ participantes: nuevos });
  };

  // Editar participante
  const editarParticipante = async (viejo, nuevo) => {
    if (!nuevo) return;
    if (!window.confirm(`Confirmar cambio de "${viejo}" a "${nuevo}"`)) return;
    const nuevos = participantes.map((p) => (p === viejo ? nuevo : p));
    setParticipantes(nuevos);
    setPasajerosDia(pasajerosDia.map((p) => (p === viejo ? nuevo : p)));
    await guardarDatos({ participantes: nuevos });
  };

  // Eliminar participante con doble confirmación
  const eliminarParticipante = async (nombre) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${nombre}?`)) return;
    if (!window.confirm("¡Confirmar eliminación definitiva!")) return;
    const nuevos = participantes.filter((p) => p !== nombre);
    setParticipantes(nuevos);
    setPasajerosDia(pasajerosDia.filter((p) => p !== nombre));

    // Eliminar deudas relacionadas
    const nuevasDeudas = { ...deudas };
    Object.keys(nuevasDeudas).forEach((clave) => {
      if (clave.includes(nombre)) delete nuevasDeudas[clave];
    });
    setDeudas(nuevasDeudas);
    await guardarDatos({ participantes: nuevos, deudas: nuevasDeudas });
  };

  // Sugerir conductor: quien más debe a los demás pasajeros del día
  const sugerirConductor = () => {
    if (!pasajerosDia.length) return;
    let maxDeuda = -1;
    let sugerido = pasajerosDia[0];
    pasajerosDia.forEach((p) => {
      let deudaTotal = 0;
      pasajerosDia.forEach((otro) => {
        if (p === otro) return;
        const clave = [p, otro].sort().join("|");
        const info = deudas[clave];
        if (info && info.deudor === p) deudaTotal += info.cantidad;
      });
      if (deudaTotal > maxDeuda) {
        maxDeuda = deudaTotal;
        sugerido = p;
      }
    });
    setConductorSugerido(sugerido);
    setConductorSeleccionado(sugerido);
  };

  // Confirmar viaje y actualizar deudas (netas)
  const confirmarViaje = async () => {
    if (!conductorSeleccionado) return alert("Selecciona un conductor");

    const nuevoHistorial = [
      { conductor: conductorSeleccionado, pasajeros: [...pasajerosDia], modificadoPor: user.displayName },
      ...historial,
    ].slice(0, 20);
    setHistorial(nuevoHistorial);

    const nuevasDeudas = { ...deudas };

    pasajerosDia.forEach((p) => {
      if (p === conductorSeleccionado) return;
      const clave = [p, conductorSeleccionado].sort().join("|");
      const actual = nuevasDeudas[clave];

      // Deuda neta: si el otro debía, se cancela, si no se añade
      if (!actual) {
        nuevasDeudas[clave] = { deudor: p, cantidad: 1 };
      } else {
        if (actual.deudor === conductorSeleccionado) {
          delete nuevasDeudas[clave];
        } else {
          delete nuevasDeudas[clave];
        }
      }
    });

    setDeudas(nuevasDeudas);
    await guardarDatos({ deudas: nuevasDeudas, historial: nuevoHistorial });

    setConductorSugerido(null);
    setConductorSeleccionado(null);
    alert("Viaje confirmado ✅");
  };

  // Reset total
  const resetTotal = async () => {
    if (!window.confirm("¿Seguro que quieres borrar todo?")) return;
    if (!window.confirm("¡Esto borrará TODO, confirmar de nuevo!")) return;
    setParticipantes([]);
    setPasajerosDia([]);
    setDeudas({});
    setHistorial([]);
    await guardarDatos({ participantes: [], deudas: {}, historial: [] });
  };

  if (!user) {
    return (
      <div className="App">
        <h1>Inicia sesión con Google</h1>
        <button onClick={login}>Entrar con Google</button>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Bienvenido {user.displayName}</h1>
      <button onClick={logout}>Cerrar sesión</button>
      <hr />

      <h2>Participantes habituales</h2>
      <input
        type="text"
        placeholder="Nuevo participante"
        value={nuevoParticipante}
        onChange={(e) => setNuevoParticipante(e.target.value)}
      />
      <button onClick={agregarParticipante}>Añadir</button>
      <ul>
        {participantes.map((p) => (
          <li key={p}>
            {p}{" "}
            <button onClick={() => {
              const nuevo = prompt("Nuevo nombre:", p);
              editarParticipante(p, nuevo);
            }}>Editar</button>{" "}
            <button onClick={() => eliminarParticipante(p)}>Eliminar</button>
          </li>
        ))}
      </ul>

      <h2>Pasajeros de hoy</h2>
      {participantes.map((p) => (
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
          />{" "}
          {p}
        </label>
      ))}

      <div style={{ marginTop: "20px" }}>
        <button onClick={sugerirConductor}>Sugerir conductor</button>
      </div>

      {conductorSugerido && (
        <div className="conductor-sugerido">
          <h2>Sugerencia: {conductorSugerido}</h2>
          <h3>Deudas del conductor con pasajeros de hoy:</h3>
          <ul>
            {pasajerosDia.map(p => {
              if (p === conductorSugerido) return null;
              const clave = [p, conductorSugerido].sort().join("|");
              const info = deudas[clave];
              if (!info) return <li key={p}>{p}: 0</li>;
              return <li key={p}>
                {info.deudor === conductorSugerido
                  ? `${conductorSugerido} le debe ${info.cantidad} a ${p}`
                  : `${p} le debe ${info.cantidad} a ${conductorSugerido}`}
              </li>
            })}
          </ul>

          <label>
            Seleccionar conductor manualmente:
            <select
              value={conductorSeleccionado}
              onChange={e => setConductorSeleccionado(e.target.value)}
            >
              {pasajerosDia.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <div style={{ marginTop: "20px" }}>
            <button onClick={confirmarViaje}>Confirmar viaje</button>
          </div>
        </div>
      )}

      <h2>Deudas generales</h2>
      <table className="deudas-table">
        <thead>
          <tr>
            <th>Deudor</th>
            <th>Deuda</th>
            <th>Acreedor</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(deudas).map(([clave, info]) => (
            <tr key={clave}>
              <td>{info.deudor}</td>
              <td>{info.cantidad}</td>
              <td>{clave.split("|").filter(x => x !== info.deudor)[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Historial últimos 20 viajes</h2>
      <ul className="historial-list">
        {historial.map((v, i) => (
          <li key={i}>
            {v.conductor} llevó a {v.pasajeros.join(", ")}
            {v.modificadoPor ? ` (modificado por: ${v.modificadoPor})` : ""}
          </li>
        ))}
      </ul>

      <button className="reset-button" onClick={resetTotal}>RESET TOTAL</button>
    </div>
  );
}
