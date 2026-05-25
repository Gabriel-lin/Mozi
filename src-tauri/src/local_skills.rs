//! List skills under `~/.Mozi/skills` and `~/.agents/skills` (any directory containing `SKILL.md`),
//! for Tauri — reads the *actual* user home, not the API server's environment.

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::PathBuf;

const IGNORE_DIR_NAMES: &[&str] = &[
    "node_modules",
    ".git",
    "__pycache__",
    ".cache",
    "dist",
    "build",
    ".next",
    "vendor",
];

#[derive(Debug, Clone, Serialize)]
pub struct LocalSkillItem {
    pub id: String,
    pub label: String,
    /// Each entry: `"mozi"` or `"agents"`.
    pub sources: Vec<String>,
}

fn home_dir() -> Result<PathBuf, String> {
    if let Some(h) = std::env::var_os("HOME") {
        return Ok(PathBuf::from(h));
    }
    if let Some(h) = std::env::var_os("USERPROFILE") {
        return Ok(PathBuf::from(h));
    }
    Err("HOME (or USERPROFILE) is not set".to_string())
}

fn is_ignored_path_component(name: &str) -> bool {
    IGNORE_DIR_NAMES.contains(&name)
        || (name.starts_with('.') && name != "." && name != "..")
}

fn loose_path_skill_id(s: &str) -> bool {
    let t = s.trim().trim_matches('/');
    if t.is_empty() {
        return false;
    }
    for part in t.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return false;
        }
        if part.starts_with('.') {
            return false;
        }
    }
    true
}

fn read_skill_title(skill_md: &std::path::Path) -> Option<String> {
    let text = fs::read_to_string(skill_md).ok()?;
    for line in text.lines() {
        let line = line.trim();
        if let Some(stripped) = line.strip_prefix('#') {
            let t = stripped.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn collect_from_root(
    base: &std::path::Path,
) -> io::Result<Vec<(String, String)>> {
    let mut out: Vec<(String, String)> = Vec::new();
    if !base.is_dir() {
        return Ok(out);
    }
    visit(base, base, &mut out)?;
    Ok(out)
}

fn visit(
    base: &std::path::Path,
    current: &std::path::Path,
    out: &mut Vec<(String, String)>,
) -> io::Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if is_ignored_path_component(&name) {
            continue;
        }
        let smd = path.join("SKILL.md");
        if smd.is_file() {
            if let Some(rel) = path.strip_prefix(base).ok() {
                let rid = rel.to_string_lossy().replace('\\', "/");
                if loose_path_skill_id(&rid) {
                    let label = read_skill_title(&smd).unwrap_or_else(|| rid.clone());
                    out.push((rid, label));
                }
            }
        }
        visit(base, &path, out)?;
    }
    Ok(())
}

/// Scan `~/.Mozi/skills` and `~/.agents/skills` on the machine where the Tauri app runs.
#[tauri::command]
pub fn list_local_agent_skills() -> Result<Vec<LocalSkillItem>, String> {
    let home = home_dir()?;
    let mozi = home.join(".Mozi").join("skills");
    let agents = home.join(".agents").join("skills");

    let from_mozi = collect_from_root(&mozi).map_err(|e: io::Error| e.to_string())?;
    let from_agents = collect_from_root(&agents).map_err(|e: io::Error| e.to_string())?;

    // id -> (label, sources)
    let mut m: HashMap<String, (String, HashSet<String>)> = HashMap::new();

    for (id, label) in from_mozi {
        m.entry(id)
            .and_modify(|(l, srcs)| {
                if l.is_empty() {
                    *l = label.clone();
                }
                srcs.insert("mozi".to_string());
            })
            .or_insert((label, {
                let mut s = HashSet::new();
                s.insert("mozi".to_string());
                s
            }));
    }
    for (id, label) in from_agents {
        m.entry(id)
            .and_modify(|(l, srcs)| {
                if l.is_empty() {
                    *l = label.clone();
                }
                srcs.insert("agents".to_string());
            })
            .or_insert((label, {
                let mut s = HashSet::new();
                s.insert("agents".to_string());
                s
            }));
    }

    let mut v: Vec<LocalSkillItem> = m
        .into_iter()
        .map(|(id, (label, srcs))| {
            let mut sources: Vec<String> = srcs.into_iter().collect();
            sources.sort();
            LocalSkillItem { id, label, sources }
        })
        .collect();
    v.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(v)
}
