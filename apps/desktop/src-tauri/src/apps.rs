use std::path::Path;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const POLL: Duration = Duration::from_millis(500);

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

/// The command for a picked file, running as long as the program does.
pub fn launch(path: &str) -> Result<Command, String> {
    let path = Path::new(path.trim_end_matches(['/', '\\']));
    path.is_absolute()
        .then(|| program(path))
        .flatten()
        .ok_or_else(|| "Keyhall can't launch that file on this computer".into())
}

/// The per-OS part: which files the picker offers and how one becomes a command.
#[cfg(target_os = "macos")]
pub const PICK: &[&str] = &["app"];
#[cfg(windows)]
pub const PICK: &[&str] = &["exe"];
#[cfg(not(any(target_os = "macos", windows)))]
pub const PICK: &[&str] = &[];

fn program(path: &Path) -> Option<Command> {
    #[cfg(target_os = "macos")]
    if path.extension().is_some_and(|e| e == "app") && path.is_dir() {
        let mut open = Command::new("/usr/bin/open");
        open.arg("-W").arg("-a").arg(path);
        return Some(open);
    }
    #[cfg(unix)]
    let runs =
        std::os::unix::fs::PermissionsExt::mode(&path.metadata().ok()?.permissions()) & 0o111 != 0;
    #[cfg(windows)]
    let runs = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
    (runs && path.is_file()).then(|| Command::new(path))
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

    #[cfg(unix)]
    #[test]
    fn launches_an_executable_directly() {
        let command = launch("/bin/sleep").unwrap();
        assert_eq!(command.get_program(), "/bin/sleep");
        assert_eq!(command.get_args().count(), 0);
        assert!(launch("/etc/hosts").is_err());
        assert!(launch("/bin").is_err());
        assert!(launch("bin/sleep").is_err());
        assert!(launch("/bin/missing").is_err());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn launches_an_app_bundle_through_open() {
        let dir = std::env::temp_dir().join(format!("keyhall-apps-{}", std::process::id()));
        let app = dir.join("Game.app");
        std::fs::create_dir_all(&app).unwrap();
        let command = launch(&format!("{}/", app.display())).unwrap();
        assert_eq!(command.get_program(), "/usr/bin/open");
        assert!(command.get_args().eq(["-W", "-a", app.to_str().unwrap()]));
        assert!(launch(dir.join("Missing.app").to_str().unwrap()).is_err());
    }
}
