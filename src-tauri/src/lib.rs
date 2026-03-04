mod kube;

use kube::config::ClusterContext;
use kube::resources::{ResourceSummary, ResourceEvent};
use kube::metrics::PodMetricsResult;
use kube::port_forward::PortForwardSession;

#[tauri::command]
async fn list_contexts() -> Result<Vec<ClusterContext>, String> {
    kube::config::list_contexts().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_namespaces(context: String) -> Result<Vec<String>, String> {
    kube::config::list_namespaces(&context).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_resources(context: String, kind: String, namespace: String) -> Result<Vec<ResourceSummary>, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::list_resources(client, &kind, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_resource_yaml(context: String, kind: String, name: String, namespace: String) -> Result<String, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::get_resource_yaml(client, &kind, &name, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_deployment_pods(context: String, name: String, namespace: String) -> Result<Vec<ResourceSummary>, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::get_deployment_pods(client, &name, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_resource(context: String, kind: String, name: String, namespace: String) -> Result<(), String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::delete_resource(client, &kind, &name, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn scale_deployment(context: String, name: String, namespace: String, replicas: i32) -> Result<(), String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::scale_deployment(client, &name, &namespace, replicas).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn restart_deployment(context: String, name: String, namespace: String) -> Result<(), String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::restart_deployment(client, &name, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn stream_logs(
    app: tauri::AppHandle,
    context: String,
    pod: String,
    container: Option<String>,
    namespace: String,
    follow: bool,
    tail_lines: Option<i64>,
) -> Result<(), String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::logs::stream_logs(app, client, &pod, container.as_deref(), &namespace, follow, tail_lines)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_pod_metrics(context: String, name: String, namespace: String) -> Result<PodMetricsResult, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::metrics::get_pod_metrics(client, &name, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_pod_metrics(context: String, namespace: String) -> Result<std::collections::HashMap<String, PodMetricsResult>, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::metrics::get_all_pod_metrics(client, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_resource_events(context: String, kind: String, name: String, namespace: String) -> Result<Vec<ResourceEvent>, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::resources::get_resource_events(client, &kind, &name, &namespace).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn watch_resources(
    app: tauri::AppHandle,
    context: String,
    kind: String,
    namespace: String,
) -> Result<(), String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::watcher::watch_resources(app, client, &kind, &namespace)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_port_forward(
    context: String,
    pod: String,
    namespace: String,
    local_port: u16,
    remote_port: u16,
) -> Result<PortForwardSession, String> {
    let client = kube::client::get_client(&context).await.map_err(|e| e.to_string())?;
    kube::port_forward::start_port_forward(client, &pod, &namespace, local_port, remote_port)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_port_forward(id: String) -> Result<(), String> {
    kube::port_forward::stop_port_forward(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_port_forwards() -> Result<Vec<PortForwardSession>, String> {
    Ok(kube::port_forward::list_port_forwards().await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_contexts,
            list_namespaces,
            list_resources,
            get_resource_yaml,
            get_deployment_pods,
            get_resource_events,
            delete_resource,
            scale_deployment,
            restart_deployment,
            stream_logs,
            watch_resources,
            get_pod_metrics,
            get_all_pod_metrics,
            start_port_forward,
            stop_port_forward,
            list_port_forwards,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
