mod dm;
mod meter;
mod signer;
mod wallet;

use std::collections::{HashMap, HashSet};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use nostr::nips::nip44;
use nostr::nips::nip47::NostrWalletConnectUri;
use nostr::prelude::{Event, Keys, PublicKey, ToBech32};
use serde_json::json;
use tauri::ipc::CapabilityBuilder;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_updater::UpdaterExt;
use tokio::sync::oneshot;
use url::Url;

use meter::{Meter, Session};
use signer::EventRequest;

const KEYCHAIN_SERVICE: &str = "lol.anchorman.keyhall";
const KEYCHAIN_ACCOUNT: &str = "nsec";
const WALLET_ACCOUNT: &str = "nwc";
const UPDATE_INTERVAL: Duration = Duration::from_secs(4 * 60 * 60);
const GAME_PERMISSIONS: [&str; 5] = [
    "allow-nostr-get-public-key",
    "allow-nostr-sign-event",
    "allow-nostr-observe",
    "allow-nostr-key-field",
    "allow-open-overlay",
];

enum Layout {
    Centered(f64, f64),
    Fill,
}

/// A kind of Keyhall window over a game, labelled `<game>-<kind>-<id>`.
struct Panel {
    kind: &'static str,
    layout: Layout,
    permissions: &'static [&'static str],
    /// Whether the launcher may open it with `open_panel`; notices open only from Rust.
    launcher: bool,
}

const PANELS: [Panel; 2] = [
    Panel {
        kind: "notice",
        layout: Layout::Centered(420.0, 260.0),
        permissions: &["allow-answer-notice"],
        launcher: false,
    },
    Panel {
        kind: "overlay",
        layout: Layout::Fill,
        permissions: &["allow-close-panel"],
        launcher: true,
    },
];

fn panel_of(label: &str) -> Option<(&'static Panel, &str)> {
    let (_, rest) = label.strip_prefix("game-")?.split_once('-')?;
    let (kind, id) = rest.split_once('-')?;
    Some((PANELS.iter().find(|p| p.kind == kind)?, id))
}

fn launcher_panel(kind: &str) -> Result<&'static Panel, String> {
    PANELS
        .iter()
        .find(|p| p.kind == kind && p.launcher)
        .ok_or_else(|| format!("The launcher can't open a {kind} panel"))
}

fn panel_capability(panel: &Panel) -> CapabilityBuilder {
    panel.permissions.iter().fold(
        CapabilityBuilder::new(format!("panel-{}", panel.kind))
            .window(format!("game-*-{}-*", panel.kind)),
        |c, p| c.permission(*p),
    )
}

#[derive(Clone)]
struct Game {
    name: String,
    coordinate: String,
}

#[derive(Default)]
struct Launcher {
    keys: Mutex<Option<Keys>>,
    wallet: Mutex<Option<NostrWalletConnectUri>>,
    games: Mutex<HashMap<String, Game>>,
    approved: Mutex<HashSet<(String, u16)>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<bool>>>,
    next_request: AtomicU64,
}

fn keychain(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account).map_err(|e| e.to_string())
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
            match keychain(KEYCHAIN_ACCOUNT)?.get_password() {
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
        keychain(KEYCHAIN_ACCOUNT)?
            .set_password(&nsec)
            .map_err(|e| e.to_string())?;
        let npub = npub(&keys);
        *self.keys.lock().unwrap() = Some(keys);
        Ok(npub)
    }

    fn stored_wallet(&self) -> Result<Option<NostrWalletConnectUri>, String> {
        let mut cached = self.wallet.lock().unwrap();
        if cached.is_none() {
            match keychain(WALLET_ACCOUNT)?.get_password() {
                Ok(uri) => *cached = Some(wallet::parse(&uri)?),
                Err(keyring::Error::NoEntry) => {}
                Err(e) => return Err(format!("Keyhall can't read the keychain: {e}")),
            }
        }
        Ok(cached.clone())
    }

    fn wallet(&self) -> Result<NostrWalletConnectUri, String> {
        self.stored_wallet()?
            .ok_or_else(|| "Connect a wallet first".into())
    }

    fn answer(&self, id: &str, allow: bool) {
        let pending = id
            .parse()
            .ok()
            .and_then(|id| self.pending.lock().unwrap().remove(&id));
        if let Some(reply) = pending {
            let _ = reply.send(allow);
        }
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

/// Keychain calls can block on a macOS password prompt, so they run off the main thread.
async fn keychain_task<T: Send + 'static>(
    app: AppHandle,
    task: impl FnOnce(&Launcher) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || task(&app.state::<Launcher>()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn key_status(app: AppHandle) -> Result<Option<String>, String> {
    keychain_task(app, |l| Ok(l.stored()?.map(|k| npub(&k)))).await
}

#[tauri::command]
async fn generate_key(app: AppHandle) -> Result<String, String> {
    keychain_task(app, |l| l.store(Keys::generate())).await
}

#[tauri::command]
async fn import_key(app: AppHandle, nsec: String) -> Result<String, String> {
    let keys = Keys::parse(nsec.trim()).map_err(|_| "That is not a valid nsec".to_string())?;
    keychain_task(app, |l| l.store(keys)).await
}

#[tauri::command]
async fn sign_out(app: AppHandle) -> Result<(), String> {
    for window in app.webview_windows().into_values() {
        if window.label() != "main" {
            window.destroy().map_err(|e| e.to_string())?;
        }
    }
    keychain_task(app, |l| {
        match keychain(KEYCHAIN_ACCOUNT)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("Keyhall can't remove the key from the keychain: {e}")),
        }
        *l.keys.lock().unwrap() = None;
        l.approved.lock().unwrap().clear();
        l.pending.lock().unwrap().clear();
        Ok(())
    })
    .await
}

#[tauri::command]
async fn wallet_status(app: AppHandle) -> Result<Option<String>, String> {
    keychain_task(app, |l| {
        Ok(l.stored_wallet()?.as_ref().map(wallet::summary))
    })
    .await
}

#[tauri::command]
async fn connect_wallet(app: AppHandle, uri: String) -> Result<String, String> {
    let parsed = wallet::parse(&uri)?;
    keychain_task(app, move |l| {
        keychain(WALLET_ACCOUNT)?
            .set_password(uri.trim())
            .map_err(|e| e.to_string())?;
        let summary = wallet::summary(&parsed);
        *l.wallet.lock().unwrap() = Some(parsed);
        Ok(summary)
    })
    .await
}

#[tauri::command]
async fn wallet_pay_request(app: AppHandle, invoice: String) -> Result<serde_json::Value, String> {
    keychain_task(app, move |l| wallet::pay_request(&l.wallet()?, &invoice)).await
}

#[tauri::command]
async fn wallet_pay_result(app: AppHandle, reply: Event) -> Result<String, String> {
    keychain_task(app, move |l| wallet::pay_result(&l.wallet()?, &reply)).await
}

#[tauri::command]
fn play_sessions(meter: State<Mutex<Meter>>) -> Vec<Session> {
    meter.lock().unwrap().tick(meter::now()).to_vec()
}

#[tauri::command]
fn open_game(
    app: AppHandle,
    state: State<Launcher>,
    meter: State<Mutex<Meter>>,
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
    let parsed = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title(&name)
        .inner_size(1100.0, 760.0)
        .initialization_script(&shim)
        .build()
        .map_err(|e| e.to_string())?;
    meter
        .lock()
        .unwrap()
        .start(&label, &coordinate, meter::now());
    let closed = label.clone();
    let coordinate_closed = coordinate.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            for (label, panel) in app.webview_windows() {
                if label.starts_with(&format!("{closed}-")) {
                    let _ = panel.destroy();
                }
            }
            app.state::<Mutex<Meter>>()
                .lock()
                .unwrap()
                .stop(&closed, meter::now());
            app.state::<Launcher>().games.lock().unwrap().remove(&closed);
            let _ = app.emit_to("main", "closed", json!({"coordinate": coordinate_closed}));
        }
    });
    state
        .games
        .lock()
        .unwrap()
        .insert(label.clone(), Game { name, coordinate });
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
fn close_game(app: AppHandle, state: State<Launcher>, label: String) -> Result<(), String> {
    if !state.games.lock().unwrap().contains_key(&label) {
        return Err("Not a game window".into());
    }
    match app.get_webview_window(&label) {
        Some(window) => window.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Shows a Keyhall page in its own window over the game, so the game can't script it.
fn show_panel(
    game: &WebviewWindow,
    panel: &Panel,
    id: &str,
    props: serde_json::Value,
) -> Result<(), String> {
    let label = format!("{}-{}-{id}", game.label(), panel.kind);
    if let Some(window) = game.get_webview_window(&label) {
        return window.set_focus().map_err(|e| e.to_string());
    }
    let scale = game.scale_factor().map_err(|e| e.to_string())?;
    let at: LogicalPosition<f64> = game
        .inner_position()
        .map_err(|e| e.to_string())?
        .to_logical(scale);
    let size: LogicalSize<f64> = game
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical(scale);
    let fill = matches!(panel.layout, Layout::Fill);
    let (width, height) = match panel.layout {
        Layout::Centered(width, height) => (width, height),
        Layout::Fill => (size.width, size.height),
    };
    let page = json!({"kind": panel.kind, "props": props});
    let window = WebviewWindowBuilder::new(game, &label, WebviewUrl::App("index.html".into()))
        .initialization_script(format!("window.panel = {page};"))
        .parent(game)
        .map_err(|e| e.to_string())?
        .decorations(false)
        .resizable(false)
        .transparent(fill)
        .shadow(!fill)
        .inner_size(width, height)
        .position(
            at.x + (size.width - width) / 2.0,
            at.y + (size.height - height) / 2.0,
        )
        .build()
        .map_err(|e| e.to_string())?;
    let app = game.app_handle().clone();
    let label = window.label().to_string();
    window.on_window_event(move |event| {
        if let (WindowEvent::Destroyed, Some((panel, id))) = (event, panel_of(&label))
            && panel.kind == "notice"
        {
            app.state::<Launcher>().answer(id, false);
        }
    });
    let _ = game.set_focus();
    window.set_focus().map_err(|e| e.to_string())
}

fn notice(game: &WebviewWindow, id: &str, props: serde_json::Value) -> Result<(), String> {
    show_panel(game, &PANELS[0], id, props)
}

#[tauri::command]
fn open_panel(
    app: AppHandle,
    state: State<Launcher>,
    game: String,
    kind: String,
    props: serde_json::Value,
) -> Result<(), String> {
    let panel = launcher_panel(&kind)?;
    let window = app
        .get_webview_window(&game)
        .ok_or("The game window is closed")?;
    state.game(&window)?;
    show_panel(&window, panel, "0", props)
}

#[tauri::command]
fn close_panel(window: WebviewWindow) -> Result<(), String> {
    panel_of(window.label()).ok_or("not a panel")?;
    window.destroy().map_err(|e| e.to_string())
}

#[tauri::command]
fn answer_notice(window: WebviewWindow, state: State<Launcher>, allow: bool) -> Result<(), String> {
    match panel_of(window.label()) {
        Some((panel, id)) if panel.kind == "notice" => state.answer(id, allow),
        _ => return Err("not a notice".into()),
    }
    window.destroy().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_overlay(
    app: AppHandle,
    window: WebviewWindow,
    state: State<Launcher>,
) -> Result<(), String> {
    let game = state.game(&window)?;
    app.emit_to(
        "main",
        "panel",
        json!({"coordinate": game.coordinate, "kind": "overlay"}),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sign_event(app: AppHandle, event: EventRequest) -> Result<Event, String> {
    let keys = keychain_task(app, Launcher::keys).await?;
    signer::sign_for_launcher(&keys, &event)
}

fn peer(pubkey: &str) -> Result<PublicKey, String> {
    PublicKey::from_hex(pubkey).map_err(|e| e.to_string())
}

#[tauri::command]
async fn nip44_encrypt(app: AppHandle, pubkey: String, text: String) -> Result<String, String> {
    let keys = keychain_task(app, Launcher::keys).await?;
    nip44::encrypt(keys.secret_key(), &peer(&pubkey)?, text, nip44::Version::V2)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn nip44_decrypt(app: AppHandle, pubkey: String, text: String) -> Result<String, String> {
    let keys = keychain_task(app, Launcher::keys).await?;
    nip44::decrypt(keys.secret_key(), &peer(&pubkey)?, text).map_err(|e| e.to_string())
}

#[tauri::command]
async fn dm_wrap(app: AppHandle, to: String, text: String) -> Result<[Event; 2], String> {
    let keys = keychain_task(app, Launcher::keys).await?;
    dm::wrap(&keys, peer(&to)?, &text)
}

#[tauri::command]
async fn dm_unwrap(app: AppHandle, wrap: Event) -> Result<dm::Message, String> {
    dm::unwrap(&keychain_task(app, Launcher::keys).await?, &wrap)
}

#[tauri::command]
async fn nostr_get_public_key(app: AppHandle, window: WebviewWindow) -> Result<String, String> {
    let game = app.state::<Launcher>().game(&window)?;
    let pubkey = keychain_task(app.clone(), Launcher::keys)
        .await?
        .public_key()
        .to_hex();
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
    signer::game_may_sign(event.kind)?;
    let keys = keychain_task(app.clone(), Launcher::keys).await?;
    let approval = (window.label().to_string(), event.kind);
    if !state.approved.lock().unwrap().contains(&approval) {
        let id = state.next_request.fetch_add(1, Ordering::Relaxed);
        let (reply, answer) = oneshot::channel();
        state.pending.lock().unwrap().insert(id, reply);
        notice(
            &window,
            &id.to_string(),
            json!({"game": game.name, "kind": event.kind, "content": event.content}),
        )?;
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

#[tauri::command]
fn nostr_key_field(
    app: AppHandle,
    window: WebviewWindow,
    state: State<Launcher>,
) -> Result<(), String> {
    let game = state.game(&window)?;
    notice(&window, "key", json!({"game": game.name}))?;
    app.emit_to("main", "key-field", game.coordinate)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sign_label(app: AppHandle, event: EventRequest) -> Result<Event, String> {
    signer::label(&keychain_task(app, Launcher::keys).await?, &event)
}

#[tauri::command]
fn restart_to_update(app: AppHandle, state: State<Launcher>) -> Result<(), String> {
    if !state.games.lock().unwrap().is_empty() {
        return Err("Close your games to restart Keyhall".into());
    }
    app.restart()
}

async fn install_update(app: &AppHandle) -> tauri_plugin_updater::Result<Option<String>> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(None);
    };
    update.download_and_install(|_, _| {}, || {}).await?;
    Ok(Some(update.version))
}

/// Installs the next release in the background, so it runs from the next start.
async fn keep_updated(app: AppHandle) {
    loop {
        match install_update(&app).await {
            Ok(Some(version)) => {
                let _ = app.emit_to("main", "update-ready", version);
                return;
            }
            Ok(None) => {}
            Err(e) => eprintln!("Keyhall couldn't update: {e}"),
        }
        tokio::time::sleep(UPDATE_INTERVAL).await;
    }
}

/// The launcher draws its window controls on the right of its title bar, like Steam.
#[cfg(target_os = "macos")]
fn hide_traffic_lights(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    // SAFETY: setup runs on the main thread and the pointer is the window's live NSWindow.
    let ns_window = unsafe { &*window.ns_window()?.cast::<NSWindow>() };
    for kind in [
        NSWindowButton::CloseButton,
        NSWindowButton::MiniaturizeButton,
        NSWindowButton::ZoomButton,
    ] {
        if let Some(button) = ns_window.standardWindowButton(kind) {
            button.setHidden(true);
        }
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Launcher::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            hide_traffic_lights(&app.get_webview_window("main").expect("main window"))?;
            for panel in &PANELS {
                app.add_capability(panel_capability(panel))?;
            }
            let path = app.path().app_data_dir()?.join("playtime.json");
            app.manage(Mutex::new(Meter::load(path)));
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_secs(30));
                    handle
                        .state::<Mutex<Meter>>()
                        .lock()
                        .unwrap()
                        .tick(meter::now());
                }
            });
            if option_env!("KEYHALL_UPDATES").is_some() {
                tauri::async_runtime::spawn(keep_updated(app.handle().clone()));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            key_status,
            generate_key,
            import_key,
            sign_out,
            open_game,
            check_game,
            close_game,
            answer_notice,
            open_panel,
            close_panel,
            open_overlay,
            sign_event,
            nip44_encrypt,
            nip44_decrypt,
            dm_wrap,
            dm_unwrap,
            wallet_status,
            connect_wallet,
            wallet_pay_request,
            wallet_pay_result,
            play_sessions,
            nostr_get_public_key,
            nostr_sign_event,
            nostr_observe,
            nostr_key_field,
            sign_label,
            restart_to_update
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

    #[test]
    fn only_keyhall_panels_over_a_game_parse_as_panels() {
        let game = game_label("https://blockstr.io");
        let notice = format!("{game}-notice-3");
        let (panel, id) = panel_of(&notice).unwrap();
        assert_eq!((panel.kind, id), ("notice", "3"));
        assert_eq!(
            panel_of(&format!("{game}-overlay-0")).unwrap().0.kind,
            "overlay"
        );
        for label in [&game, "main", "game-x-dms-1", "notice-1", "x-y-overlay-0"] {
            assert!(panel_of(label).is_none(), "{label}");
        }
    }

    #[test]
    fn each_panel_kind_gets_only_its_own_commands() {
        assert_eq!(PANELS[0].permissions, ["allow-answer-notice"]);
        assert_eq!(PANELS[1].permissions, ["allow-close-panel"]);
        for panel in &PANELS {
            assert!(
                panel
                    .permissions
                    .iter()
                    .all(|p| !GAME_PERMISSIONS.contains(p))
            );
        }
    }

    #[test]
    fn the_launcher_opens_overlays_but_never_notices() {
        assert!(launcher_panel("overlay").is_ok());
        assert!(launcher_panel("notice").is_err());
        assert!(launcher_panel("dms").is_err());
    }
}
