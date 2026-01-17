import React, { useState } from "react";
import "./App.css";

function App() {
  const [participantes, setParticipantes] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");

  const [hoy, setHoy] = useState([]);
  const [deudas, setDeudas] = useState({});
  const [historial, setHistorial] = useState([]);

  const [resetPaso, setResetPaso] = useState(0);

  /* ---------------- PARTICIPANTES ---------------- */

  const añadirParticipante = () => {
    if (!nuevoNombre.trim()) return;
    if (participantes.includes(nuevoNombre)) return;
    setParticipantes([...participantes, nuevoNombre]);
    setNuevoNombre("");
  };

  const eliminarParticipante = (p) => {
    setParticipantes(participantes.filter(x => x !== p));
    setHoy(hoy.filter(x => x !== p));
  };

  /* ---------------- VIAJE HOY ---------------- */

  const toggleHoy = (p) => {
    setHoy(
      hoy.includes(p)
        ? hoy.filter(x => x !== p)
        : [...hoy, p]
    );
  };

  /* ---------------- SUGERENCIA ---------------- */

  const sugerirConductor = () => {
    let max = -1;
    let elegido = null;

    hoy.forEach(p => {
      let total = 0;
      hoy.forEach(o => {
        if (o !== p) total += deudas[p]?.[o] || 0;
      });
      if (total > max) {
        max = total;
        elegido = p;
      }
    });

    return elegido;
  };

  const sugerido = sugerirConductor();

  /* ---------------- CONFIRMAR VIAJE ---------------- */

  const confirmarViaje = (conductor = sugerido) => {
    if (!conductor || hoy.length < 2) return;

    const nuevas = JSON.parse(JSON.stringify(deudas));

    hoy.forEach(p => {
      if (p !== conductor) {
        nuevas[p] = nuevas[p] || {};
        nuevas[p][conductor] = (nuevas[p][conductor] || 0) + 1;
      }
    });

    const viaje = {
      fecha: new Date().toLocaleString(),
      pasajeros: [...hoy],
      conductor,
      accion: "Viaje confirmado"
    };

    setDeudas(nuevas);
    setHistorial([viaje, ...historial].slice(0, 20));
    setHoy([]);
  };

  /* ---------------- RESET TOTAL ---------------- */

  const resetTotal = () => {
    if (resetPaso === 0) {
      setResetPaso(1);
      return;
    }
    setParticipantes([]);
    setHoy([]);
    setDeudas({});
    setHistorial([]);
    setResetPaso(0);
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="app">
      <h1>🚗 PolleteCar</h1>

      {/* PARTICIPANTES */}
      <section>
        <h2>Participantes</h2>
        <input
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          placeholder="Nombre"
        />
        <button onClick={añadirParticipante}>Añadir</button>

        <ul>
          {participantes.map(p => (
            <li key={p}>
              {p}
              <button onClick={() => eliminarParticipante(p)}>❌</button>
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

          <p>Deudas del conductor sugerido:</p>
          <ul>
            {hoy.filter(p => p !== sugerido).map(p => (
              <li key={p}>
                {sugerido} debe {deudas[sugerido]?.[p] || 0} a {p}
              </li>
            ))}
          </ul>

          <button onClick={() => confirmarViaje()}>
            Confirmar viaje
          </button>
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
                {participantes.map(b => (
                  <td key={b}>
                    {a === b ? "—" : (deudas[a]?.[b] || 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* HISTORIAL */}
      <section>
        <h2>Historial (últimos 20)</h2>
        {historial.map((v, i) => (
          <div key={i} className="historial">
            <strong>{v.fecha}</strong><br />
            Pasajeros: {v.pasajeros.join(", ")}<br />
            Conductor: {v.conductor}<br />
            {v.accion}
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

export default App;
