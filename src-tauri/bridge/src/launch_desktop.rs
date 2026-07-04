use std::io;
#[cfg(target_os = "macos")]
use std::path::{Path, PathBuf};
use std::process::Command;

pub fn launch_desktop() -> io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        if let Some(app_bundle) = current_app_bundle() {
            if Command::new("open").arg(&app_bundle).status()?.success() {
                return Ok(());
            }
        }

        let status = Command::new("open").arg("-a").arg("Snaplex").status()?;
        if !status.success() {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "unable to open Snaplex.app by bundle path or application name",
            ));
        }
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", "Snaplex"])
            .spawn()?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        match Command::new("snaplex").spawn() {
            Ok(_) => Ok(()),
            Err(_) => {
                Command::new("gtk-launch").arg("snaplex.desktop").spawn()?;
                Ok(())
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn current_app_bundle() -> Option<PathBuf> {
    std::env::current_exe().ok().and_then(|exe| {
        exe.ancestors()
            .find(|path| is_app_bundle(path))
            .map(Path::to_path_buf)
    })
}

#[cfg(target_os = "macos")]
fn is_app_bundle(path: &Path) -> bool {
    path.extension().and_then(|extension| extension.to_str()) == Some("app")
}
