# Weather Station Core Card

Version 0.3.3

A dependency-free Home Assistant Lovelace card for Weather Station Core. It combines current conditions with interpreted correlations for heating demand, rain likelihood and nowcast, plus data confidence.

## HACS

Add this repository as a custom **Lovelace** repository in HACS, install it, and add the resource as a JavaScript module. With the HACS dashboard resource enabled, add:

```yaml
type: custom:ws-core-card
weather_entity: weather.weather_station_core
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

The main card reads the usual `sensor.weather_station_core_` entities by default. Its seven insight panels use:

- **Heating demand:** `heating_degree_day`, `temperature_anomaly_30_day`, `temperature`, and `hdd_base`.
- **Rain likelihood and nowcast:** `rain_likelihood` (optional), `nowcast_intensity`, `rain_next_60_min`, and `nowcast_confidence`. Without a likelihood sensor, the card interprets the projected 60-minute rain amount.
- **Data confidence:** `data_quality_score` and `nowcast_confidence`, combined when both are present.
- **Comfort and condensation:** `humidity`, `dew_point`, and `temperature` identify muggy, dry, or condensation-prone conditions.
- **Frost risk:** temperature and dew point identify freezing or near-freezing exposure.
- **Wind-chill exposure:** temperature and `wind_speed` estimate outdoor feels-like conditions.
- **Drying window:** humidity, wind, and near-term rain estimate whether laundry or surfaces will dry quickly.

The card is intentionally content-only, so you can place your own heading outside it. Insight panels automatically flow into as many columns as the card width allows.

In the Home Assistant Sections layout, the card defaults to 6 of 12 columns and supports resizing from 3 to 12 columns. The insight grid flows responsively within that available width.

If Home Assistant still shows an older card after updating, reload the dashboard resources or add a version query to the resource URL, for example `weather-card.js?v=0.3.3`.
