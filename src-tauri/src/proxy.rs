use crate::processes::{FRONTEND_ADDR, PROXY_ADDR};
use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::header::{
    HeaderMap, HeaderName, HeaderValue, ACCESS_CONTROL_ALLOW_HEADERS,
    ACCESS_CONTROL_ALLOW_METHODS, ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_MAX_AGE, HOST,
    ORIGIN,
};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode, Uri};
use hyper_util::rt::TokioIo;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::net::TcpListener;

/// Local reverse proxy for the Next.js UI only.
/// API traffic goes directly from the WebView to the cloud backend (NEXT_PUBLIC_API_URL).
pub async fn run_proxy(frontend_ready: Arc<AtomicBool>) -> Result<(), String> {
    let addr: SocketAddr = PROXY_ADDR
        .parse()
        .map_err(|e| format!("invalid proxy addr: {e}"))?;
    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| format!("bind proxy {PROXY_ADDR}: {e}"))?;
    log::info!("TruERP UI proxy listening on http://{PROXY_ADDR}");
    log::info!("UI upstream: http://{FRONTEND_ADDR}");

    loop {
        let (stream, _) = listener
            .accept()
            .await
            .map_err(|e| format!("proxy accept: {e}"))?;
        let ready = Arc::clone(&frontend_ready);
        tokio::spawn(async move {
            let io = TokioIo::new(stream);
            let service = service_fn(move |req| {
                let ready = Arc::clone(&ready);
                async move { handle(req, ready).await }
            });
            if let Err(err) = http1::Builder::new().serve_connection(io, service).await {
                log::warn!("proxy connection error: {err}");
            }
        });
    }
}

async fn handle(
    req: Request<Incoming>,
    frontend_ready: Arc<AtomicBool>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let origin = req
        .headers()
        .get(ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let path = req.uri().path().to_string();

    // Splash (Tauri asset server) polls readiness cross-origin.
    if path == "/__truerp/ready" {
        if req.method() == Method::OPTIONS {
            return Ok(with_cors(
                Response::builder()
                    .status(StatusCode::NO_CONTENT)
                    .body(Full::new(Bytes::new()))
                    .unwrap(),
                &origin,
            ));
        }
        if frontend_ready.load(Ordering::SeqCst) {
            return Ok(with_cors(
                Response::builder()
                    .status(StatusCode::NO_CONTENT)
                    .body(Full::new(Bytes::new()))
                    .unwrap(),
                &origin,
            ));
        }
        return Ok(with_cors(
            status_text(StatusCode::SERVICE_UNAVAILABLE, "starting"),
            &origin,
        ));
    }

    if frontend_ready.load(Ordering::SeqCst) {
        return Ok(with_cors(proxy_to_tcp(req, FRONTEND_ADDR).await, &origin));
    }

    Ok(with_cors(
        status_text(StatusCode::SERVICE_UNAVAILABLE, "TruERP UI is starting"),
        &origin,
    ))
}

fn with_cors(mut resp: Response<Full<Bytes>>, origin: &str) -> Response<Full<Bytes>> {
    let allow = if origin.is_empty() {
        "*"
    } else if is_local_origin(origin) {
        origin
    } else {
        return resp;
    };
    let headers = resp.headers_mut();
    if let Ok(v) = HeaderValue::from_str(allow) {
        headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, v);
    }
    headers.insert(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"),
    );
    headers.insert(
        ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Authorization, Content-Type, Accept, Origin"),
    );
    headers.insert(ACCESS_CONTROL_MAX_AGE, HeaderValue::from_static("600"));
    resp
}

fn is_local_origin(origin: &str) -> bool {
    origin.starts_with("http://127.0.0.1:")
        || origin.starts_with("http://localhost:")
        || origin.starts_with("tauri://")
        || origin == "null"
}

async fn proxy_to_tcp(req: Request<Incoming>, target_host: &str) -> Response<Full<Bytes>> {
    let method = req.method().clone();
    let headers = req.headers().clone();
    let path_and_query = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let target: Uri = match format!("http://{target_host}{path_and_query}").parse() {
        Ok(u) => u,
        Err(_) => return status_text(StatusCode::BAD_GATEWAY, "invalid upstream URL"),
    };

    let body_bytes = match req.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(err) => {
            log::warn!("read request body: {err}");
            return status_text(StatusCode::BAD_REQUEST, "failed to read body");
        }
    };

    let mut builder = Request::builder().method(method).uri(target);
    copy_headers(headers, builder.headers_mut().unwrap(), target_host);

    let upstream_req = match builder.body(Full::new(body_bytes)) {
        Ok(r) => r,
        Err(_) => return status_text(StatusCode::BAD_GATEWAY, "failed to build upstream request"),
    };

    match hyper_tcp_request(upstream_req).await {
        Ok(resp) => resp,
        Err(err) => {
            log::warn!("upstream {target_host} error: {err}");
            status_text(StatusCode::BAD_GATEWAY, "TruERP upstream is unavailable")
        }
    }
}

fn copy_headers(src: HeaderMap, dst: &mut HeaderMap, target_host: &str) {
    for (key, value) in src.iter() {
        if key == HOST {
            continue;
        }
        if matches!(
            key.as_str(),
            "connection"
                | "keep-alive"
                | "proxy-authenticate"
                | "proxy-authorization"
                | "te"
                | "trailers"
                | "transfer-encoding"
                | "upgrade"
        ) {
            continue;
        }
        dst.append(key, value.clone());
    }
    if let Ok(v) = HeaderValue::from_str(target_host) {
        dst.insert(HOST, v);
    }
    let _ = HeaderName::from_static("x-forwarded-host");
}

async fn hyper_tcp_request(
    req: Request<Full<Bytes>>,
) -> Result<Response<Full<Bytes>>, String> {
    use hyper_util::client::legacy::connect::HttpConnector;
    use hyper_util::client::legacy::Client;
    use hyper_util::rt::TokioExecutor;

    let client = Client::builder(TokioExecutor::new()).build(HttpConnector::new());
    let resp = client
        .request(req)
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    response_from_incoming(resp).await
}

async fn response_from_incoming(
    resp: Response<Incoming>,
) -> Result<Response<Full<Bytes>>, String> {
    let status = resp.status();
    let headers = resp.headers().clone();
    let body = resp
        .collect()
        .await
        .map_err(|e| format!("read response: {e}"))?
        .to_bytes();

    let mut out = Response::builder().status(status);
    if let Some(h) = out.headers_mut() {
        for (k, v) in headers.iter() {
            if matches!(
                k.as_str(),
                "transfer-encoding" | "connection" | "content-length"
            ) {
                continue;
            }
            h.append(k, v.clone());
        }
    }
    out.body(Full::new(body))
        .map_err(|e| format!("build response: {e}"))
}

fn status_text(status: StatusCode, msg: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .header(hyper::header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(Full::new(Bytes::from(msg.to_string())))
        .unwrap()
}
