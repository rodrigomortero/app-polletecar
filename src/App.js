import React, { useState } from "react";
import "./App.css";

export default function App() {
  const [participantes, setParticipantes] = useState(["Ana", "Edu"]);
  const [pasajerosDia, setPasajerosDia] = useState([...participantes]);
  const [deudas, setDeudas] = useState({});
  const [conductorSugerido, setConductorSugerido] = useState(null);
  const [conductorSeleccionado, setConductorSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);

  // Calcula la sugerencia de conductor: quien más debe a los demás de ese día
  const sugerirConductor = () => {
    let maxDeuda = -1;
    let sugerido = pasajerosDia[0];

    pasajerosDia.forEach((p) => {
      let deudaTotal = 0;
      pasajerosDia.forEach((otro) => {
        if (p === otro) return;
        const clave = [p, otro].sort().join("|");
        const info = deudas[clave];
        if (info) {
          deudaTotal += info.deudor === p ? info.cantidad : 0;
        }
      });
      if (deudaTotal > maxDeuda) {
        maxDeuda = deudaTotal;
        sugerido = p;
      }
    });

    setConductorSugerido(sugerido);
    setConductorSeleccionado(sugerido);
  };

  // Aplica el viaje y actualiza deudas
  const confirmarViaje = () => {
    const nuevoHistorial = [
      { conductor: conductorSeleccionado, pasajeros: [...pasajerosDia] },
      ...historial,
    ].slice(0, 20); // Guardar últimos 20 viajes
    setHistorial(nuevoHistorial);

    let nuevasDeudas = { ...deudas };

    pasajerosDia.forEach((p) => {
      if (p === conductorSeleccionado) return;

      const clave = [p, conductorSeleccionado].sort().join("|");
      const actual = nuevasDeudas[clave];

      if (!actual) {
        // No hay deuda previa
        nuevasDeudas[clave] = { deudor: p, cantidad: 1 };
      } else if (actual.deudor === p) {
        // Deuda del pasajero al conductor → se cancela
        if (actual.cantidad === 1) delete nuevasDeudas[clave];
        else nuevasDeudas[clave] = { ...actual, cantidad: actual.cantidad - 1 };
      } else {
        // Conductor le debía al pasajero → se acumula
        nuevasDeudas[clave] = { deudor: conductorSeleccionado, cantidad: actual.cantidad + 1 };
      }
    });

    setDeudas(nuevasDeudas);
    setConductorSugerido(null);
    setConductorSeleccionado(null);
    alert("Viaje confirmado y deudas actualizadas ✅");
  };

  return (
    <div className="App">
      <h1>App de Gestión de Viajes</h1>

      <h2>Participantes habituales</h2>
      <ul>
        {participantes.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>

      <h2>Pasajeros de hoy</h2>
      {participantes.map((p, i) => (
        <label key={i}>
          <input
            type="checkbox"
            checked={pasajerosDia.includes(p)}
            onChange={(e) => {
              if (e.target.checked) setPasajerosDia([...pasajerosDia, p]);
              else setPasajerosDia(pasajerosDia.filter((x) => x !== p));
            }}
          />
          {p}
        </label>
      ))}

      <div style={{ marginTop: "20px" }}>
        <button onClick={sugerirConductor}>Sugerir conductor</button>
      </div>

      {conductorSugerido && (
        <div>
          <h2>Sugerencia de conductor: {conductorSugerido}</h2>
          <h3>Deudas del sugerido con pasajeros de hoy:</h3>
          <ul>
            {pasajerosDia.map((p, i) => {
              if (p === conductorSugerido) return null;
              const clave = [p, conductorSugerido].sort().join("|");
              const info = deudas[clave];
              if (!info) return <li key={i}>{p}: 0</li>;
              return (
                <li key={i}>
                  {info.deudor === conductorSugerido
                    ? `${conductorSugerido} le debe ${info.cantidad} a ${p}`
                    : `${p} le debe ${info.cantidad} a ${conductorSugerido}`}
                </li>
              );
            })}
          </ul>
          <label>
            Seleccionar conductor manualmente:
            <select
              value={conductorSeleccionado}
              onChange={(e) => setConductorSeleccionado(e.target.value)}
            >
              {pasajerosDia.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div style={{ marginTop: "20px" }}>
            <button onClick={confirmarViaje}>Confirmar viaje</button>
          </div>
        </div>
      )}

      <h2>Deudas generales</h2>
      <ul>
        {Object.entries(deudas).map(([clave, info]) => (
          <li key={clave}>
            {info.deudor} debe {info.cantidad} a{" "}
            {clave.split("|").filter((x) => x !== info.deudor)[0]}
          </li>
        ))}
      </ul>

      <h2>Historial últimos 20 viajes</h2>
      <ul>
        {historial.map((v, i) => (
          <li key={i}>
            {v.conductor} llevó a {v.pasajeros.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
