---

name: myaccident-newrelic-to-opentelemetry
description: Migrate MyAccident Express, Fastify, and Next.js TypeScript services from New Relic to vendor-neutral OpenTelemetry with SigNoz Cloud. Use for repository audits, instrumentation, SigNoz Cloud configuration, collector deployment, dashboards, alerts, staged cutovers, and safe New Relic removal.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# MyAccident: New Relic to OpenTelemetry and SigNoz Cloud

Migrate one repository at a time while preserving production visibility.

Use upstream OpenTelemetry APIs and SDKs in application code. Export telemetry using OTLP to an OpenTelemetry Collector whenever practical, then forward it to SigNoz Cloud.

Do not replace New Relic with SigNoz-specific application instrumentation. The application must remain portable to any OTLP-compatible backend.

## Target architecture

Prefer:

```text
Express, Fastify, or Next.js
        |
        | OTLP
        v
OpenTelemetry Collector
        |
        | OTLP over authenticated TLS
        v
SigNoz Cloud
```

For Cloud Run, use either:

* An OpenTelemetry Collector sidecar when supported by the deployment pattern.
* A regional collector gateway running on GKE or another managed service.
* Direct OTLP export to SigNoz Cloud only when operating a collector is not practical.

For GKE, normally use:

```text
Application pods
    -> node or sidecar collectors
    -> collector gateway
    -> SigNoz Cloud
```

Base the final topology on the repository’s actual deployment configuration.

## Required outcome

The completed migration must provide:

* Distributed traces for inbound requests and downstream dependencies.
* Application and runtime metrics.
* Structured logs correlated with traces using trace and span IDs.
* Stable service names, versions, and environment attributes.
* SigNoz dashboards and alerts replacing required New Relic dashboards and alerts.
* An inventory of New Relic synthetics, SLOs, custom events, metrics, and browser monitoring.
* Protection against exporting MyAccident customer or accident-related sensitive data.
* A staged dual-reporting period before New Relic is removed.
* A documented rollback path.
* Vendor-neutral application instrumentation.

Do not remove New Relic until the user explicitly authorizes removal after telemetry and alert parity have been verified.

## Start by inspecting the repository

Before editing code, inspect:

* `package.json` and the lockfile.
* Workspace and monorepo configuration.
* Node.js and TypeScript versions.
* Express, Fastify, or Next.js versions.
* ESM versus CommonJS configuration.
* Application and server entrypoints.
* Build, development, test, and production-start commands.
* Dockerfiles and container entrypoints.
* Cloud Run, Kubernetes, Helm, Terraform, and deployment files.
* Existing logger and logging transports.
* Database, Redis, queue, and outbound HTTP clients.
* Tests and test bootstrap files.
* Every New Relic dependency and configuration reference.

Search source code, CI, configuration, and deployment files for:

```text
newrelic
NEW_RELIC_
newrelic.js
newrelic.cjs
newrelic.mjs
NODE_OPTIONS
-r newrelic
--require newrelic
noticeError
startSegment
startWebTransaction
startBackgroundTransaction
addCustomAttribute
recordCustomEvent
recordMetric
```

Also identify:

* New Relic infrastructure or Kubernetes agents.
* New Relic log forwarding and enrichment.
* Browser/RUM scripts.
* Source-map upload jobs.
* NRQL alerts and dashboards.
* Synthetic and uptime monitors.
* Workloads or cron jobs monitored outside the application repository.

## Report before implementation

Before changing files, provide:

1. The framework, Node version, module system, and deployment topology.
2. The current New Relic integration points.
3. The proposed OpenTelemetry and SigNoz signal flow.
4. The files expected to change.
5. Open questions involving sampling, retention, PII, credentials, or infrastructure.
6. A staged rollout and rollback plan.

If the user requested only a review or plan, stop after producing the report.

## New Relic capability mapping

| New Relic capability | OpenTelemetry/SigNoz replacement         |
| -------------------- | ---------------------------------------- |
| APM transaction      | Server or consumer span                  |
| Custom segment       | Manual OTel span                         |
| Custom attribute     | Span attribute after privacy review      |
| `noticeError()`      | Record exception and set error status    |
| Custom metric        | OTel counter, histogram, or gauge        |
| Custom event         | Structured log, span event, or metric    |
| Distributed tracing  | W3C Trace Context through OTel           |
| Log enrichment       | Trace and span IDs in structured logs    |
| NRQL dashboard       | SigNoz dashboard                         |
| NRQL alert           | SigNoz alert                             |
| New Relic SLO        | SigNoz SLO or equivalent alert/dashboard |
| Synthetic monitor    | SigNoz synthetic or uptime monitoring    |
| Infrastructure agent | OTel Collector host/Kubernetes receivers |
| Browser agent        | Separate browser/RUM migration           |

Browser monitoring is a separate workstream. Successful server instrumentation does not automatically replace New Relic Browser.

# Configure SigNoz Cloud

## Create or select the SigNoz Cloud organization

Use the existing MyAccident SigNoz Cloud organization when one exists. Otherwise, ask the user to create or authorize creation of an organization.

Do not create external accounts, organizations, projects, API keys, dashboards, or alerts without authorization.

Use the SigNoz Cloud region selected by MyAccident’s compliance and data-residency requirements. Do not guess the ingestion endpoint.

From the SigNoz Cloud ingestion settings, obtain:

* The regional OTLP endpoint.
* The ingestion key.
* Supported OTLP protocols and ports.
* The organization or workspace details.
* Retention and usage limits.

Store the ingestion key in the deployment secret manager. Never commit it, print it in logs, place it in Docker images, or expose it through browser environment variables.

SigNoz commonly authenticates OTLP requests using a `signoz-ingestion-key` header. Confirm the current header name and endpoint in the official SigNoz Cloud ingestion instructions before configuring production.

## Standard environment configuration

Prefer standard OpenTelemetry environment variables:

```bash
OTEL_SERVICE_NAME=myaccident-service-name
OTEL_EXPORTER_OTLP_ENDPOINT=https://SIGNOZ_REGION_ENDPOINT
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=SECRET_VALUE
OTEL_RESOURCE_ATTRIBUTES=service.version=RELEASE_VERSION,deployment.environment.name=production
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0
```

These values are examples. Determine the actual protocol, endpoint, environment name, service name, and sampling ratio from the deployment.

Do not put real secrets in checked-in `.env` files.

For Next.js, never use `NEXT_PUBLIC_*` for collector endpoints containing credentials or for ingestion keys.

## Collector configuration

When using an OpenTelemetry Collector, create a configuration shaped like this:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  batch:
    timeout: 5s
    send_batch_size: 1024

  resource:
    attributes:
      - key: deployment.environment.name
        action: upsert
        value: "${env:DEPLOYMENT_ENVIRONMENT}"

  attributes/redaction:
    actions:
      - key: http.request.header.authorization
        action: delete
      - key: http.request.header.cookie
        action: delete
      - key: http.response.header.set-cookie
        action: delete
      - key: url.query
        action: delete

  queued_retry:
    num_workers: 4
    queue_size: 10000
    retry_on_failure: true

exporters:
  otlp/signoz:
    endpoint: "${env:SIGNOZ_OTLP_ENDPOINT}"
    headers:
      signoz-ingestion-key: "${env:SIGNOZ_INGESTION_KEY}"
    tls:
      insecure: false

service:
  pipelines:
    traces:
      receivers:
        - otlp
      processors:
        - memory_limiter
        - attributes/redaction
        - batch
      exporters:
        - otlp/signoz

    metrics:
      receivers:
        - otlp
      processors:
        - memory_limiter
        - batch
      exporters:
        - otlp/signoz

    logs:
      receivers:
        - otlp
      processors:
        - memory_limiter
        - attributes/redaction
        - batch
      exporters:
        - otlp/signoz
```

Verify all collector component names and configuration fields against the installed collector version. Some collector releases implement retry and queuing inside the exporter rather than through a separate processor.

Use the OpenTelemetry Collector Contrib distribution when required receivers, processors, or exporters are not available in the core distribution.

The collector must:

* Use TLS when sending data to SigNoz Cloud.
* Obtain the ingestion key from the runtime secret system.
* Use bounded queues and memory.
* Batch outgoing telemetry.
* Retry transient failures without retrying indefinitely.
* Expose its own health and export-failure metrics.
* Drop or redact prohibited attributes.
* Remain independently deployable from application code.

An observability outage must not take down the application.

## Verify the SigNoz connection

Before application rollout:

1. Start the collector with debug logging in a non-production environment.
2. Send a test trace, metric, and log.
3. Confirm all three signals appear in SigNoz.
4. Confirm the correct service name, version, and environment.
5. Confirm logs link to traces.
6. Confirm timestamps and durations are correct.
7. Confirm no ingestion-key or customer data appears in logs.
8. Confirm exporter failures are visible.
9. Confirm the collector recovers after a temporary SigNoz connection failure.

# Implement the Node.js OpenTelemetry bootstrap

Use current, mutually compatible upstream packages from the `@opentelemetry` organization.

Typical responsibilities include:

* The OpenTelemetry API.
* Node SDK initialization.
* Resource configuration and detection.
* OTLP trace, metric, and log exporters.
* HTTP and framework instrumentation.
* Database, Redis, and queue instrumentation where supported.
* Batch span, metric, and log processing.

Verify exact packages and APIs against current official OpenTelemetry documentation and the repository’s Node version. Do not copy obsolete examples blindly.

The telemetry bootstrap must:

* Run before Express, Fastify, Next.js server code, HTTP clients, database clients, and Redis clients are loaded.
* Set stable resource attributes.
* Register only instrumentations needed by the service.
* Read exporter configuration from the environment.
* Apply attribute filtering and redaction.
* Use bounded batch processors and export timeouts.
* Flush on the service’s actual shutdown lifecycle.
* Fail safely when telemetry cannot be exported.
* Avoid unhandled promise rejections during shutdown.

Application business logic should import `@opentelemetry/api`, not SDK construction packages.

## Resource attributes

Use:

* `service.name`: stable logical service name.
* `service.version`: deployed release, image tag, or commit SHA.
* `deployment.environment.name`: development, staging, or production.
* `service.namespace`: `myaccident` when useful.
* Cloud and Kubernetes resource attributes detected at runtime.

Do not use pod names, Cloud Run revision instance IDs, or hostnames as `service.name`.

Maintain a documented service-name registry so the same service is not reported under multiple names.

# Express guidance

For Express repositories:

* Confirm the true process entrypoint and whether tests import `app` without opening a listener.
* Load OpenTelemetry before Express and instrumented dependencies.
* Prefer current official HTTP and Express instrumentation.
* Name spans from matched route templates, not raw paths or record IDs.
* Preserve existing middleware and error-handler behavior.
* Record an exception once.
* Preserve context across promises, callbacks, queues, and event emitters.
* Exclude health, readiness, and static-asset traffic only when approved.
* Avoid wrapping automatically instrumented routes in redundant manual spans.

If the repository separates `app` from `listen`, prefer a dedicated process bootstrap or preload entrypoint rather than initializing the SDK inside the reusable app module.

Test:

* Parameterized routes.
* Successful responses.
* 4xx and 5xx
