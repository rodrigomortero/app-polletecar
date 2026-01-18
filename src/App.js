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

  /* ================= AUTH ================= */

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

  /* ================= FIREBASE ================= */

  const cargarDatos = async (uid) => {
    const snap = await getDoc(doc(db, "datos", uid));
    if (snap.exists()) {
      const d = snap.data();
      setParticipantes(d.participantes || []);
      setDeudas(d.deudas || {});
      setViajes(d.viajes || []);
      setLogs(d.logs || []);
    }
  };

  const guardarDatos = async () => {
    if (!user) return;
    await setDoc(doc(db, "datos", user.uid), {
      participantes,
      deudas,
      viajes,
      logs
    });
  };

  useEffect(() => {
    guardarDatos();
  }, [participantes, deudas, viajes, logs]);

  /* ================= LOGS ================= */

  const log = (accion, detalle) => {
    setLogs(l => [{
      usuario: user.email,
      fecha: new Date().toLocaleString(),
      accion,
      detalle
    }, ...l]);
  };

  /* ================= PARTICIPANTES ================= */

  const agregarParticipante = () => {
    if (!nuevoNombre.trim() || participantes.includes(nuevoNombre)) return;

    setParticipantes(p => [...p, nuevoNombre]);
    setDeudas(d => {
      const nuevo = structuredClone(d);
      nuevo[nuevoNombre] = {};
      [...participantes, nuevoNombre].forEach(p => {
        if (!nuevo[p]) nuevo[p] = {};
        nuevo[p][nuevoNombre] = 0;
        nuevo[nuevoNombre][p] = 0;
      });
      return nuevo;
    });

    log("AÑADIR PARTICIPANTE", `Se añadió "${nuevoNombre}"`);
    setNuevoNombre("");
  };

  /* ================= SUGERENCIA ================= */

  const sugerirConductor = () => {
    let candidato = null;
    let maxDeuda = -Infinity;

    pasajerosHoy.forEach(p => {
      let deuda = 0;
      pasajerosHoy.forEach(o => {
        if (o !== p && deudas[o]?.[p] > 0) deuda += deudas[o][p];
      });
      if (deuda > maxDeuda) {
        maxDeuda = deuda;
        candidato = p;
      }
    });

    return candidato;
  };

  const conductorFinal = conductorManual || sugerirConductor();

  /* ================= CONFIRMAR VIAJE ================= */

  const confirmarViaje = () => {
    if (!conductorFinal || pasajerosHoy.length < 2) return;

    const nuevasDeudas = structuredClone(deudas);

    pasajerosHoy.forEach(p => {
      if (p !== conductorFinal) {
        nuevasDeudas[conductorFinal][p] += 1;
        nuevasDeudas[p][conductorFinal] -= 1;
      }
    });

    const viaje = {
      fecha: new Date().toLocaleDateString(),
      conductorConfirmado: conductorFinal,
      pasajeros: pasajerosHoy
    };

    setDeudas(nuevasDeudas);
    setViajes(v => [viaje, ...v].slice(0, 20));
    log("CONFIRMAR VIAJE", `Conductor: ${conductorFinal}`);

    setPasajerosHoy([]);
    setConductorManual(null);
  };

  /* ================= UI ================= */

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
        <span>{user.email}</span>
        <button onClick={logout}>Salir</button>
      </header>

      <section>
        <h2>Participantes</h2>
        <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
        <button onClick={agregarParticipante}>Añadir</button>
        {participantes.map(p => <div key={p}>{p}</div>)}
      </section>

      <section>
        <h2>Pasajeros de hoy</h2>
        {participantes.map(p => (
          <label key={p}>
            <input
              type="checkbox"
              checked={pasajerosHoy.includes(p)}
              onChange={() =>
                setPasajerosHoy(h =>
                  h.includes(p) ? h.filter(x => x !== p) : [...h, p]
                )
              }
            />
            {p}
          </label>
        ))}
      </section>

      <section>
        <h2>Sugerencia de conductor</h2>
        <strong>{conductorFinal || "—"}</strong>
        <button onClick={confirmarViaje}>Confirmar viaje</button>
      </section>

      <section>
        <h2>Deudas</h2>
        {Object.entries(deudas).map(([acreedor, obj]) =>
          Object.entries(obj).map(([deudor, v]) =>
            v > 0 ? (
              <div key={acreedor + deudor}>
                {deudor} → {acreedor} : {v}
              </div>
            ) : null
          )
        )}
      </section>

      <section>
        <h2>Historial</h2>
        {viajes.map((v, i) => (
          <div key={i}>
            {v.fecha} – Conductor: <strong>{v.conductorConfirmado}</strong>
          </div>
        ))}
      </section>

      <section>
        <h2>Actividad</h2>
        {logs.map((l, i) => (
          <div key={i}>
            [{l.fecha}] {l.usuario}: {l.accion} → {l.detalle}
          </div>
        ))}
      </section>
    </div>
  );
}
