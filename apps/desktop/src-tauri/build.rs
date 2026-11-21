fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "key_status",
            "generate_key",
            "import_key",
            "open_game",
            "check_game",
            "answer_sign_request",
            "nostr_get_public_key",
            "nostr_sign_event",
            "nostr_observe",
        ]),
    ))
    .expect("failed to run tauri-build");
}
