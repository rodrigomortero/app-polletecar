// src/aplicacion.js
import React, { useEffect, useState } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    participantes: [],
    viajes: [],
    actividad: [],
  });
  const [seleccionados, setSeleccionados] = useState([]);
  const [conductorSugerido, setConductorSugerido] = useState("");

  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    const ref = doc(db, "app", "datos");
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setData(snap.data());
    });
  }, []);

  async function guardar(nuevo, texto) {
    const ref = doc(db, "app", "datos");
    const actividad = [
      {
        texto,
        usuario: user.displayName,
        fecha: new Date().toISOString(),
      },
      ...(nuevo.actividad || []),
    ].slice(0, 100);
    await setDoc(ref, { ...nuevo, actividad });
  }

  const añadirParticipante = () => {
    const nombre = prompt("Nombre participante:");
    if (!nombre) return;
    guardar(
      { ...data, participantes: [...data.participantes, nombre] },
      `➕ ${nombre} añadido`
    );
  };

  const sugerirConductor = () => {
    if (seleccionados.length === 0) {
      setConductorSugerido("");
      return;
    }
    let minDeuda = Infinity;
    let sugerido = seleccionados[0];
    seleccionados.forEach((p) => {
      let deuda = 0;
      data.viajes.forEach((v) => {
        if (v.participantes.includes(p) && v.conductor !== p) deuda++;
      });
      if (deuda < minDeuda) {
        minDeuda = deuda;
        sugerido = p;
      }
    });
    setConductorSugerido(sugerido);
  };

  const confirmarViaje = () => {
    if (seleccionados.length === 0 || !conductorSugerido) {
      alert("Selecciona participantes y conductor.");
      return;
    }
    const nuevoViaje = {
      fecha: new Date().toISOString().split("T")[0],
      participantes: [...seleccionados],
      conductor: conductorSugerido,
    };
    guardar(
      { ...data, viajes: [nuevoViaje, ...data.viajes].slice(0, 20) },
      `🚗 Viaje confirmado por ${conductorSugerido}`
    );
    setSeleccionados([]);
    setConductorSugerido("");
  };

  if (!user)
    return (
      <div style={{ padding: 40 }}>
        <h2>🚗 Coche Compartido</h2>
        <button onClick={() => signInWithPopup(auth, provider)}>
          Entrar con Google
        </button>
      </div>
    );

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <h2>🚗 Coche Compartido</h2>
      <p>Hola {user.displayName}</p>
      <button onClick={() => signOut(auth)}>Cerrar sesión</button>
      <hr />

      {/* Test Firebase */}
      <div style={{ padding: 10, background: "#eee", marginBottom: 20 }}>
        <b>Test Firebase:</b>
        <div>Auth conectado: {auth ? "✅" : "❌"}</div>
        <div>Firestore conectado: {db ? "✅" : "❌"}</div>
      </div>

      <h3>Participantes</h3>
      {data.participantes.map((p) => (
        <div key={p}>
          <label>
            <input
              type="checkbox"
              checked={seleccionados.includes(p)}
              onChange={() =>
                setSeleccionados((prev) =>
                  prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                )
              }
            />
            {p}
          </label>
        </div>
      ))}
      <button onClick={añadirParticipante}>Añadir participante</button>

      <hr />
      <h3>Conductor sugerido</h3>
      <button onClick={sugerirConductor}>Sugerir conductor</button>
      {conductorSugerido && (
        <div>
          🚗 Sugerido: <b>{conductorSugerido}</b>
        </div>
      )}
      <button onClick={confirmarViaje} style={{ marginTop: 10 }}>
        Confirmar viaje
      </button>

      <hr />
      <h3>Últimos viajes</h3>
      {data.viajes.map((v, i) => (
        <div key={i}>
          {v.fecha} – Conductor: <b>{v.conductor}</b> – Participantes:{" "}
          {v.participantes.join(", ")}
        </div>
      ))}

      <hr />
      <h3>Actividad reciente</h3>
      {data.actividad.map((a, i) => (
        <div key={i}>
          {a.texto} – {a.usuario} – {new Date(a.fecha).toLocaleString()}
        </div>
      ))}
    </div>
  );
}
