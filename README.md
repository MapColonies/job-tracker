
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
## Docker

    # Build the Docker image
    docker build -t job-tracker .
    
    # Run the Docker container
    docker run -d -p 3000:3000 job-tracker

## Environment Variables

|Variable Name                       |Description                                                               |Default Value                |
|------------------------------------|--------------------------------------------------------------------------|-----------------------------|
|`SERVER_PORT`                       |Port on which the server listens for incoming requests.	                |8080                         |
|`REQUEST_PAYLOAD_LIMIT`             |Maximum payload limit for incoming requests.	                            |1mb                          |
|`RESPONSE_COMPRESSION_ENABLED`      |Enable or disable response compression (boolean).                         |true                         |
|`JOB_MANAGER_BASE_URL`              |Base URL of the Job-Manager service.	                                    |http://localhost:8081        |
|`HEARTBEAT_BASE_URL`                |Base URL for the heartbeat service.	                                    |http://localhost:8083        |
|`HEARTBEAT_INTERVAL_MS`             |Interval (in milliseconds) for heartbeat checks.                          |3000                         |
|`JOB_MANAGER_DEQUEUE_INTERVAL_MS`   |Job name.                                                                 |3000                         |
|`JOB_DEFINITIONS_JOB_NEW`           |Job name.                                                                 |Ingestion_New                |
|`JOB_DEFINITIONS_JOB_UPDATE`        |Job name.                                                                 |Ingestion_Update             |
|`JOB_DEFINITIONS_JOB_SWAP_UPDATE`   |Job name.                                                                 |Ingestion_Swap_Update        |
|`JOB_DEFINITIONS_TASK_INIT`         |Task name.                                                                |init                         |
|`JOB_DEFINITIONS_TASK_MERGE`        |Task name.                                                                |merge                        |
|`JOB_DEFINITIONS_TASK_POLYGON_PARTS`|Task name.                                                                |polygon-parts                |
|`JOB_DEFINITIONS_TASK_FINALIZE`     |Task name.                                                                |finalize                     |
|`HTTP_RETRY_ATTEMPTS`               |How many retries should the service make if a request fails.              |5                            |
|`HTTP_RETRY_DELAY`                  |The delay between each http retry if a request fails.                     |exponential                  |
|`HTTP_RETRY_RESET_TIMEOUT`          |Defines if the timeout should be reset between retries                    |true                         |
|`TELEMETRY_SERVICE_NAME`            |Name of the telemetry service.	                                        |(not set)                    |
|`TELEMETRY_HOST_NAME`               |Hostname for the telemetry service.                                       |(not set)                    |
|`TELEMETRY_SERVICE_VERSION`         |Version of the telemetry service.	                                        |(not set)                    |
|`LOG_LEVEL`                         |Logging level for the application (e.g., info, debug, warn, error, fatal).|info                         |
|`LOG_PRETTY_PRINT_ENABLED`          |Enable or disable pretty printing for logs (boolean).                     |false                        |
|`TELEMETRY_TRACING_ENABLED`         |Enable or disable tracing (boolean).	                                    |(not set)                    |
|`TELEMETRY_TRACING_URL`             |URL for the tracing service.	                                            |(not set)                    |
|`TELEMETRY_METRICS_ENABLED`         |Enable or disable metrics collection (boolean).	                        |(not set)                    |
|`TELEMETRY_METRICS_URL`             |URL for the metrics service.	                                            |(not set)                    |
|`TELEMETRY_METRICS_INTERVAL`        |Interval (in seconds) for sending metrics data.	                        |(not set)                    |

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
