use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Session {
    pub coordinate: String,
    pub start: u64,
    pub end: u64,
}

/// Play time: one session per game window, from opening to closing, idle time included.
/// Open sessions are checkpointed on every tick, so a crash loses at most one tick.
pub struct Meter {
    path: PathBuf,
    sessions: Vec<Session>,
    open: HashMap<String, usize>,
}

pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

impl Meter {
    pub fn load(path: PathBuf) -> Self {
        let sessions = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            path,
            sessions,
            open: HashMap::new(),
        }
    }

    pub fn start(&mut self, label: &str, coordinate: &str, at: u64) {
        self.open.insert(label.into(), self.sessions.len());
        self.sessions.push(Session {
            coordinate: coordinate.into(),
            start: at,
            end: at,
        });
        self.save();
    }

    pub fn tick(&mut self, at: u64) -> &[Session] {
        for &i in self.open.values() {
            self.sessions[i].end = at;
        }
        if !self.open.is_empty() {
            self.save();
        }
        &self.sessions
    }

    pub fn stop(&mut self, label: &str, at: u64) {
        if let Some(i) = self.open.remove(label) {
            self.sessions[i].end = at;
            self.save();
        }
    }

    fn save(&self) {
        let partial = self.path.with_extension("json.partial");
        let _ = self.path.parent().map(std::fs::create_dir_all);
        if let Ok(json) = serde_json::to_vec(&self.sessions)
            && std::fs::write(&partial, json).is_ok()
        {
            let _ = std::fs::rename(&partial, &self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("keyhall-meter-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join("playtime.json")
    }

    #[test]
    fn counts_the_whole_time_a_game_window_is_open() {
        let mut meter = Meter::load(store("open"));
        meter.start("game-1", "31990:a:chess", 100);
        meter.start("game-2", "31990:a:words", 150);
        meter.tick(160);
        meter.stop("game-1", 400);
        assert_eq!(
            meter.tick(500),
            [
                Session {
                    coordinate: "31990:a:chess".into(),
                    start: 100,
                    end: 400
                },
                Session {
                    coordinate: "31990:a:words".into(),
                    start: 150,
                    end: 500
                },
            ]
        );
    }

    #[test]
    fn keeps_play_time_across_restarts_and_crashes() {
        let path = store("restart");
        let mut meter = Meter::load(path.clone());
        meter.start("game-1", "31990:a:chess", 100);
        meter.stop("game-1", 200);
        meter.start("game-1", "31990:a:chess", 300);
        meter.tick(330);
        drop(meter);

        let mut restarted = Meter::load(path);
        let sessions = restarted.tick(1000).to_vec();
        assert_eq!(
            sessions
                .iter()
                .map(|s| (s.start, s.end))
                .collect::<Vec<_>>(),
            [(100, 200), (300, 330)]
        );
        restarted.stop("game-1", 1000);
        assert_eq!(restarted.tick(1000)[1].end, 330);
    }
}
