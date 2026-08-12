# Weather Station Core Card

Version 0.4.2

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

Import [`node-red/weather-station-core-insights.json`](node-red/weather-station-core-insights.json) into Node-RED and connect the **Raw weather values** link-in node to your individual sensor updates. Values may arrive one at a time; the flow merges them into context and recalculates after each update.

Use either `msg.topic` as the key with the value in `msg.payload`, or send `{ key: 'temperature', value: 12.3 }`. There is no `rain_likelihood` entity in the Weather Station Core list; rain outlook uses `rain_next_60_min`, `nowcast_intensity`, and `nowcast_confidence`.

Recommended inject topics:

| Topic | Value |
|---|---|
| `temperature` | Current temperature |
| `humidity` | Relative humidity |
| `dew_point` | Dew point |
| `heating_degree_day` | Current-day HDD |
| `temperature_anomaly_30_day` | Temperature anomaly |
| `rain_next_60_min` | Rain expected in next 60 minutes |
| `nowcast_intensity` | Current nowcast intensity/state |
| `nowcast_confidence` | Nowcast confidence |
| `data_quality_score` | Station data quality |
| `wind` | Instantaneous wind speed, for wind chill |
| `wind_average` | Average wind speed, for drying conditions |
| `wind_gust` | Gust speed, for exposure context |

For wind chill use `wind`; for drying-window logic use `wind_average`. `wind_gust` is retained as supporting context. The flow uses `rain_next_60_min` instead of a separate rain-likelihood sensor.

The flow derives the seven insight states, publishes MQTT discovery and retained state messages, and groups all entities under one Weather Station Core device. It also subscribes to `homeassistant/status`; when the payload is `online`, it republishes the cached discovery and state messages so entities return after a Home Assistant restart.

The card is intentionally content-only, so you can place your own heading outside it. Insight panels automatically flow into as many columns as the card width allows.

In the Home Assistant Sections layout, the card defaults to 6 of 12 columns and supports resizing from 3 to 12 columns.

If Home Assistant still shows an older card after updating, reload the dashboard resources or add a version query to the resource URL, for example `weather-card.js?v=0.4.1`.
