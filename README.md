# Weather Station Core Card

Version 0.4.0

A dependency-free Home Assistant Lovelace card for MQTT-published Weather Station Core insight sensors. Calculations can live in Node-RED; the card only renders the selected sensor.

## HACS

Add this repository as a custom **Lovelace** repository in HACS, install it, and add the resource as a JavaScript module. With the HACS dashboard resource enabled, add:

```yaml
type: custom:ws-core-card
entity: sensor.weather_station_core_rain_outlook
```

Choose an insight sensor in the visual card editor, or configure it directly:

```yaml
type: custom:ws-core-card
entity: sensor.weather_station_core_frost_risk
title: Frost risk
show_confidence: true
```

Unavailable and unknown entities remain visible as **Unavailable**.

## Node-RED MQTT discovery

Import [`node-red/weather-station-core-insights.json`](node-red/weather-station-core-insights.json) into Node-RED and connect its link-in node to your existing correlation flow. Send a payload with these keys:

`heating_demand`, `rain_outlook`, `data_confidence`, `comfort`, `frost_risk`, `wind_chill`, and `drying_window`.

Each value can be an object such as `{ state: 'Rain likely soon', explanation: '82% likelihood in 60 minutes', severity: 'rain', confidence: 88 }`. The flow publishes MQTT discovery and retained state messages, grouping all entities under one Weather Station Core device.

The card is intentionally content-only, so you can place your own heading outside it. Insight panels automatically flow into as many columns as the card width allows.

In the Home Assistant Sections layout, the card defaults to 6 of 12 columns and supports resizing from 3 to 12 columns.

If Home Assistant still shows an older card after updating, reload the dashboard resources or add a version query to the resource URL, for example `weather-card.js?v=0.3.3`.
