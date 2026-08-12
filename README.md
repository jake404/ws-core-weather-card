# Weather Station Core Card

A dependency-free Home Assistant Lovelace card for Weather Station Core. It combines the Weather Station Core weather entity with derived sensors for current conditions, heating degree days, forecast tiles, rain nowcast, alerts, and data quality.

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
```

Unavailable and unknown entities remain visible as **Unavailable**.
