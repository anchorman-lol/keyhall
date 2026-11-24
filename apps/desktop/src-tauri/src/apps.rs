use std::path::Path;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const POLL: Duration = Duration::from_millis(500);
const PICK: &str = r#"POSIX path of (choose file of type {"com.apple.application-bundle"} default location (path to applications folder) with prompt "Choose a game or app")"#;

/// A launched process Keyhall watches until it exits or Keyhall stops watching.
pub struct Tracked(Arc<Mutex<Child>>);

impl Tracked {
    pub fn stop(&self) {
        let _ = self.0.lock().unwrap().kill();
    }
}

pub fn track(
    mut command: Command,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<Tracked, String> {
    let child = Arc::new(Mutex::new(command.spawn().map_err(|e| e.to_string())?));
    let polled = child.clone();
    std::thread::spawn(move || {
        while matches!(polled.lock().unwrap().try_wait(), Ok(None)) {
            std::thread::sleep(POLL);
        }
        on_exit();
    });
    Ok(Tracked(child))
}

fn bundle(path: &str) -> Result<&str, String> {
    let trimmed = path.trim_end_matches('/');
    if trimmed.starts_with('/') && trimmed.ends_with(".app") && Path::new(trimmed).is_dir() {
        Ok(trimmed)
    } else {
        Err("Choose a macOS app (.app)".into())
    }
}

/// `open -W` runs as long as the app does, so its exit is the app's.
pub fn open(path: &str, wait: bool) -> Result<Command, String> {
    let mut command = Command::new("/usr/bin/open");
    if wait {
        command.arg("-W");
    }
    command.arg("-a").arg(bundle(path)?);
    Ok(command)
}

/// The macOS file dialog for apps; `None` when the player cancels.
pub fn pick() -> Result<Option<String>, String> {
    let out = Command::new("/usr/bin/osascript")
        .args(["-e", PICK])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Ok(None);
    }
    Ok(Some(
        String::from_utf8_lossy(&out.stdout)
            .trim()
            .trim_end_matches('/')
            .into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn exits(command: Command) -> (Tracked, mpsc::Receiver<()>) {
        let (tx, rx) = mpsc::channel();
        (track(command, move || tx.send(()).unwrap()).unwrap(), rx)
    }

    #[test]
    fn reports_when_the_launched_process_exits() {
        let (_tracked, exited) = exits(Command::new("/usr/bin/true"));
        assert!(exited.recv_timeout(Duration::from_secs(5)).is_ok());
    }

    #[test]
    fn keeps_tracking_while_it_runs_and_stops_on_request() {
        let mut sleep = Command::new("/bin/sleep");
        sleep.arg("30");
        let (tracked, exited) = exits(sleep);
        assert!(exited.recv_timeout(Duration::from_secs(1)).is_err());
        tracked.stop();
        assert!(exited.recv_timeout(Duration::from_secs(5)).is_ok());
    }

    #[test]
    fn launches_only_app_bundles() {
        let dir = std::env::temp_dir().join(format!("keyhall-apps-{}", std::process::id()));
        let app = dir.join("Game.app");
        std::fs::create_dir_all(&app).unwrap();
        let command = open(&format!("{}/", app.display()), true).unwrap();
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            ["-W", "-a", app.to_str().unwrap()]
        );
        assert!(open("/bin/sh", true).is_err());
        assert!(open("Game.app", true).is_err());
        assert!(open(dir.join("Missing.app").to_str().unwrap(), true).is_err());
    }
}
