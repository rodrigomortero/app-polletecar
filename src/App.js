<h1 style={{ color: "red" }}>CAMBIO DE PRUEBA</h1>
import React, { useState } from "react";
import "./App.css";

/* ================== UTILIDADES DE DEUDA ================== */

const parKey = (a, b) => [a, b].sort().join("|");

const aplicarViajeADudas = (deudas, conductor, pasajeros) => {
  let nuevas = { ...deudas };

  pasajeros.forEach(p => {
    if (p === conductor) return;

    const key = parKey(p, conductor);
    const actual = nuevas[key];

    if (!actual) {
      nuevas[key] = { deudor: p, cantidad: 1 };
      return;
    }

    // Si el pasajero debía al conductor → se reduce
    if (actual.deudor === p) {
      if (actual.cantidad === 1) {
        delete nuevas[key];
      } else {
        nuevas[key] = { ...actual, cantidad: actual.cantidad - 1 };
      }
      return;
    }

    // Si el conductor debía al pasajero → aumenta
    nuevas[key] = {
      deudor: conductor,
      cantidad: actual.cantidad + 1
    };
  });

  return nuevas;
};

const recalcularTodasLasDeudas = (historial) => {
  let deudas = {};
  historial.forEach(v => {
    deudas = aplicarViajeADudas(deudas, v.conductor, v.pasajeros);
  });
  return deudas;
};

/* ================== APP ================== */

export default function App() {
  const [participantes, setParticipantes] = useState([]);
  const [nuevo, setNuevo] = useState("");

  const [hoy, setHoy] = useState([]);
  const [conductorManual, setConductorManual] = useState("");

  const [historial, setHistorial] = useState([]);
  const [deudas, setDeudas] = useState({});

  const [resetPaso, setResetPaso] = useState(0);

  /* ================== PARTICIPANTES ================== */

  const addParticipante = () => {
    if (!nuevo.trim()) return;
    if (participantes.includes(nuevo)) return;
    setParticipantes([...participantes, nuevo]);
    setNuevo("");
  };

  const removeParticipante = (p) => {
    setParticipantes(participantes.filter(x => x !== p));
    setHoy(hoy.filter(x => x !== p));
  };

  /* ================== VIAJE DE HOY ================== */

  const toggleHoy = (p) => {
    setHoy(
      hoy.includes(p)
        ? hoy.filter(x => x !== p)
        : [...hoy, p]
    );
  };

  /* ================== SUGERENCIA CONDUCTOR ================== */

  const sugerirConductor = () => {
    if (hoy.length < 2) return "";

    let peor = "";
    let max = -1;

    hoy.forEach(p => {
      let total = 0;
      hoy.forEach(o => {
        if (o === p) return;
        const key = parKey(p, o);
        const d = deudas[key];
        if (d && d.deudor === p) total += d.cantidad;
      });

      if (total > max) {
        max = total;
        peor = p;
      }
    });

    return peor;
  };

  const sugerido = sugerirConductor();
  const conductorFinal = conductorManual || sugerido;

  /* ================== CONFIRMAR VIAJE ================== */

  const confirmarViaje = () => {
    if (!conductorFinal || hoy.length < 2) return;

    const nuevoViaje = {
      id: Date.now(),
      fecha: new Date().toLocaleString(),
      pasajeros: [...hoy],
      conductor: conductorFinal
    };

    const nuevoHistorial = [nuevoViaje, ...historial].slice(0, 20);
    const nuevasDeudas = recalcularTodasLasDeudas(nuevoHistorial);

    setHistorial(nuevoHistorial);
    setDeudas(nuevasDeudas);
    setHoy([]);
    setConductorManual("");
  };

  /* ================== EDITAR ÚLTIMOS 5 VIAJES ================== */

  const editarConductor = (id, nuevoConductor) => {
    const editado = historial.map(v =>
      v.id === id ? { ...v, conductor: nuevoConductor } : v
    );

    setHistorial(editado);
    setDeudas(recalcularTodasLasDeudas(editado));
  };

  /* ================== RESET TOTAL ================== */

  const resetTotal = () => {
    if (resetPaso === 0) {
      setResetPaso(1);
      return;
    }
    setParticipantes([]);
    setHoy([]);
    setHistorial([]);
    setDeudas({});
    setConductorManual("");
    setResetPaso(0);
  };

  /* ================== RENDER ================== */

  return (
    <div className="app">
      <h1>🚗 PolleteCar</h1>

      {/* PARTICIPANTES */}
      <section>
        <h2>Participantes</h2>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} />
        <button onClick={addParticipante}>Añadir</button>
        <ul>
          {participantes.map(p => (
            <li key={p}>
              {p}
              <button onClick={() => removeParticipante(p)}>❌</button>
            </li>
          ))}
        </ul>
      </section>

      {/* VIAJE */}
      <section>
        <h2>¿Quién va hoy?</h2>
        {participantes.map(p => (
          <label key={p}>
            <input
              type="checkbox"
              checked={hoy.includes(p)}
              onChange={() => toggleHoy(p)}
            />
            {p}
          </label>
        ))}
      </section>

      {/* SUGERENCIA */}
      {sugerido && (
        <section className="sugerencia">
          <h2>Sugerencia de posible conductor</h2>
          <strong>{sugerido}</strong>

          <p>Deudas del conductor sugerido con los pasajeros de hoy:</p>
          <ul>
            {hoy.filter(p => p !== sugerido).map(p => {
              const key = parKey(sugerido, p);
              const d = deudas[key];
              const cant = d && d.deudor === sugerido ? d.cantidad : 0;
              return <li key={p}>{sugerido} debe {cant} a {p}</li>;
            })}
          </ul>

          <select
            value={conductorManual}
            onChange={e => setConductorManual(e.target.value)}
          >
            <option value="">Usar sugerencia</option>
            {hoy.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <button onClick={confirmarViaje}>Confirmar viaje</button>
        </section>
      )}

      {/* DEUDAS */}
      <section>
        <h2>Deudas</h2>
        <table>
          <thead>
            <tr>
              <th>Debe \ A</th>
              {participantes.map(p => <th key={p}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {participantes.map(a => (
              <tr key={a}>
                <td><strong>{a}</strong></td>
                {participantes.map(b => {
                  if (a === b) return <td key={b}>—</td>;
                  const key = parKey(a, b);
                  const d = deudas[key];
                  const v = d && d.deudor === a ? d.cantidad : 0;
                  return <td key={b}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* HISTORIAL */}
      <section>
        <h2>Historial (20 últimos)</h2>
        {historial.map((v, i) => (
          <div key={v.id} className="historial">
            <strong>{v.fecha}</strong><br />
            Pasajeros: {v.pasajeros.join(", ")}<br />
            Conductor:
            {i < 5 ? (
              <select
                value={v.conductor}
                onChange={e => editarConductor(v.id, e.target.value)}
              >
                {v.pasajeros.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <strong> {v.conductor}</strong>
            )}
          </div>
        ))}
      </section>

      {/* RESET */}
      <section>
        <button className="reset" onClick={resetTotal}>
          {resetPaso === 0 ? "RESET TOTAL" : "¿SEGURO? CONFIRMAR RESET"}
        </button>
      </section>
    </div>
  );
}
