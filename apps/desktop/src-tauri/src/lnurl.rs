//! LNURL-pay requests for zaps, made here so the webview's CSP needn't allow every https host.

use std::time::Duration;

use reqwest::redirect::Policy;
use url::{Host, Url};

/// Only a Lightning address's `/.well-known/lnurlp/<name>` or a pay callback asking for an `amount`.
fn checked(url: &str) -> Result<Url, String> {
    let url = Url::parse(url).map_err(|e| e.to_string())?;
    let domain = matches!(url.host(), Some(Host::Domain(d)) if d != "localhost");
    let pay = url
        .path()
        .strip_prefix("/.well-known/lnurlp/")
        .is_some_and(|name| !name.is_empty() && !name.contains('/'))
        || url.query_pairs().any(|(k, _)| k == "amount");
    if url.scheme() != "https"
        || !domain
        || !url.username().is_empty()
        || url.password().is_some()
        || !pay
    {
        return Err(format!("Not an LNURL-pay URL: {url}"));
    }
    Ok(url)
}

pub async fn fetch(url: &str) -> Result<serde_json::Value, String> {
    let url = checked(url)?;
    let _ = rustls::crypto::ring::default_provider().install_default();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(Policy::custom(|a| {
            if a.previous().len() < 5 && a.url().scheme() == "https" {
                a.follow()
            } else {
                a.stop()
            }
        }))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    res.json()
        .await
        .map_err(|_| format!("The Lightning address answered {status} without JSON"))
}

#[cfg(test)]
mod tests {
    use super::checked;

    #[test]
    fn accepts_lightning_addresses_and_pay_callbacks() {
        assert!(checked("https://walletofsatoshi.com/.well-known/lnurlp/dev").is_ok());
        assert!(checked("https://x.io/lnurlp/dev/callback?amount=1000&nostr=%7B%7D").is_ok());
    }

    #[test]
    fn refuses_other_urls() {
        for url in [
            "http://x.io/.well-known/lnurlp/dev",
            "https://x.io/.well-known/lnurlp/",
            "https://x.io/.well-known/lnurlp/a/b",
            "https://x.io/cb",
            "https://x.io/api?nostr=1",
            "https://127.0.0.1/cb?amount=1",
            "https://[::1]/cb?amount=1",
            "https://localhost/cb?amount=1",
            "https://user:pw@x.io/cb?amount=1",
            "file:///etc/passwd?amount=1",
            "not a url",
        ] {
            assert!(checked(url).is_err(), "{url}");
        }
    }

    #[test]
    #[ignore = "network"]
    fn fetches_metadata_and_an_invoice() {
        tauri::async_runtime::block_on(async {
            let pay = super::fetch("https://walletofsatoshi.com/.well-known/lnurlp/trimpayment17")
                .await
                .unwrap();
            println!("{pay}");
            let callback = format!("{}?amount=1000", pay["callback"].as_str().unwrap());
            let invoice = super::fetch(&callback).await.unwrap();
            println!("{invoice}");
            assert!(invoice["pr"].as_str().unwrap().starts_with("lnbc10n1"));
        });
    }
}
