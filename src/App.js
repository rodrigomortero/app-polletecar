import React, { useState, useMemo } from "react";
import "./App.css";

const PARTICIPANTS = ["Ana", "Luis", "Pedro", "Marta"];

export default function App() {
  const [passengersToday, setPassengersToday] = useState([]);
  const [debts, setDebts] = useState({});
  const [manualDriver, setManualDriver] = useState("");

  // ---- helpers ----
  const getDebt = (from, to) => debts?.[from]?.[to] || 0;

  const addDebt = (from, to) => {
    setDebts((prev) => {
      const newDebts = { ...prev };

      // inicializar
      if (!newDebts[from]) newDebts[from] = {};
      if (!newDebts[to]) newDebts[to] = {};

      // sumar deuda
      newDebts[from][to] = (newDebts[from][to] || 0) + 1;

      // cancelar si existe deuda contraria
      if (newDebts[to][from]) {
        const cancel = Math.min(newDebts[from][to], newDebts[to][from]);
        newDebts[from][to] -= cancel;
        newDebts[to][from] -= cancel;
      }

      return newDebts;
    });
  };

  // ---- suggestion logic ----
  const suggestedDriver = useMemo(() => {
    if (passengersToday.length < 2) return "";

    let maxDebt = -1;
    let candidate = "";

    passengersToday.forEach((p) => {
      let totalDebt = 0;
      passengersToday.forEach((other) => {
        if (p !== other) {
          totalDebt += getDebt(p, other);
        }
      });

      if (totalDebt > maxDebt) {
        maxDebt = totalDebt;
        candidate = p;
      }
    });

    return candidate;
  }, [passengersToday, debts]);

  const finalDriver = manualDriver || suggestedDriver;

  // ---- confirm trip ----
  const confirmTrip = () => {
    if (!finalDriver) return;

    passengersToday.forEach((p) => {
      if (p !== finalDriver) {
        addDebt(p, finalDriver);
      }
    });

    setPassengersToday([]);
    setManualDriver("");
  };

  // ---- UI ----
  const togglePassenger = (p) => {
    setPassengersToday((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  return (
    <div className="app">
      <h1>🚗 PolleteCar</h1>

      <section className="card">
        <h2>Participantes habituales</h2>
        <div className="chips">
          {PARTICIPANTS.map((p) => (
            <button
              key={p}
              className={passengersToday.includes(p) ? "chip active" : "chip"}
              onClick={() => togglePassenger(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="hint">Selecciona quién va hoy en el coche</p>
      </section>

      {passengersToday.length >= 2 && (
        <section className="card">
          <h2>Sugerencia de posible conductor</h2>

          <div className="suggestion">{suggestedDriver}</div>

          <div className="debts-box">
            <strong>Deudas con los pasajeros de hoy:</strong>
            <ul>
              {passengersToday
                .filter((p) => p !== suggestedDriver)
                .map((p) => (
                  <li key={p}>
                    {suggestedDriver} debe {getDebt(suggestedDriver, p)} a {p}
                  </li>
                ))}
            </ul>
          </div>

          <label>Cambiar conductor manualmente:</label>
          <select
            value={manualDriver}
            onChange={(e) => setManualDriver(e.target.value)}
          >
            <option value="">Usar sugerencia</option>
            {passengersToday.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <button className="confirm" onClick={confirmTrip}>
            Confirmar viaje
          </button>
        </section>
      )}

      <section className="card">
        <h2>📊 Deudas entre participantes</h2>
        <table>
          <thead>
            <tr>
              <th>Quién debe</th>
              <th>A quién</th>
              <th>Viajes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(debts).flatMap(([from, tos]) =>
              Object.entries(tos)
                .filter(([, v]) => v > 0)
                .map(([to, v]) => (
                  <tr key={from + to}>
                    <td>{from}</td>
                    <td>{to}</td>
                    <td>{v}</td>
                  </tr>
                ))
            )}
            {Object.keys(debts).length === 0 && (
              <tr><td colSpan="3">Sin deudas</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
