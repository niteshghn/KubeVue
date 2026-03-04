use kube::Client;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
pub struct ContainerMetrics {
    pub name: String,
    pub cpu_nano: u64,
    pub memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PodMetricsResult {
    pub containers: Vec<ContainerMetrics>,
    pub available: bool,
}

fn parse_cpu(val: &str) -> u64 {
    if let Some(n) = val.strip_suffix('n') {
        n.parse().unwrap_or(0)
    } else if let Some(u) = val.strip_suffix('u') {
        u.parse::<u64>().unwrap_or(0) * 1_000
    } else if let Some(m) = val.strip_suffix('m') {
        m.parse::<u64>().unwrap_or(0) * 1_000_000
    } else {
        // plain number = cores
        val.parse::<f64>().map(|v| (v * 1_000_000_000.0) as u64).unwrap_or(0)
    }
}

fn parse_memory(val: &str) -> u64 {
    if let Some(ki) = val.strip_suffix("Ki") {
        ki.parse::<u64>().unwrap_or(0) * 1024
    } else if let Some(mi) = val.strip_suffix("Mi") {
        mi.parse::<u64>().unwrap_or(0) * 1024 * 1024
    } else if let Some(gi) = val.strip_suffix("Gi") {
        gi.parse::<u64>().unwrap_or(0) * 1024 * 1024 * 1024
    } else if let Some(k) = val.strip_suffix('k') {
        k.parse::<u64>().unwrap_or(0) * 1000
    } else if let Some(m) = val.strip_suffix('M') {
        m.parse::<u64>().unwrap_or(0) * 1_000_000
    } else if let Some(g) = val.strip_suffix('G') {
        g.parse::<u64>().unwrap_or(0) * 1_000_000_000
    } else {
        val.parse().unwrap_or(0)
    }
}

fn parse_pod_metrics_json(json: &Value) -> PodMetricsResult {
    let containers = json.get("containers")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter().map(|c| {
                let name = c.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                let usage = c.get("usage").cloned().unwrap_or(Value::Null);
                let cpu_str = usage.get("cpu").and_then(|v| v.as_str()).unwrap_or("0");
                let mem_str = usage.get("memory").and_then(|v| v.as_str()).unwrap_or("0");
                ContainerMetrics {
                    name,
                    cpu_nano: parse_cpu(cpu_str),
                    memory_bytes: parse_memory(mem_str),
                }
            }).collect()
        })
        .unwrap_or_default();

    PodMetricsResult { containers, available: true }
}

pub async fn get_pod_metrics(
    client: Client,
    name: &str,
    namespace: &str,
) -> Result<PodMetricsResult, anyhow::Error> {
    let url = format!("/apis/metrics.k8s.io/v1beta1/namespaces/{}/pods/{}", namespace, name);
    let req = http::Request::builder()
        .uri(&url)
        .body(vec![])
        .map_err(|e| anyhow::anyhow!("Failed to build request: {}", e))?;

    match client.request::<Value>(req).await {
        Ok(json) => Ok(parse_pod_metrics_json(&json)),
        Err(e) => {
            let err_str = e.to_string();
            // 404 or NotFound = metrics-server not installed or pod not found
            if err_str.contains("404") || err_str.contains("NotFound") || err_str.contains("not found") {
                Ok(PodMetricsResult { containers: vec![], available: false })
            } else {
                Err(anyhow::anyhow!("Metrics error: {}", err_str))
            }
        }
    }
}

pub async fn get_all_pod_metrics(
    client: Client,
    namespace: &str,
) -> Result<std::collections::HashMap<String, PodMetricsResult>, anyhow::Error> {
    let url = if namespace == "_all" {
        "/apis/metrics.k8s.io/v1beta1/pods".to_string()
    } else {
        format!("/apis/metrics.k8s.io/v1beta1/namespaces/{}/pods", namespace)
    };

    let req = http::Request::builder()
        .uri(&url)
        .body(vec![])
        .map_err(|e| anyhow::anyhow!("Failed to build request: {}", e))?;

    match client.request::<Value>(req).await {
        Ok(json) => {
            let mut result = std::collections::HashMap::new();
            if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                for item in items {
                    let name = item.get("metadata")
                        .and_then(|m| m.get("name"))
                        .and_then(|n| n.as_str())
                        .unwrap_or("")
                        .to_string();
                    if !name.is_empty() {
                        result.insert(name, parse_pod_metrics_json(item));
                    }
                }
            }
            Ok(result)
        }
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("404") || err_str.contains("NotFound") || err_str.contains("not found") {
                Ok(std::collections::HashMap::new())
            } else {
                Err(anyhow::anyhow!("Metrics error: {}", err_str))
            }
        }
    }
}
