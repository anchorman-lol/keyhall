use nostr::prelude::{Event, FinalizeEvent, Keys, UnsignedEvent};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
pub struct EventRequest {
    pub kind: u16,
    pub content: String,
    pub tags: Vec<Vec<String>>,
    pub created_at: u64,
}

/// Kinds the launcher window signs for presence: NIP-59 seals and NIP-38 statuses.
const LAUNCHER_KINDS: [u16; 2] = [13, 30315];

pub fn sign_for_launcher(keys: &Keys, req: &EventRequest) -> Result<Event, String> {
    if !LAUNCHER_KINDS.contains(&req.kind) {
        return Err(format!("The launcher doesn't sign kind {}", req.kind));
    }
    sign(keys, req)
}

pub fn sign(keys: &Keys, req: &EventRequest) -> Result<Event, String> {
    let unsigned = json!({
        "pubkey": keys.public_key().to_hex(),
        "kind": req.kind,
        "content": req.content,
        "tags": req.tags,
        "created_at": req.created_at,
    });
    let unsigned: UnsignedEvent = serde_json::from_value(unsigned).map_err(|e| e.to_string())?;
    unsigned.finalize(keys).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(json: &str) -> Result<EventRequest, serde_json::Error> {
        serde_json::from_str(json)
    }

    #[test]
    fn signs_a_verifiable_event_as_the_key_holder() {
        let keys = Keys::generate();
        let req = request(
            r#"{"kind":1,"content":"hi","tags":[["t","keyhall"]],"created_at":1790000000}"#,
        )
        .unwrap();
        let event = sign(&keys, &req).unwrap();
        assert!(event.verify().is_ok());
        assert_eq!(event.pubkey, keys.public_key());
        assert_eq!(event.content, "hi");
        assert_eq!(event.created_at.as_secs(), 1_790_000_000);
    }

    #[test]
    fn ignores_pubkey_id_and_sig_from_the_page() {
        let keys = Keys::generate();
        let other = Keys::generate().public_key().to_hex();
        let req = request(&format!(
            r#"{{"kind":1,"content":"","tags":[],"created_at":1,"pubkey":"{other}","id":"{}","sig":"00"}}"#,
            "0".repeat(64)
        ))
        .unwrap();
        let event = sign(&keys, &req).unwrap();
        assert!(event.verify().is_ok());
        assert_eq!(event.pubkey, keys.public_key());
    }

    #[test]
    fn the_launcher_signs_only_presence_kinds() {
        let keys = Keys::generate();
        let req = |kind: u16| {
            request(&format!(
                r#"{{"kind":{kind},"content":"","tags":[],"created_at":1}}"#
            ))
            .unwrap()
        };
        assert!(sign_for_launcher(&keys, &req(30315)).is_ok());
        assert!(sign_for_launcher(&keys, &req(13)).is_ok());
        assert!(sign_for_launcher(&keys, &req(1)).is_err());
    }

    #[test]
    fn rejects_malformed_requests() {
        assert!(request(r#"{"content":"","tags":[],"created_at":1}"#).is_err());
        assert!(request(r#"{"kind":1,"content":"","tags":"x","created_at":1}"#).is_err());
        assert!(request(r#"{"kind":-1,"content":"","tags":[],"created_at":1}"#).is_err());
    }
}
