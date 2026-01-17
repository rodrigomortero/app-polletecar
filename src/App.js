import React, { useState, useMemo } from "react";
import "./App.css";

const initialParticipants = ["Ana", "Luis", "Pedro", "Marta"];

export default function App() {
  const [participants, setParticipants] = useState(initialParticipants);
  const [todayPassengers, setTodayPassengers] = useState([]);
  const [debts, setDebts] = useState({}); // { from: { to: number } }
  const [manualDriver, setManualDriver] = useState(null);

  // ---- helpers ----
  const getDebt = (from, to) => debts?.[from]?.[to] || 0;

  const addDebt = (from, to, amount = 1) => {
    setDebts((prev) => ({
      ...prev,
      [from]: {
        ...prev[from],
        [to]: (prev[from]?.[to] || 0) + amount,
      },
    }));
  };

  const settleDebt = (a, b) => {
    const ab = getDebt(a, b);
    const ba = getDebt(b, a);
    const diff = ab - ba;

    if (diff > 0) {
      addDebt(a, b, -ba);
      addDebt(b, a, 0);
    } else if (diff < 0) {
      addDebt(b, a, -ab);
      addDebt(a, b, 0);
    }
  };

  // ---- suggestion logic ----
  const suggestion = useMemo(() => {
    if (todayPassengers.length < 2) return null;

    let maxDebt = -1;
    let candidate = null;

    todayPassengers.forEach((p) => {
      let debtSum = 0;
      todayPassengers.forEach((other) => {
        if (p !== other) {
          debtSum += getDebt(p, other);
        }
      });
      if (debtSum > maxDebt) {
        maxDebt = debtSum;
        candidate = p;
      }
    });

    return candidate;
  }, [todayPassengers, debts]);

  const finalDriver = manualDriver || suggestion;

  // ---- confirm trip ----
  const confirmTrip = () => {
    if (!finalDriver) return;

    todayPassengers.forEach((p) => {
      if (p !== finalDriver) {
        addDebt(p, finalDriver, 1);
        settleDebt(p, finalDriver);
      }
    });

    setTodayPassengers([]);
    setManualDriver(null);
  };

  // ---- UI helpers ----
  const togglePassenger = (name) => {
    setTodayPassengers((prev) =>
      prev.includes(name)
        ? prev.filter((p) => p !== name)
        : [...prev, name]
    );
  };

  return (
    <div className="app">
      <h1>🚗 PolleteCar</h1>

      {/* PARTICIPANTS */}
      <section className="card">
        <h2>Participantes habituales</h2>
        <div className="chips">
          {participants.map((p) => (
            <button
              key={p}
              className={todayPassengers.includes(p) ? "chip active" : "chip"}
              onClick={() => togglePassenger(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="hint">Selecciona quién va hoy en el coche</p>
      </section>

      {/* SUGGESTION */}
      {todayPassengers.length >= 2 && (
        <section className="card">
          <h2>Sugerencia de posible conductor</h2>

          <div className="suggestion">
            {suggestion || "—"}
          </div>

          {suggestion && (
            <div className="debts-box">
              <strong>Deudas de {suggestion} con los pasajeros de hoy:</strong>
              <ul>
                {todayPassengers
                  .filter((p) => p !== suggestion)
                  .map((p) => (
                    <li key={p}>
                      {suggestion} debe {getDebt(suggestion, p)} a {p}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="manual">
            <label>Modificar conductor:</label>
            <select
              value={finalDriver || ""}
              onChange={(e) => setManualDriver(e.target.value)}
            >
              <option value="">(usar sugerencia)</option>
              {todayPassengers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button className="confirm" onClick={confirmTrip}>
            Confirmar viaje
          </button>
        </section>
      )}

      {/* DEBTS TABLE */}
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
                  <tr key={`${from}-${to}`}>
                    <td>{from}</td>
                    <td>{to}</td>
                    <td>{v}</td>
                  </tr>
                ))
            )}
            {Object.keys(debts).length === 0 && (
              <tr>
                <td colSpan="3">Sin deudas</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
