import { useEffect, useState } from "react";
import "./App.css";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";

/*
MODELO DE DEUDAS:
deudas[A][B] > 0  => B debe a A
deudas[A][B] < 0  => A debe a B
Siempre: deudas[A][B] === -deudas[B][A]
*/

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

  const login = async () => {
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  /* ================= FIRESTORE ================= */

  const cargarDatos = async (uid) => {
    const ref = doc(db, "datos", uid);
    const snap = await getDoc(ref);
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

  /* ================= UTILIDADES ================= */

  const registrarLog = (texto) => {
    setLogs(l => [{
      texto,
      usuario: user.email,
      fecha: new Date().toISOString()
    }, ...l]);
  };

  const inicializarDeudas = (nombres) => {
    const d = {};
    nombres.forEach(a => {
      d[a] = {};
      nombres.forEach(b => {
        d[a][b] = 0;
      });
    });
    return d;
  };

  /* ================= PARTICIPANTES ================= */

  const agregarParticipante = () => {
    if (!nuevoNombre.trim()) return;
    if (participantes.includes(nuevoNombre)) return;

    const nuevos = [...participantes, nuevoNombre];
    setParticipantes(nuevos);

    const d = structuredClone(deudas);
    nuevos.forEach(a => {
      if (!d[a]) d[a] = {};
      nuevos.forEach(b => {
        if (d[a][b] === undefined) d[a][b] = 0;
      });
    });

    setDeudas(d);
    registrarLog(`Añadido participante: ${nuevoNombre}`);
    setNuevoNombre("");
  };

  const eliminarParticipante = (nombre) => {
    if (!window.confirm(`Eliminar a ${nombre}?`)) return;
    if (!window.confirm("Esto borrará TODAS sus deudas. ¿Seguro?")) return;

    const nuevos = participantes.filter(p => p !== nombre);
    const d = structuredClone(deudas);
    delete d[nombre];
    nuevos.forEach(p => delete d[p][nombre]);

    setParticipantes(nuevos);
    setDeudas(d);
    registrarLog(`Eliminado participante: ${nombre}`);
  };

  /* ================= SUGERENCIA DE CONDUCTOR ================= */

  const sugerirConductor = () => {
    let candidato = null;
    let maxDeuda = -Infinity;

    pasajerosHoy.forEach(p => {
      let deuda = 0;
      pasajerosHoy.forEach(o => {
        if (p !== o && deudas[o]?.[p] > 0) {
          deuda += deudas[o][p];
        }
      });
      if (deuda > maxDeuda) {
        maxDeuda = deuda;
        candidato = p;
      }
    });

    return candidato;
  };

  const conductorSugerido = sugerirConductor();
  const conductorFinal = conductorManual || conductorSugerido;

  /* ================= CONFIRMAR VIAJE ================= */

  const confirmarViaje = () => {
    if (!conductorFinal) return;

    const d = structuredClone(deudas);

    pasajerosHoy.forEach(p => {
      if (p === conductorFinal) return;
      d[conductorFinal][p] += 1;
      d[p][conductorFinal] -= 1;
    });

    const nuevoViaje = {
      fecha: new Date().toISOString(),
      pasajeros: pasajerosHoy,
      conductor: conductorFinal
    };

    setDeudas(d);
    setViajes(v => [nuevoViaje, ...v].slice(0, 20));
    registrarLog(`Confirmado viaje con conductor ${conductorFinal}`);

    setPasajerosHoy([]);
    setConductorManual(null);
  };

  /* ================= EDITAR VIAJES ================= */

  const recalcularDesdeCero = (listaViajes) => {
    const d = inicializarDeudas(participantes);
    listaViajes.slice().reverse().forEach(v => {
      v.pasajeros.forEach(p => {
        if (p !== v.conductor) {
          d[v.conductor][p] += 1;
          d[p][v.conductor] -= 1;
        }
      });
    });
    return d;
  };

  const editarViaje = (index, nuevoConductor) => {
    if (index >= 5) return;

    const copia = [...viajes];
    copia[index].conductor = nuevoConductor;

    setViajes(copia);
    setDeudas(recalcularDesdeCero(copia));
    registrarLog(`Editado viaje ${index + 1}`);
  };

  /* ================= RESET TOTAL ================= */

  const resetTotal = () => {
    if (!window.confirm("⚠️ BORRAR TODO. ¿Continuar?")) return;
    if (!window.confirm("❌ Última confirmación. ¿Seguro?")) return;

    setParticipantes([]);
    setPasajerosHoy([]);
    setDeudas({});
    setViajes([]);
    setLogs([]);
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
        <input
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          placeholder="Nombre"
        />
        <button onClick={agregarParticipante}>Añadir</button>

        {participantes.map(p => (
          <div key={p}>
            {p}
            <button onClick={() => eliminarParticipante(p)}>❌</button>
          </div>
        ))}
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

        {pasajerosHoy.map(p => (
          <button key={p} onClick={() => setConductorManual(p)}>
            Forzar {p}
          </button>
        ))}

        <button onClick={confirmarViaje}>Confirmar viaje</button>
      </section>

      <section>
        <h2>Deudas</h2>
        {participantes.map(a =>
          participantes.map(b =>
            a !== b && deudas[a]?.[b] > 0 ? (
              <div key={a + b}>
                {b} debe {deudas[a][b]} viaje(s) a {a}
              </div>
            ) : null
          )
        )}
      </section>

      <section>
        <h2>Historial (20)</h2>
        {viajes.map((v, i) => (
          <div key={i}>
            {v.fecha.slice(0, 10)} – {v.conductor}
            {i < 5 &&
              v.pasajeros.map(p => (
                <button key={p} onClick={() => editarViaje(i, p)}>
                  Cambiar a {p}
                </button>
              ))}
          </div>
        ))}
      </section>

      <section>
        <h2>Actividad</h2>
        {logs.slice(0, 20).map((l, i) => (
          <div key={i}>
            {l.fecha.slice(0, 19)} – {l.usuario} – {l.texto}
          </div>
        ))}
      </section>

      <button className="reset" onClick={resetTotal}>
        RESET TOTAL
      </button>
    </div>
  );
}
