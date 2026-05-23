use std::io;
use std::process::Command;

pub fn launch_desktop() -> io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg("-a").arg("Snaplex").spawn()?;
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
