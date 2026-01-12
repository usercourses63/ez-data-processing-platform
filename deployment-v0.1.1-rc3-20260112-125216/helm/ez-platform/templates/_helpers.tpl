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
{{- printf "mongodb://mongodb-0.mongodb-service.%s.svc.cluster.local:27017,mongodb-1.mongodb-service.%s.svc.cluster.local:27017,mongodb-2.mongodb-service.%s.svc.cluster.local:27017/?replicaSet=rs0&directConnection=true" .Values.global.namespace .Values.global.namespace .Values.global.namespace }}
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
{{- if .Values.observability.otel.external.enabled }}
{{- .Values.observability.otel.external.endpoint }}
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
*/}}
{{- define "ez-platform.image" -}}
{{- $registry := .Values.global.imageRegistry | default "docker.io" }}
{{- $repository := .image.repository }}
{{- $tag := .image.tag | default .Chart.AppVersion }}
{{- if .image.registry }}
{{- printf "%s/%s:%s" .image.registry $repository $tag }}
{{- else }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- end }}
{{- end }}
