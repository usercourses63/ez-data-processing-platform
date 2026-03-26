#!/usr/bin/env bash
# OCP restricted-v2 SCC Compliance Verifier
# Verifies running pods in ez-platform namespace against OCP restricted-v2 requirements.
# Usage: bash scripts/verify-ocp-compliance.sh [--help] [--json] [namespace]
# Default namespace: ez-platform

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────
NAMESPACE="${NAMESPACE:-ez-platform}"
JSON_OUTPUT=false
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# JSON results accumulator
JSON_RESULTS="[]"

# ─── Argument Parsing ──────────────────────────────────────────────────────────
show_help() {
    cat <<'HELP'
OCP restricted-v2 SCC Compliance Verifier

Usage:
    bash scripts/verify-ocp-compliance.sh [OPTIONS] [NAMESPACE]

Options:
    --help      Show this help message
    --json      Output results as JSON (for CI integration)

Arguments:
    NAMESPACE   Kubernetes namespace to check (default: ez-platform)

Checks performed (7 total):
    1. Security Contexts  - runAsNonRoot, runAsUser, seccompProfile, allowPrivilegeEscalation, capabilities
    2. Volume Types       - Only configMap, downwardAPI, emptyDir, PVC, projected, secret allowed
    3. Container Ports    - All ports must be > 1024
    4. Image Tags         - No :latest tags allowed
    5. Image Pull Policy  - Must be IfNotPresent (not Always)
    6. Network Policies   - default-deny-ingress must exist
    7. Dockerfiles        - All service Dockerfiles must have USER directive

Exit codes:
    0  All checks passed (warnings are OK)
    1  One or more checks failed

Examples:
    bash scripts/verify-ocp-compliance.sh
    bash scripts/verify-ocp-compliance.sh --json
    bash scripts/verify-ocp-compliance.sh --json my-namespace
HELP
    exit 0
}

for arg in "$@"; do
    case "$arg" in
        --help|-h)
            show_help
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        -*)
            echo "Unknown option: $arg"
            show_help
            ;;
        *)
            NAMESPACE="$arg"
            shift
            ;;
    esac
done

# ─── Utility Functions ─────────────────────────────────────────────────────────
log_pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "  ${GREEN}[PASS]${NC} $1"
    fi
    json_add_result "PASS" "$1" "${2:-}"
}

log_fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "  ${RED}[FAIL]${NC} $1"
    fi
    json_add_result "FAIL" "$1" "${2:-}"
}

log_warn() {
    WARN_COUNT=$((WARN_COUNT + 1))
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "  ${YELLOW}[WARN]${NC} $1"
    fi
    json_add_result "WARN" "$1" "${2:-}"
}

log_skip() {
    SKIP_COUNT=$((SKIP_COUNT + 1))
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "  ${CYAN}[SKIP]${NC} $1"
    fi
    json_add_result "SKIP" "$1" "${2:-}"
}

log_header() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo -e "${BOLD}[CHECK $1/$2] $3${NC}"
    fi
}

json_add_result() {
    local status="$1"
    local message="$2"
    local check="${3:-unknown}"
    # Escape double quotes in message
    message="${message//\"/\\\"}"
    JSON_RESULTS=$(echo "$JSON_RESULTS" | sed "s/\]$/,{\"status\":\"$status\",\"message\":\"$message\",\"check\":\"$check\"}]/")
    # Fix leading comma on first entry
    JSON_RESULTS="${JSON_RESULTS/\[,/\[}"
}

# ─── Prerequisites Check ──────────────────────────────────────────────────────
check_prerequisites() {
    if ! command -v kubectl &> /dev/null; then
        echo "ERROR: kubectl is not installed or not in PATH"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "WARNING: jq is not installed. Falling back to kubectl jsonpath (limited output)."
        HAS_JQ=false
    else
        HAS_JQ=true
    fi

    # Verify namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        echo "ERROR: Namespace '$NAMESPACE' does not exist"
        exit 1
    fi

    # Get pods JSON once (reused by all checks)
    PODS_JSON=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null)
    POD_COUNT=$(echo "$PODS_JSON" | jq '.items | length' 2>/dev/null || echo "0")

    if [ "$POD_COUNT" -eq 0 ]; then
        echo "ERROR: No pods found in namespace '$NAMESPACE'"
        exit 1
    fi
}

# ─── Check 1: Security Contexts (REQ-1, REQ-2, REQ-3, REQ-4, REQ-7) ──────────
check_security_contexts() {
    log_header 1 7 "Security Contexts"
    local check_name="security_contexts"

    local pod_names
    pod_names=$(echo "$PODS_JSON" | jq -r '.items[].metadata.name')

    while IFS= read -r pod; do
        [ -z "$pod" ] && continue

        # Skip fluent-bit pods (known hostPath exception, requires custom SCC on OCP)
        if [[ "$pod" == *fluent-bit* ]]; then
            log_skip "pod/$pod: DaemonSet excluded (requires custom SCC on OCP)" "$check_name"
            continue
        fi

        local pod_json
        pod_json=$(echo "$PODS_JSON" | jq --arg name "$pod" '.items[] | select(.metadata.name == $name)')

        # Pod-level security context
        local run_as_non_root
        run_as_non_root=$(echo "$pod_json" | jq -r '.spec.securityContext.runAsNonRoot // "null"')
        local run_as_user
        run_as_user=$(echo "$pod_json" | jq -r '.spec.securityContext.runAsUser // "null"')
        local seccomp_type
        seccomp_type=$(echo "$pod_json" | jq -r '.spec.securityContext.seccompProfile.type // "null"')

        # REQ-7: runAsNonRoot must be true
        if [ "$run_as_non_root" != "true" ]; then
            log_fail "pod/$pod: runAsNonRoot=$run_as_non_root (expected true)" "$check_name"
            continue
        fi

        # REQ-4: runAsUser must be > 0 (Minikube mode)
        if [ "$run_as_user" != "null" ] && [ "$run_as_user" -le 0 ] 2>/dev/null; then
            log_fail "pod/$pod: runAsUser=$run_as_user (must be > 0)" "$check_name"
            continue
        fi

        # REQ-3: seccompProfile must be RuntimeDefault or empty
        if [ "$seccomp_type" != "RuntimeDefault" ] && [ "$seccomp_type" != "null" ]; then
            log_fail "pod/$pod: seccompProfile.type=$seccomp_type (expected RuntimeDefault or empty)" "$check_name"
            continue
        fi

        # Container-level checks
        local container_names
        container_names=$(echo "$pod_json" | jq -r '.spec.containers[].name')
        local pod_passed=true

        while IFS= read -r container; do
            [ -z "$container" ] && continue

            local container_json
            container_json=$(echo "$pod_json" | jq --arg cname "$container" '.spec.containers[] | select(.name == $cname)')

            # REQ-1: allowPrivilegeEscalation must be false
            local allow_priv_esc
            allow_priv_esc=$(echo "$container_json" | jq -r '.securityContext.allowPrivilegeEscalation // "null"')
            if [ "$allow_priv_esc" != "false" ]; then
                log_fail "pod/$pod/$container: allowPrivilegeEscalation=$allow_priv_esc (expected false)" "$check_name"
                pod_passed=false
                continue
            fi

            # REQ-2: capabilities must drop ALL
            local drop_all
            drop_all=$(echo "$container_json" | jq -r '(.securityContext.capabilities.drop // []) | map(ascii_upcase) | if contains(["ALL"]) then "true" else "false" end')
            if [ "$drop_all" != "true" ]; then
                log_fail "pod/$pod/$container: capabilities.drop does not contain ALL" "$check_name"
                pod_passed=false
                continue
            fi
        done <<< "$container_names"

        if [ "$pod_passed" = true ]; then
            log_pass "pod/$pod: runAsNonRoot=true, runAsUser=$run_as_user, seccomp=$seccomp_type" "$check_name"
        fi
    done <<< "$pod_names"
}

# ─── Check 2: Volume Types (REQ-5) ────────────────────────────────────────────
check_volumes() {
    log_header 2 7 "Volume Types"
    local check_name="volumes"

    local allowed_types="configMap downwardAPI emptyDir persistentVolumeClaim projected secret"

    local pod_names
    pod_names=$(echo "$PODS_JSON" | jq -r '.items[].metadata.name')

    while IFS= read -r pod; do
        [ -z "$pod" ] && continue

        local pod_json
        pod_json=$(echo "$PODS_JSON" | jq --arg name "$pod" '.items[] | select(.metadata.name == $name)')

        # Get all volume types for this pod
        local volume_types
        volume_types=$(echo "$pod_json" | jq -r '
            .spec.volumes[]? |
            keys[] |
            select(. != "name")
        ' 2>/dev/null)

        if [ -z "$volume_types" ]; then
            log_pass "pod/$pod: No volumes defined" "$check_name"
            continue
        fi

        local pod_passed=true
        while IFS= read -r vtype; do
            [ -z "$vtype" ] && continue

            if ! echo "$allowed_types" | grep -qw "$vtype"; then
                # Warn (not fail) for fluent-bit with hostPath
                if [[ "$pod" == *fluent-bit* ]]; then
                    log_warn "pod/$pod: Uses $vtype volume (known exception for log collection)" "$check_name"
                else
                    log_fail "pod/$pod: Disallowed volume type '$vtype' (allowed: $allowed_types)" "$check_name"
                    pod_passed=false
                fi
            fi
        done <<< "$volume_types"

        if [ "$pod_passed" = true ]; then
            log_pass "pod/$pod: All volumes use allowed types" "$check_name"
        fi
    done <<< "$pod_names"
}

# ─── Check 3: Container Ports (REQ-6) ─────────────────────────────────────────
check_ports() {
    log_header 3 7 "Container Ports"
    local check_name="ports"

    local pod_names
    pod_names=$(echo "$PODS_JSON" | jq -r '.items[].metadata.name')

    while IFS= read -r pod; do
        [ -z "$pod" ] && continue

        local ports
        ports=$(echo "$PODS_JSON" | jq --arg name "$pod" '
            .items[] | select(.metadata.name == $name) |
            .spec.containers[].ports[]?.containerPort // empty
        ' 2>/dev/null)

        if [ -z "$ports" ]; then
            log_pass "pod/$pod: No ports defined" "$check_name"
            continue
        fi

        local pod_passed=true
        while IFS= read -r port; do
            [ -z "$port" ] && continue
            if [ "$port" -le 1024 ] 2>/dev/null; then
                log_fail "pod/$pod: Port $port is privileged (<= 1024)" "$check_name"
                pod_passed=false
            fi
        done <<< "$ports"

        if [ "$pod_passed" = true ]; then
            log_pass "pod/$pod: All ports > 1024 ($(echo "$ports" | tr '\n' ', ' | sed 's/,$//'))" "$check_name"
        fi
    done <<< "$pod_names"
}

# ─── Check 4: Image Tags ──────────────────────────────────────────────────────
check_image_tags() {
    log_header 4 7 "Image Tags"
    local check_name="image_tags"

    local images
    images=$(echo "$PODS_JSON" | jq -r '
        .items[] |
        .metadata.name as $pod |
        .spec.containers[] |
        "\($pod)\t\(.image)"
    ')

    while IFS=$'\t' read -r pod image; do
        [ -z "$pod" ] && continue

        local tag
        tag="${image##*:}"

        if [ "$tag" = "latest" ] || [ "$tag" = "$image" ]; then
            log_fail "pod/$pod: Image '$image' uses :latest or has no tag" "$check_name"
        else
            log_pass "pod/$pod: $image" "$check_name"
        fi
    done <<< "$images"
}

# ─── Check 5: Image Pull Policy ───────────────────────────────────────────────
check_image_pull_policy() {
    log_header 5 7 "Image Pull Policy"
    local check_name="image_pull_policy"

    local policies
    policies=$(echo "$PODS_JSON" | jq -r '
        .items[] |
        .metadata.name as $pod |
        .spec.containers[] |
        "\($pod)\t\(.name)\t\(.imagePullPolicy // "NotSet")\t\(.image)"
    ')

    while IFS=$'\t' read -r pod container policy image; do
        [ -z "$pod" ] && continue

        # Digest references (sha256:) are OK with Always
        if [[ "$image" == *"@sha256:"* ]]; then
            log_pass "pod/$pod/$container: Uses image digest (policy irrelevant)" "$check_name"
        elif [ "$policy" = "Always" ]; then
            log_fail "pod/$pod/$container: imagePullPolicy=Always (expected IfNotPresent)" "$check_name"
        elif [ "$policy" = "IfNotPresent" ] || [ "$policy" = "Never" ]; then
            log_pass "pod/$pod/$container: imagePullPolicy=$policy" "$check_name"
        else
            log_warn "pod/$pod/$container: imagePullPolicy=$policy (expected IfNotPresent)" "$check_name"
        fi
    done <<< "$policies"
}

# ─── Check 6: Network Policies ────────────────────────────────────────────────
check_network_policies() {
    log_header 6 7 "Network Policies"
    local check_name="network_policies"

    # Check default-deny-ingress exists
    if kubectl get networkpolicy default-deny-ingress -n "$NAMESPACE" &> /dev/null; then
        log_pass "default-deny-ingress NetworkPolicy exists" "$check_name"
    else
        log_fail "default-deny-ingress NetworkPolicy NOT found" "$check_name"
    fi

    # Count total network policies
    local np_count
    np_count=$(kubectl get networkpolicies -n "$NAMESPACE" -o json 2>/dev/null | jq '.items | length' 2>/dev/null || echo "0")

    if [ "$np_count" -ge 5 ]; then
        log_pass "Found $np_count NetworkPolicies (expected >= 5)" "$check_name"
    else
        log_warn "Found only $np_count NetworkPolicies (expected >= 5, recommend ~11)" "$check_name"
    fi
}

# ─── Check 7: Dockerfiles ─────────────────────────────────────────────────────
check_dockerfiles() {
    log_header 7 7 "Dockerfiles (USER directive)"
    local check_name="dockerfiles"

    # Check service Dockerfiles in src/Services/*/Dockerfile
    local service_dockerfiles
    service_dockerfiles=$(find src/Services -name "Dockerfile" -type f 2>/dev/null || true)

    if [ -z "$service_dockerfiles" ]; then
        log_warn "No Dockerfiles found in src/Services/" "$check_name"
    else
        while IFS= read -r dockerfile; do
            [ -z "$dockerfile" ] && continue

            if grep -q "^USER" "$dockerfile"; then
                local user_line
                user_line=$(grep "^USER" "$dockerfile" | head -1)
                log_pass "$dockerfile: $user_line" "$check_name"
            else
                log_fail "$dockerfile: Missing USER directive (image runs as root)" "$check_name"
            fi
        done <<< "$service_dockerfiles"
    fi

    # Check docker/*.Dockerfile
    local docker_dockerfiles
    docker_dockerfiles=$(find docker -name "*.Dockerfile" -type f 2>/dev/null || true)

    if [ -n "$docker_dockerfiles" ]; then
        while IFS= read -r dockerfile; do
            [ -z "$dockerfile" ] && continue

            if grep -q "^USER" "$dockerfile"; then
                local user_line
                user_line=$(grep "^USER" "$dockerfile" | head -1)
                log_pass "$dockerfile: $user_line" "$check_name"
            else
                log_fail "$dockerfile: Missing USER directive (image runs as root)" "$check_name"
            fi
        done <<< "$docker_dockerfiles"
    fi
}

# ─── Report ────────────────────────────────────────────────────────────────────
print_report() {
    local total=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT + SKIP_COUNT))
    local overall="PASS"
    if [ "$FAIL_COUNT" -gt 0 ]; then
        overall="FAIL"
    fi

    if [ "$JSON_OUTPUT" = true ]; then
        cat <<EOF
{
  "namespace": "$NAMESPACE",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "summary": {
    "total": $total,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT,
    "warnings": $WARN_COUNT,
    "skipped": $SKIP_COUNT,
    "overall": "$overall"
  },
  "results": $JSON_RESULTS
}
EOF
    else
        echo ""
        echo "========================================"
        echo -e "${BOLD}OCP Compliance Report - $NAMESPACE${NC}"
        echo "Date: $(date)"
        echo "========================================"
        echo ""
        echo -e "  ${GREEN}PASSED:${NC}   $PASS_COUNT"
        echo -e "  ${RED}FAILED:${NC}   $FAIL_COUNT"
        echo -e "  ${YELLOW}WARNINGS:${NC} $WARN_COUNT"
        echo -e "  ${CYAN}SKIPPED:${NC}  $SKIP_COUNT"
        echo ""
        if [ "$overall" = "PASS" ]; then
            echo -e "  Overall: ${GREEN}${BOLD}PASS${NC}"
        else
            echo -e "  Overall: ${RED}${BOLD}FAIL${NC}"
        fi
        echo "========================================"
    fi
}

# ─── Main ──────────────────────────────────────────────────────────────────────
main() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo "========================================"
        echo -e "${BOLD}OCP restricted-v2 SCC Compliance Verifier${NC}"
        echo "Namespace: $NAMESPACE"
        echo "Date: $(date)"
        echo "========================================"
    fi

    check_prerequisites

    if [ "$JSON_OUTPUT" = false ]; then
        echo "Found $POD_COUNT pods in namespace '$NAMESPACE'"
    fi

    check_security_contexts
    check_volumes
    check_ports
    check_image_tags
    check_image_pull_policy
    check_network_policies
    check_dockerfiles

    print_report

    if [ "$FAIL_COUNT" -gt 0 ]; then
        exit 1
    fi
    exit 0
}

main
