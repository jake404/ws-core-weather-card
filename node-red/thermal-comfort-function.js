// Add this block inside the existing derive function after the raw values
// have been read. It creates a separate thermal_comfort insight entity.
const thermalTemperature = Number(raw.temperature);
const thermalHumidity = Number(raw.humidity);
const thermalWind = Number(raw.wind);
const thermalComfort = {
    state: 'Unavailable',
    explanation: 'Waiting for temperature, wind, and humidity.',
    severity: 'normal'
};

if (
    Number.isFinite(thermalTemperature) &&
    Number.isFinite(thermalHumidity)
) {
    const windPenalty = Number.isFinite(thermalWind)
        ? Math.min(8, thermalWind * 0.12)
        : 0;
    const apparentTemperature = thermalTemperature - windPenalty;

    if (thermalHumidity >= 80 && apparentTemperature >= 24) {
        thermalComfort.state = 'Hot and muggy';
        thermalComfort.severity = 'warning';
    } else if (apparentTemperature <= 3) {
        thermalComfort.state = 'Cold and exposed';
        thermalComfort.severity = 'warning';
    } else if (thermalHumidity <= 35) {
        thermalComfort.state = 'Dry and cool';
    } else if (apparentTemperature >= 27) {
        thermalComfort.state = 'Warm';
    } else {
        thermalComfort.state = 'Comfortable outdoor conditions';
    }

    thermalComfort.explanation =
        `${apparentTemperature.toFixed(1)} apparent degrees; ` +
        `${thermalHumidity}% humidity` +
        (Number.isFinite(thermalWind)
            ? `; ${thermalWind.toFixed(1)} wind.`
            : '.');
}

insights.thermal_comfort = thermalComfort;
