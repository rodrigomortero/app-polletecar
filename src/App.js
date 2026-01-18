import React, { useState } from "react";
import "./App.css";

export default function App() {
  // Lista de participantes inicial vacía
  const [participantes, setParticipantes] = useState([]);
  const [pasajerosDia, setPasajerosDia] = useState([]);
  const [deudas, setDeudas] = useState({});
  const [conductorSugerido, setConductorSugerido] = useState(null);
  const [conductorSeleccionado, setConductorSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [nuevoParticipante, setNuevoParticipante] = useState("");

  // Añadir participante
  const agregarParticipante = () => {
    if (nuevoParticipante && !participantes.includes(nuevoParticipante)) {
      setParticipantes([...participantes, nuevoParticipante]);
      setNuevoParticipante("");
    }
  };

  // Editar participante
  const editarParticipante = (viejo, nuevo) => {
    if (!nuevo) return;
    setParticipantes(
      participantes.map((p) => (p === viejo ? nuevo : p))
    );
    setPasajerosDia(
      pasajerosDia.map((p) => (p === viejo ? nuevo : p))
    );
  };

  // Eliminar participante
  const eliminarParticipante = (nombre) => {
    setParticipantes(participantes.filter((p) => p !== nombre));
    setPasajerosDia(pasajerosDia.filter((p) => p !== nombre));
    // Opcional: eliminar todas las deudas relacionadas
    let nuevasDeudas = { ...deudas };
    Object.keys(nuevasDeudas).forEach((clave) => {
      if (clave.includes(nombre)) delete nuevasDeudas[clave];
    });
    setDeudas(nuevasDeudas);
  };

  // Sugerir conductor según quién más debe a los pasajeros de hoy
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
        if (info) deudaTotal += info.deudor === p ? info.cantidad : 0;
      });
      if (deudaTotal > maxDeuda) {
        maxDeuda = deudaTotal;
        sugerido = p;
      }
    });
    setConductorSugerido(sugerido);
    setConductorSeleccionado(sugerido);
  };

  // Confirmar viaje
  const confirmarViaje = () => {
    if (!conductorSeleccionado) return alert("Selecciona un conductor");
    // Actualizar historial
    const nuevoHistorial = [
      { conductor: conductorSeleccionado, pasajeros: [...pasajerosDia] },
      ...historial,
    ].slice(0, 20);
    setHistorial(nuevoHistorial);

    // Actualizar deudas
    let nuevasDeudas = { ...deudas };
    pasajerosDia.forEach((p) => {
      if (p === conductorSeleccionado) return;
      const clave = [p, conductorSeleccionado].sort().join("|");
      const actual = nuevasDeudas[clave];

      if (!actual) {
        nuevasDeudas[clave] = { deudor: p, cantidad: 1 };
      } else if (actual.deudor === p) {
        // Cancela deuda si conductor devuelve viaje
        delete nuevasDeudas[clave];
      } else {
        // Conductor le debía a pasajero → se acumula
        nuevasDeudas[clave] = { deudor: conductorSeleccionado, cantidad: 1 };
      }
    });

    setDeudas(nuevasDeudas);
    setConductorSugerido(null);
    setConductorSeleccionado(null);
    alert("Viaje confirmado y deudas actualizadas ✅");
  };

  return (
    <div className="App">
      <h1>Gestión de viajes del coche</h1>

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
            <button
              onClick={() => {
                const nuevo = prompt("Nuevo nombre:", p);
                editarParticipante(p, nuevo);
              }}
            >
              Editar
            </button>{" "}
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
                setPasajerosDia(pasajerosDia.filter((x) => x !== p));
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
            {pasajerosDia.map((p) => {
              if (p === conductorSugerido) return null;
              const clave = [p, conductorSugerido].sort().join("|");
              const info = deudas[clave];
              if (!info) return <li key={p}>{p}: 0</li>;
              return (
                <li key={p}>
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
