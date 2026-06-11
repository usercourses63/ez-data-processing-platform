{{/*
Expand the name of the chart.
*/}}
{{- define "ez-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "ez-platform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "ez-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "ez-platform.labels" -}}
helm.sh/chart: {{ include "ez-platform.chart" . }}
{{ include "ez-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "ez-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ez-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service-specific labels
*/}}
{{- define "ez-platform.serviceLabels" -}}
app: {{ .serviceName }}
component: {{ .component | default "service" }}
{{ include "ez-platform.labels" . }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "ez-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "ez-platform.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
MongoDB connection string
*/}}
{{- define "ez-platform.mongodbConnectionString" -}}
{{- if .Values.mongodb.external.enabled }}
{{- .Values.mongodb.external.connectionString }}
{{- else }}
{{- /* Single seed host + replicaSet. The previous form combined directConnection=true with
       three hosts, which the MongoDB .NET driver rejects ("Direct connect cannot be used with
       multiple host names"). The RS is single-member (mongodb-0), so one seed is sufficient and
       replicaSet mode preserves transaction support. */ -}}
{{- printf "mongodb://mongodb-0.mongodb-service.%s.svc.cluster.local:27017/?replicaSet=rs0" .Values.global.namespace }}
{{- end }}
{{- end }}

{{/*
Kafka bootstrap servers
*/}}
{{- define "ez-platform.kafkaBootstrapServers" -}}
{{- if .Values.kafka.external.enabled }}
{{- .Values.kafka.external.bootstrapServers }}
{{- else }}
{{- printf "kafka-0.kafka-service.%s.svc.cluster.local:9092,kafka-1.kafka-service.%s.svc.cluster.local:9092,kafka-2.kafka-service.%s.svc.cluster.local:9092" .Values.global.namespace .Values.global.namespace .Values.global.namespace }}
{{- end }}
{{- end }}

{{/*
Hazelcast cluster members
*/}}
{{- define "ez-platform.hazelcastMembers" -}}
{{- if .Values.hazelcast.external.enabled }}
{{- .Values.hazelcast.external.members }}
{{- else }}
{{- printf "hazelcast-0.hazelcast-service.%s.svc.cluster.local:5701,hazelcast-1.hazelcast-service.%s.svc.cluster.local:5701,hazelcast-2.hazelcast-service.%s.svc.cluster.local:5701" .Values.global.namespace .Values.global.namespace .Values.global.namespace }}
{{- end }}
{{- end }}

{{/*
OTEL Collector endpoint
*/}}
{{- define "ez-platform.otelEndpoint" -}}
{{- if .Values.observability.otelCollector.external.enabled }}
{{- .Values.observability.otelCollector.external.endpoint }}
{{- else }}
{{- printf "http://otel-collector.%s.svc.cluster.local:4317" .Values.global.namespace }}
{{- end }}
{{- end }}

{{/*
Elasticsearch endpoint
*/}}
{{- define "ez-platform.elasticsearchEndpoint" -}}
{{- if .Values.observability.elasticsearch.external.enabled }}
{{- .Values.observability.elasticsearch.external.endpoint }}
{{- else }}
{{- printf "http://elasticsearch.%s.svc.cluster.local:9200" .Values.global.namespace }}
{{- end }}
{{- end }}

{{/*
Image pull policy
*/}}
{{- define "ez-platform.imagePullPolicy" -}}
{{- .Values.global.imagePullPolicy | default "IfNotPresent" }}
{{- end }}

{{/*
Generate full image name

Behavior:
  - Per-image .image.registry (when set, even to empty string via --set) takes precedence
    over the global registry. An explicitly empty per-image registry → bare <repo>:<tag>.
  - Otherwise fall back to .Values.global.imageRegistry. Empty global → bare <repo>:<tag>.
  - Non-empty resolved registry → "<registry>/<repo>:<tag>".

The previous implementation used `| default "docker.io"` on the global registry, which
silently re-substituted the default when an operator passed `--set global.imageRegistry=""`.
That broke locally-loaded minikube images (the rendered image string carried a `docker.io/`
prefix that did not match the bare tag in the minikube image store). This conditional form
honors an empty override end-to-end.
*/}}
{{- define "ez-platform.image" -}}
{{- $repository := .image.repository }}
{{- $tag := .image.tag | default .Chart.AppVersion }}
{{- if hasKey .image "registry" }}
{{- $perImageRegistry := .image.registry }}
{{- if $perImageRegistry }}
{{- printf "%s/%s:%s" $perImageRegistry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- else }}
{{- $registry := .Values.global.imageRegistry }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}
{{- end }}
