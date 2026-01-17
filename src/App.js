import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  // Participantes habituales
  const [participantes, setParticipantes] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");

  // Viaje de hoy
  const [hoy, setHoy] = useState([]);
  const [conductorFinal, setConductorFinal] = useState(null);

  // Deudas: { A: { B: n } }
  const [deudas, setDeudas] = useState({});

  /* ---------------- PARTICIPANTES ---------------- */

  const añadirParticipante = () => {
    if (!nuevoNombre.trim()) return;
    if (participantes.includes(nuevoNombre)) return;

    setParticipantes([...participantes, nuevoNombre]);
    setNuevoNombre("");
  };

  const eliminarParticipante = (nombre) => {
    setParticipantes(participantes.filter(p => p !== nombre));
    setHoy(hoy.filter(p => p !== nombre));
  };

  /* ---------------- VIAJE HOY ---------------- */

  const toggleHoy = (nombre) => {
    setHoy(
      hoy.includes(nombre)
        ? hoy.filter(p => p !== nombre)
        : [...hoy, nombre]
    );
  };

  /* ---------------- SUGERENCIA CONDUCTOR ---------------- */

  const sugerirConductor = () => {
    if (hoy.length === 0) return null;

    let peor = hoy[0];
    let maxDeuda = -1;

    hoy.forEach(p => {
      let deudaTotal = 0;
      hoy.forEach(o => {
        if (o !== p) {
          deudaTotal += deudas[p]?.[o] || 0;
        }
      });

      if (deudaTotal > maxDeuda) {
        maxDeuda = deudaTotal;
        peor = p;
      }
    });

    return peor;
  };

  const sugerido = sugerirConductor();

  /* ---------------- CONFIRMAR VIAJE ---------------- */

  const confirmarViaje = () => {
    if (!conductorFinal || hoy.length < 2) return;

    const nuevas = { ...deudas };

    hoy.forEach(p => {
      if (p !== conductorFinal) {
        if (!nuevas[p]) nuevas[p] = {};
        nuevas[p][conductorFinal] =
          (nuevas[p][conductorFinal] || 0) + 1;
      }
    });

    setDeudas(nuevas);
    setHoy([]);
    setConductorFinal(null);
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="app">
      <h1>🚗 PolleteCar</h1>

      {/* PARTICIPANTES */}
      <section>
        <h2>Participantes habituales</h2>
        <div className="fila">
          <input
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            placeholder="Nombre"
          />
          <button onClick={añadirParticipante}>Añadir</button>
        </div>

        <ul>
          {participantes.map(p => (
            <li key={p}>
              {p}
              <button onClick={() => eliminarParticipante(p)}>❌</button>
            </li>
          ))}
        </ul>
      </section>

      {/* VIAJE DE HOY */}
      <section>
        <h2>¿Quién va hoy en el coche?</h2>
        {participantes.map(p => (
          <label key={p} className="check">
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

          <p>Deudas de {sugerido} con los pasajeros de hoy:</p>
          <ul>
            {hoy
              .filter(p => p !== sugerido)
              .map(p => (
                <li key={p}>
                  {sugerido} debe {deudas[sugerido]?.[p] || 0} a {p}
                </li>
              ))}
          </ul>

          <select
            value={conductorFinal || ""}
            onChange={e => setConductorFinal(e.target.value)}
          >
            <option value="">Elegir conductor final</option>
            {hoy.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <button onClick={confirmarViaje}>
            Confirmar viaje
          </button>
        </section>
      )}

      {/* DEUDAS */}
      <section>
        <h2>Deudas entre participantes</h2>
        {participantes.map(a => (
          <div key={a} className="deuda">
            <strong>{a}</strong>
            <ul>
              {participantes
                .filter(b => b !== a)
                .map(b => (
                  <li key={b}>
                    debe {deudas[a]?.[b] || 0} a {b}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

export default App;
