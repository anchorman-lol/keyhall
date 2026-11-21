mod signer;

use std::collections::{HashMap, HashSet};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use nostr::prelude::{Event, Keys, ToBech32};
use serde_json::json;
use tauri::ipc::CapabilityBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;
use url::Url;

use signer::EventRequest;

const KEYCHAIN_SERVICE: &str = "lol.anchorman.keyhall";
const KEYCHAIN_ACCOUNT: &str = "nsec";
const GAME_PERMISSIONS: [&str; 3] = [
    "allow-nostr-get-public-key",
    "allow-nostr-sign-event",
    "allow-nostr-observe",
];

#[derive(Clone)]
struct Game {
    name: String,
    coordinate: String,
}

#[derive(Default)]
struct Launcher {
    keys: Mutex<Option<Keys>>,
    games: Mutex<HashMap<String, Game>>,
    approved: Mutex<HashSet<(String, u16)>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<bool>>>,
    next_request: AtomicU64,
}

fn keychain() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())
}

fn npub(keys: &Keys) -> String {
    keys.public_key()
        .to_bech32()
        .expect("public keys always encode")
}

fn game_label(url: &str) -> String {
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    format!("game-{:016x}", hasher.finish())
}

fn origin_pattern(url: &str) -> Result<String, String> {
    let url = Url::parse(url).map_err(|e| e.to_string())?;
    if url.scheme() != "https" {
        return Err("games must be served over https".into());
    }
    Ok(format!("{}/*", url.origin().ascii_serialization()))
}

impl Launcher {
    fn stored(&self) -> Result<Option<Keys>, String> {
        let mut cached = self.keys.lock().unwrap();
        if cached.is_none() {
            match keychain()?.get_password() {
                Ok(nsec) => *cached = Some(Keys::parse(&nsec).map_err(|e| e.to_string())?),
                Err(keyring::Error::NoEntry) => {}
                Err(e) => return Err(format!("Keyhall can't read the keychain: {e}")),
            }
        }
        Ok(cached.clone())
    }

    fn keys(&self) -> Result<Keys, String> {
        self.stored()?
            .ok_or_else(|| "Set up a key in Keyhall first".into())
    }

    fn store(&self, keys: Keys) -> Result<String, String> {
        if self.stored()?.is_some() {
            return Err("A key is already stored".into());
        }
        let nsec = keys.secret_key().to_bech32().map_err(|e| e.to_string())?;
        keychain()?.set_password(&nsec).map_err(|e| e.to_string())?;
        let npub = npub(&keys);
        *self.keys.lock().unwrap() = Some(keys);
        Ok(npub)
    }

    fn game(&self, window: &WebviewWindow) -> Result<Game, String> {
        self.games
            .lock()
            .unwrap()
            .get(window.label())
            .cloned()
            .ok_or_else(|| "not a game window".into())
    }
}

#[tauri::command]
fn key_status(state: State<Launcher>) -> Result<Option<String>, String> {
    Ok(state.stored()?.map(|k| npub(&k)))
}

#[tauri::command]
fn generate_key(state: State<Launcher>) -> Result<String, String> {
    state.store(Keys::generate())
}

#[tauri::command]
fn import_key(state: State<Launcher>, nsec: String) -> Result<String, String> {
    state.store(Keys::parse(nsec.trim()).map_err(|_| "That is not a valid nsec".to_string())?)
}

#[tauri::command]
fn open_game(
    app: AppHandle,
    state: State<Launcher>,
    name: String,
    coordinate: String,
    url: String,
    shim: String,
) -> Result<String, String> {
    let label = game_label(&url);
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(label);
    }
    let capability = GAME_PERMISSIONS.iter().fold(
        CapabilityBuilder::new(&label)
            .window(&label)
            .remote(origin_pattern(&url)?),
        |c, p| c.permission(*p),
    );
    app.add_capability(capability).map_err(|e| e.to_string())?;
    state.games.lock().unwrap().insert(
        label.clone(),
        Game {
            name: name.clone(),
            coordinate,
        },
    );
    let parsed = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title(&name)
        .inner_size(1100.0, 760.0)
        .initialization_script(&shim)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(label)
}

#[tauri::command]
fn check_game(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or("The game window is closed")?;
    window
        .eval("window.nostr.signEvent({kind:1,content:'Keyhall sign-in check',tags:[],created_at:Math.floor(Date.now()/1000)})")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn answer_sign_request(state: State<Launcher>, id: u64, allow: bool) {
    if let Some(reply) = state.pending.lock().unwrap().remove(&id) {
        let _ = reply.send(allow);
    }
}

#[tauri::command]
fn nostr_get_public_key(
    app: AppHandle,
    window: WebviewWindow,
    state: State<Launcher>,
) -> Result<String, String> {
    let game = state.game(&window)?;
    let pubkey = state.keys()?.public_key().to_hex();
    let _ = app.emit_to("main", "shim", json!({"coordinate": game.coordinate}));
    Ok(pubkey)
}

#[tauri::command]
async fn nostr_sign_event(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, Launcher>,
    event: EventRequest,
) -> Result<Event, String> {
    let game = state.game(&window)?;
    let keys = state.keys()?;
    let approval = (window.label().to_string(), event.kind);
    if !state.approved.lock().unwrap().contains(&approval) {
        let id = state.next_request.fetch_add(1, Ordering::Relaxed);
        let (reply, answer) = oneshot::channel();
        state.pending.lock().unwrap().insert(id, reply);
        let main = app
            .get_webview_window("main")
            .ok_or("The launcher window is closed")?;
        let _ = main.set_focus();
        main.emit(
            "sign-request",
            json!({"id": id, "game": game.name, "kind": event.kind, "content": event.content}),
        )
        .map_err(|e| e.to_string())?;
        if !answer.await.unwrap_or(false) {
            return Err("The player declined to sign".into());
        }
        state.approved.lock().unwrap().insert(approval);
    }
    let signed = signer::sign(&keys, &event)?;
    let _ = app.emit_to(
        "main",
        "shim",
        json!({"coordinate": game.coordinate, "event": signed}),
    );
    Ok(signed)
}

#[tauri::command]
fn nostr_observe(
    app: AppHandle,
    window: WebviewWindow,
    state: State<Launcher>,
    kinds: Vec<u16>,
) -> Result<(), String> {
    let game = state.game(&window)?;
    app.emit_to(
        "main",
        "observed",
        json!({"coordinate": game.coordinate, "kinds": kinds}),
    )
    .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .manage(Launcher::default())
        .invoke_handler(tauri::generate_handler![
            key_status,
            generate_key,
            import_key,
            open_game,
            check_game,
            answer_sign_request,
            nostr_get_public_key,
            nostr_sign_event,
            nostr_observe
        ])
        .run(tauri::generate_context!())
        .expect("error while running Keyhall");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_labels_are_stable_and_valid_window_labels() {
        let label = game_label("https://blockstr.io");
        assert_eq!(label, game_label("https://blockstr.io"));
        assert_ne!(label, game_label("https://sats-man.com"));
        assert!(label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'));
    }

    #[test]
    fn game_windows_are_scoped_to_their_https_origin() {
        assert_eq!(
            origin_pattern("https://blockstr.io/play?x=1").unwrap(),
            "https://blockstr.io/*"
        );
        assert!(origin_pattern("http://blockstr.io").is_err());
        assert!(origin_pattern("javascript:alert(1)").is_err());
    }
}
