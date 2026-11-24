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

/// Kinds the launcher window signs: the profile (kind 0), NIP-59 seals and NIP-38 statuses.
const LAUNCHER_KINDS: [u16; 3] = [0, 13, 30315];

/// Games never sign the profile or private messages, even with the player's approval.
pub fn game_may_sign(kind: u16) -> Result<(), String> {
    match kind {
        0 => Err("Games can't change your profile".into()),
        13 | 14 | 1059 => Err("Games can't send private messages".into()),
        _ => Ok(()),
    }
}

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

pub fn label(keys: &Keys, req: &EventRequest) -> Result<Event, String> {
    if req.kind != 1985 {
        return Err("Only labels can be signed here".into());
    }
    sign(keys, req)
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
    fn the_launcher_signs_only_profile_and_presence_kinds() {
        let keys = Keys::generate();
        let req = |kind: u16| {
            request(&format!(
                r#"{{"kind":{kind},"content":"","tags":[],"created_at":1}}"#
            ))
            .unwrap()
        };
        assert!(sign_for_launcher(&keys, &req(30315)).is_ok());
        assert!(sign_for_launcher(&keys, &req(13)).is_ok());
        assert!(sign_for_launcher(&keys, &req(0)).is_ok());
        assert!(sign_for_launcher(&keys, &req(1)).is_err());
    }

    #[test]
    fn games_never_sign_the_profile_or_private_messages() {
        assert!(game_may_sign(0).is_err());
        assert!(game_may_sign(13).is_err());
        assert!(game_may_sign(1059).is_err());
        assert!(game_may_sign(1).is_ok());
        assert!(game_may_sign(30315).is_ok());
    }

    #[test]
    fn rejects_malformed_requests() {
        assert!(request(r#"{"content":"","tags":[],"created_at":1}"#).is_err());
        assert!(request(r#"{"kind":1,"content":"","tags":"x","created_at":1}"#).is_err());
        assert!(request(r#"{"kind":-1,"content":"","tags":[],"created_at":1}"#).is_err());
    }

    #[test]
    fn signs_only_labels_for_the_launcher() {
        let keys = Keys::generate();
        let label =
            request(r#"{"kind":1985,"content":"","tags":[["a","31990:x:y"]],"created_at":1}"#)
                .unwrap();
        assert!(super::label(&keys, &label).unwrap().verify().is_ok());
        let note = request(r#"{"kind":1,"content":"","tags":[],"created_at":1}"#).unwrap();
        assert!(super::label(&keys, &note).is_err());
    }
}
