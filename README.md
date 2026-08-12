# Weather Station Core Card

Version 0.3.0

A dependency-free Home Assistant Lovelace card for Weather Station Core. It combines current conditions with interpreted correlations for heating demand, rain likelihood and nowcast, plus data confidence.

## HACS

Add this repository as a custom **Lovelace** repository in HACS, install it, and add the resource as a JavaScript module. With the HACS dashboard resource enabled, add:

```yaml
type: custom:ws-core-card
weather_entity: weather.weather_station_core
```

Additional cards are available:

```yaml
type: custom:ws-core-extremes-card
```

```yaml
type: custom:ws-core-climate-card
```

```yaml
type: custom:ws-core-streaks-card
```

The card defaults to entities beginning with `sensor.weather_station_core_`. Override individual entities when needed:

```yaml
type: custom:ws-core-card
title: Heating & Weather
weather_entity: weather.my_tempest
ws_core_prefix: sensor.weather_station_core_
entities:
  temperature: sensor.my_tempest_temperature
  humidity: sensor.my_tempest_humidity
  rain_likelihood: sensor.my_weather_rain_likelihood
```

Unavailable and unknown entities remain visible as **Unavailable**.

## Main-card insights

The main card reads the usual `sensor.weather_station_core_` entities by default. Its three insight panels use:

- **Heating demand:** `heating_degree_day`, `temperature_anomaly_30_day`, `temperature`, and `hdd_base`.
- **Rain likelihood and nowcast:** `rain_likelihood` (optional), `nowcast_intensity`, `rain_next_60_min`, and `nowcast_confidence`. Without a likelihood sensor, the card interprets the projected 60-minute rain amount.
- **Data confidence:** `data_quality_score` and `nowcast_confidence`, combined when both are present.
