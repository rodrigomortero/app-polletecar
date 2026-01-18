import { useEffect, useState } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [pasajerosHoy, setPasajerosHoy] = useState([]);
  const [deudas, setDeudas] = useState({});
  const [viajes, setViajes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [conductorManual, setConductorManual] = useState(null);
  const [confirmReset, setConfirmReset] = useState(0);
  const [editando, setEditando] = useState(null);

  /* ========== AUTH ========== */

  useEffect(() => {
    onAuthStateChanged(auth, u => {
      if (u) {
        setUser(u);
        cargarDatos(u.uid);
      }
    });
  }, []);

  const login = async () => await signInWithPopup(auth, provider);
  const logout = async () => await signOut(auth);

  /* ========== FIREBASE ========== */

  const cargarDatos = async uid => {
    const snap = await getDoc(doc(db, "datos", uid));
    if (snap.exists()) {
      const d = snap.data();
      setParticipantes(d.participantes || []);
      setDeudas(d.deudas || {});
      setViajes(d.viajes || []);
      setLogs(d.logs || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    setDoc(doc(db, "datos", user.uid), {
      participantes,
      deudas,
      viajes,
      logs
    });
  }, [participantes, deudas, viajes, logs]);

  /* ========== LOG ========== */

  const log = (accion, detalle) => {
    setLogs(l => [{
      usuario: user.email,
      fecha: new Date().toLocaleString(),
      accion,
      detalle
    }, ...l]);
  };

  /* ========== PARTICIPANTES ========== */

  const agregarParticipante = () => {
    if (!nuevoNombre.trim() || participantes.includes(nuevoNombre)) return;

    setParticipantes(p => [...p, nuevoNombre]);
    setDeudas(d => {
      const n = structuredClone(d);
      n[nuevoNombre] = {};
      [...participantes, nuevoNombre].forEach(p => {
        if (!n[p]) n[p] = {};
        n[p][nuevoNombre] = 0;
        n[nuevoNombre][p] = 0;
      });
      return n;
    });

    log("AÑADIR PARTICIPANTE", nuevoNombre);
    setNuevoNombre("");
  };

  /* ========== SUGERENCIA ========== */

  const sugerirConductor = () => {
    let mejor = null;
    let max = -Infinity;

    pasajerosHoy.forEach(p => {
      let deuda = 0;
      pasajerosHoy.forEach(o => {
        if (o !== p && deudas[o]?.[p] > 0) deuda += deudas[o][p];
      });
      if (deuda > max) {
        max = deuda;
        mejor = p;
      }
    });
    return mejor;
  };

  const conductorFinal = conductorManual || sugerirConductor();

  /* ========== CONFIRMAR VIAJE ========== */

  const confirmarViaje = () => {
    if (!conductorFinal || pasajerosHoy.length < 2) return;

    const d = structuredClone(deudas);

    pasajerosHoy.forEach(p => {
      if (p !== conductorFinal) {
        d[conductorFinal][p] += 1;
        d[p][conductorFinal] -= 1;
      }
    });

    const viaje = {
      fecha: new Date().toLocaleDateString(),
      conductor: conductorFinal,
      pasajeros: pasajerosHoy
    };

    setDeudas(d);
    setViajes(v => [viaje, ...v].slice(0, 20));
    log("CONFIRMAR VIAJE", `Conductor ${conductorFinal}`);
    setPasajerosHoy([]);
    setConductorManual(null);
  };

  /* ========== EDITAR VIAJE ========== */

  const guardarEdicion = (i, nuevo) => {
    const v = viajes[i];
    const d = structuredClone(deudas);

    v.pasajeros.forEach(p => {
      if (p !== v.conductor) {
        d[v.conductor][p] -= 1;
        d[p][v.conductor] += 1;
      }
      if (p !== nuevo) {
        d[nuevo][p] += 1;
        d[p][nuevo] -= 1;
      }
    });

    const copia = [...viajes];
    copia[i] = { ...v, conductor: nuevo };

    setViajes(copia);
    setDeudas(d);
    log("EDITAR VIAJE", `Conductor ${v.conductor} → ${nuevo}`);
    setEditando(null);
  };

  /* ========== RESET TOTAL ========== */

  const resetTotal = () => {
    if (confirmReset === 0) {
      setConfirmReset(1);
    } else if (confirmReset === 1) {
      setParticipantes([]);
      setDeudas({});
      setViajes([]);
      setLogs([]);
      setConfirmReset(0);
      log("RESET TOTAL", "Se borraron todos los datos");
    }
  };

  /* ========== UI ========== */

  if (!user) {
    return (
      <div className="login">
        <h1>PolleteCar</h1>
        <button onClick={login}>Entrar con Google</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>PolleteCar</h1>
        <button onClick={logout}>Salir</button>
      </header>

      <section className="card">
        <h2>Participantes</h2>
        <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
        <button onClick={agregarParticipante}>Añadir</button>
        {participantes.map(p => <div key={p}>{p}</div>)}
      </section>

      <section className="card">
        <h2>Pasajeros hoy</h2>
        {participantes.map(p => (
          <label key={p}>
            <input type="checkbox" checked={pasajerosHoy.includes(p)}
              onChange={() =>
                setPasajerosHoy(h =>
                  h.includes(p) ? h.filter(x => x !== p) : [...h, p]
                )
              } />
            {p}
          </label>
        ))}
      </section>

      <section className="card">
        <h2>Sugerencia</h2>
        <strong>{conductorFinal || "—"}</strong>
        <button onClick={confirmarViaje}>Confirmar viaje</button>
      </section>

      <section className="card">
        <h2>Deudas</h2>
        {Object.entries(deudas).map(([a, o]) =>
          Object.entries(o).map(([d, v]) =>
            v > 0 && <div key={a + d}>{d} → {a}: {v}</div>
          )
        )}
      </section>

      <section className="card">
        <h2>Historial</h2>
        {viajes.map((v, i) => (
          <div key={i}>
            {v.fecha} – {v.conductor}
            {i < 5 && (
              <>
                {editando === i ? (
                  participantes.map(p =>
                    <button key={p} onClick={() => guardarEdicion(i, p)}>{p}</button>
                  )
                ) : (
                  <button onClick={() => setEditando(i)}>Editar</button>
                )}
              </>
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Actividad</h2>
        {logs.map((l, i) =>
          <div key={i}>
            [{l.fecha}] {l.usuario}: {l.accion} → {l.detalle}
          </div>
        )}
      </section>

      <section className="card danger">
        <button onClick={resetTotal}>
          {confirmReset === 0 && "Reset total"}
          {confirmReset === 1 && "CONFIRMAR BORRADO TOTAL"}
        </button>
      </section>
    </div>
  );
}
