
# Job Tracker

A service that exposes a dedicated API for raster jobs and tasks state tracking.
Services notifies Job Tracker on completed tasks, and Job Tracker handles the rest; including creating subsequent tasks, updating the job percentage, and failing the job, if necessary.

## API
Checkout the OpenAPI spec [here](/openapi3.yaml)
## Run Locally

Clone the project

```bash
  git clone https://github.com/MapColonies/job-tracker.git
```

Go to the project directory

```bash
  cd job-tracker
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  npm run start
```


## Environment Variables

|Variable Name                       |Description                    |Default Value                |
|------------------------------------|-------------------------------|-----------------------------|
|`SERVER_PORT`                       |                               |8080                         |
|`REQUEST_PAYLOAD_LIMIT`             |                               |1mb                          |
|`RESPONSE_COMPRESSION_ENABLED`      |Boolean                        |true                         |
|`JOB_MANAGER_BASE_URL`              |                               |http://localhost:8081        |
|`HEARTBEAT_BASE_URL`                |                               |http://localhost:8083        |
|`HEARTBEAT_INTERVAL_MS`             |                               |3000                         |
|`JOB_MANAGER_DEQUEUE_INTERVAL_MS`   |                               |3000                         |
|`JOB_DEFINITIONS_JOB_NEW`           |                               |                             |
|`JOB_DEFINITIONS_JOB_UPDATE`        |                               |                             |
|`JOB_DEFINITIONS_JOB_SWAP_UPDATE`   |                               |                             |
|`JOB_DEFINITIONS_TASK_INIT`         |                               |                             |
|`JOB_DEFINITIONS_TASK_MERGE`        |                               |                             |
|`JOB_DEFINITIONS_TASK_POLYGON_PARTS`|                               |                             |
|`JOB_DEFINITIONS_TASK_FINALIZE`     |                               |                             |
|`HTTP_RETRY_ATTEMPTS`               |number                         |5                            |
|`HTTP_RETRY_DELAY`                  |                               |exponential                  |
|`HTTP_RETRY_RESET_TIMEOUT`          |boolean                        |true                         |
|`TELEMETRY_SERVICE_NAME`            |                               |(not set)                    |
|`TELEMETRY_HOST_NAME`               |                               |(not set)                    |
|`TELEMETRY_SERVICE_VERSION`         |                               |(not set)                    |
|`LOG_LEVEL`                         |                               |info                         |
|`LOG_PRETTY_PRINT_ENABLED`          |boolean                        |false                        |
|`TELEMETRY_TRACING_ENABLED`         |                               |(not set)                    |
|`TELEMETRY_TRACING_URL`             |                               |(not set)                    |
|`TELEMETRY_METRICS_ENABLED`         |                               |(not set)                    |
|`TELEMETRY_METRICS_URL`             |                               |(not set)                    |
|`TELEMETRY_METRICS_INTERVAL`        |                               |(not set)                    |

## Running Tests

To run tests, run the following command

```bash

npm run test

```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```