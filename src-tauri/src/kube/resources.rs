use kube::{Api, Client, api::ListParams};
use k8s_openapi::api::core::v1::{Pod, Service, ConfigMap, Secret, Event, PersistentVolumeClaim, Namespace};
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::networking::v1::Ingress;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
pub struct ResourceSummary {
    pub name: String,
    pub namespace: Option<String>,
    pub kind: String,
    pub status: String,
    pub age: String,
    pub labels: std::collections::BTreeMap<String, String>,
    pub raw: Value,
}

pub async fn list_resources(
    client: Client,
    kind: &str,
    namespace: &str,
) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let lp = ListParams::default();
    match kind {
        "pods" => list_pods(client, namespace, &lp).await,
        "deployments" => list_deployments(client, namespace, &lp).await,
        "services" => list_services(client, namespace, &lp).await,
        "configmaps" => list_configmaps(client, namespace, &lp).await,
        "secrets" => list_secrets(client, namespace, &lp).await,
        "ingresses" => list_ingresses(client, namespace, &lp).await,
        "pvcs" => list_pvcs(client, namespace, &lp).await,
        "events" => list_events(client, namespace, &lp).await,
        _ => Err(anyhow::anyhow!("Unknown resource kind: {}", kind)),
    }
}

fn api_for_namespace<K: kube::Resource<Scope = k8s_openapi::NamespaceResourceScope>>(
    client: Client,
    namespace: &str,
) -> Api<K>
where
    K: k8s_openapi::serde::de::DeserializeOwned + Clone + std::fmt::Debug,
    K: kube::Resource,
    <K as kube::Resource>::DynamicType: Default,
{
    if namespace == "_all" {
        Api::all(client)
    } else {
        Api::namespaced(client, namespace)
    }
}

fn calculate_age(creation: Option<&k8s_openapi::apimachinery::pkg::apis::meta::v1::Time>) -> String {
    let Some(created) = creation else { return "Unknown".to_string() };
    let now = chrono::Utc::now();
    let created_at = created.0;
    let duration = now.signed_duration_since(created_at);

    if duration.num_days() > 0 {
        format!("{}d", duration.num_days())
    } else if duration.num_hours() > 0 {
        format!("{}h", duration.num_hours())
    } else {
        format!("{}m", duration.num_minutes())
    }
}

async fn list_pods(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<Pod> = api_for_namespace(client, namespace);
    let pods = api.list(lp).await?;
    let summaries = pods.items.into_iter().map(|pod| {
        let status = pod.status.as_ref()
            .and_then(|s| s.phase.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        let meta = &pod.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "Pod".to_string(),
            status,
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&pod).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_deployments(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<Deployment> = api_for_namespace(client, namespace);
    let deps = api.list(lp).await?;
    let summaries = deps.items.into_iter().map(|dep| {
        let ready = dep.status.as_ref().and_then(|s| s.ready_replicas).unwrap_or(0);
        let desired = dep.spec.as_ref().and_then(|s| s.replicas).unwrap_or(0);
        let status = format!("{}/{}", ready, desired);
        let meta = &dep.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "Deployment".to_string(),
            status,
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&dep).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_services(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<Service> = api_for_namespace(client, namespace);
    let svcs = api.list(lp).await?;
    let summaries = svcs.items.into_iter().map(|svc| {
        let svc_type = svc.spec.as_ref().and_then(|s| s.type_.clone()).unwrap_or_else(|| "ClusterIP".to_string());
        let meta = &svc.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "Service".to_string(),
            status: svc_type,
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&svc).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_configmaps(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<ConfigMap> = api_for_namespace(client, namespace);
    let cms = api.list(lp).await?;
    let summaries = cms.items.into_iter().map(|cm| {
        let data_count = cm.data.as_ref().map(|d| d.len()).unwrap_or(0);
        let meta = &cm.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "ConfigMap".to_string(),
            status: format!("{} keys", data_count),
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&cm).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_secrets(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<Secret> = api_for_namespace(client, namespace);
    let secrets = api.list(lp).await?;
    let summaries = secrets.items.into_iter().map(|secret| {
        let secret_type = secret.type_.clone().unwrap_or_else(|| "Opaque".to_string());
        let meta = &secret.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "Secret".to_string(),
            status: secret_type,
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&secret).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_ingresses(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<Ingress> = api_for_namespace(client, namespace);
    let ings = api.list(lp).await?;
    let summaries = ings.items.into_iter().map(|ing| {
        let hosts: Vec<String> = ing.spec.as_ref()
            .and_then(|s| s.rules.as_ref())
            .map(|rules| rules.iter().filter_map(|r| r.host.clone()).collect())
            .unwrap_or_default();
        let meta = &ing.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "Ingress".to_string(),
            status: hosts.join(", "),
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&ing).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_pvcs(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<PersistentVolumeClaim> = api_for_namespace(client, namespace);
    let pvcs = api.list(lp).await?;
    let summaries = pvcs.items.into_iter().map(|pvc| {
        let phase = pvc.status.as_ref().and_then(|s| s.phase.clone()).unwrap_or_else(|| "Unknown".to_string());
        let meta = &pvc.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "PVC".to_string(),
            status: phase,
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&pvc).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

async fn list_events(client: Client, namespace: &str, lp: &ListParams) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let api: Api<Event> = api_for_namespace(client, namespace);
    let events = api.list(lp).await?;
    let summaries = events.items.into_iter().map(|event| {
        let reason = event.reason.clone().unwrap_or_else(|| "Unknown".to_string());
        let message = event.message.clone().unwrap_or_default();
        let meta = &event.metadata;
        ResourceSummary {
            name: format!("{}: {}", reason, message),
            namespace: meta.namespace.clone(),
            kind: "Event".to_string(),
            status: event.type_.clone().unwrap_or_else(|| "Normal".to_string()),
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&event).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

#[derive(Debug, Clone, Serialize)]
pub struct ResourceEvent {
    pub event_type: String,
    pub reason: String,
    pub message: String,
    pub count: Option<i32>,
    pub first_seen: String,
    pub last_seen: String,
    pub source: String,
}

pub async fn get_resource_events(
    client: Client,
    kind: &str,
    name: &str,
    namespace: &str,
) -> Result<Vec<ResourceEvent>, anyhow::Error> {
    // Map display kind to K8s involvedObject.kind
    let api_kind = match kind {
        "PVC" => "PersistentVolumeClaim",
        k => k,
    };

    let field_selector = format!("involvedObject.name={},involvedObject.kind={}", name, api_kind);
    let lp = ListParams::default().fields(&field_selector);
    let api: Api<Event> = Api::namespaced(client, namespace);
    let events = api.list(&lp).await?;

    let mut result: Vec<ResourceEvent> = events.items.into_iter().map(|e| {
        let last_ts = e.last_timestamp.as_ref()
            .map(|t| t.0.to_rfc3339())
            .or_else(|| e.metadata.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339()))
            .unwrap_or_default();
        let first_ts = e.first_timestamp.as_ref()
            .map(|t| t.0.to_rfc3339())
            .or_else(|| e.metadata.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339()))
            .unwrap_or_default();
        let source = e.source.as_ref()
            .and_then(|s| s.component.clone())
            .unwrap_or_default();
        ResourceEvent {
            event_type: e.type_.unwrap_or_else(|| "Normal".to_string()),
            reason: e.reason.unwrap_or_default(),
            message: e.message.unwrap_or_default(),
            count: e.count,
            first_seen: first_ts,
            last_seen: last_ts,
            source,
        }
    }).collect();

    // Sort newest first
    result.sort_by(|a, b| b.last_seen.cmp(&a.last_seen));
    Ok(result)
}

pub async fn get_resource_yaml(
    client: Client,
    kind: &str,
    name: &str,
    namespace: &str,
) -> Result<String, anyhow::Error> {
    match kind {
        "pods" => {
            let api: Api<Pod> = Api::namespaced(client, namespace);
            let pod = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&pod)?)
        }
        "deployments" => {
            let api: Api<Deployment> = Api::namespaced(client, namespace);
            let dep = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&dep)?)
        }
        "services" => {
            let api: Api<Service> = Api::namespaced(client, namespace);
            let svc = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&svc)?)
        }
        "configmaps" => {
            let api: Api<ConfigMap> = Api::namespaced(client, namespace);
            let cm = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&cm)?)
        }
        "secrets" => {
            let api: Api<Secret> = Api::namespaced(client, namespace);
            let secret = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&secret)?)
        }
        "ingresses" => {
            let api: Api<Ingress> = Api::namespaced(client, namespace);
            let ing = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&ing)?)
        }
        "pvcs" => {
            let api: Api<PersistentVolumeClaim> = Api::namespaced(client, namespace);
            let pvc = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&pvc)?)
        }
        "events" => {
            let api: Api<Event> = Api::namespaced(client, namespace);
            let event = api.get(name).await?;
            Ok(serde_json::to_string_pretty(&event)?)
        }
        _ => Err(anyhow::anyhow!("Unknown kind: {}", kind)),
    }
}

pub async fn get_deployment_pods(
    client: Client,
    name: &str,
    namespace: &str,
) -> Result<Vec<ResourceSummary>, anyhow::Error> {
    let dep_api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let dep = dep_api.get(name).await?;
    let match_labels = dep.spec
        .and_then(|s| s.selector.match_labels)
        .unwrap_or_default();

    let label_selector = match_labels
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join(",");

    let lp = ListParams::default().labels(&label_selector);
    let pod_api: Api<Pod> = Api::namespaced(client, namespace);
    let pods = pod_api.list(&lp).await?;

    let summaries = pods.items.into_iter().map(|pod| {
        let status = pod.status.as_ref()
            .and_then(|s| s.phase.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        let meta = &pod.metadata;
        ResourceSummary {
            name: meta.name.clone().unwrap_or_default(),
            namespace: meta.namespace.clone(),
            kind: "Pod".to_string(),
            status,
            age: calculate_age(meta.creation_timestamp.as_ref()),
            labels: meta.labels.clone().unwrap_or_default(),
            raw: serde_json::to_value(&pod).unwrap_or_default(),
        }
    }).collect();
    Ok(summaries)
}

pub async fn delete_resource(
    client: Client,
    kind: &str,
    name: &str,
    namespace: &str,
) -> Result<(), anyhow::Error> {
    let dp = kube::api::DeleteParams::default();
    match kind {
        "pods" => { Api::<Pod>::namespaced(client, namespace).delete(name, &dp).await?; }
        "deployments" => { Api::<Deployment>::namespaced(client, namespace).delete(name, &dp).await?; }
        "services" => { Api::<Service>::namespaced(client, namespace).delete(name, &dp).await?; }
        "configmaps" => { Api::<ConfigMap>::namespaced(client, namespace).delete(name, &dp).await?; }
        "secrets" => { Api::<Secret>::namespaced(client, namespace).delete(name, &dp).await?; }
        "ingresses" => { Api::<Ingress>::namespaced(client, namespace).delete(name, &dp).await?; }
        "pvcs" => { Api::<PersistentVolumeClaim>::namespaced(client, namespace).delete(name, &dp).await?; }
        _ => return Err(anyhow::anyhow!("Cannot delete kind: {}", kind)),
    }
    Ok(())
}

pub async fn scale_deployment(
    client: Client,
    name: &str,
    namespace: &str,
    replicas: i32,
) -> Result<(), anyhow::Error> {
    let api: Api<Deployment> = Api::namespaced(client, namespace);
    let patch = serde_json::json!({
        "spec": { "replicas": replicas }
    });
    api.patch(name, &kube::api::PatchParams::apply("kubevue"), &kube::api::Patch::Merge(&patch)).await?;
    Ok(())
}

pub async fn restart_deployment(
    client: Client,
    name: &str,
    namespace: &str,
) -> Result<(), anyhow::Error> {
    let api: Api<Deployment> = Api::namespaced(client, namespace);
    let now = chrono::Utc::now().to_rfc3339();
    let patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": now
                    }
                }
            }
        }
    });
    api.patch(name, &kube::api::PatchParams::apply("kubevue"), &kube::api::Patch::Merge(&patch)).await?;
    Ok(())
}
