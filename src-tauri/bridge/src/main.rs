mod launch_desktop;
mod logging;
mod native_messaging;
mod socket_client;

use native_messaging::{read_json_message, write_json_message, CHROME_TO_BRIDGE_MAX_BYTES};
use serde_json::json;
use socket_client::DesktopClient;
use std::io;

const EXTENSION_VERSION_MIN: &str = "0.1.0";

fn main() {
    logging::info("snaplex-bridge starting");
    if let Err(error) = run() {
        logging::warn(format!("bridge fatal: {error}"));
        let _ = write_error("bridge_fatal", &error.to_string());
        eprintln!("snaplex-bridge fatal: {error}");
    }
}

fn run() -> io::Result<()> {
    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();

    write_json_message(
        &mut stdout,
        &json!({
            "kind": "hello",
            "desktop_version": env!("CARGO_PKG_VERSION"),
            "bridge_version": env!("CARGO_PKG_VERSION"),
            "extension_version_min": EXTENSION_VERSION_MIN
        }),
    )?;

    let mut desktop: Option<DesktopClient> = None;

    loop {
        let Some(message) = read_json_message(&mut stdin, CHROME_TO_BRIDGE_MAX_BYTES)? else {
            logging::info("Chrome stdin closed; bridge exiting");
            return Ok(());
        };

        let client = match desktop.as_mut() {
            Some(client) => client,
            None => match DesktopClient::connect_or_launch() {
                Ok(client) => {
                    logging::info(format!(
                        "connected to Snaplex Desktop local socket; instance_id={}, desktop_version={}",
                        client.instance_id(),
                        client.desktop_version()
                    ));
                    desktop = Some(client);
                    desktop.as_mut().unwrap()
                }
                Err(error) => {
                    logging::warn(format!("failed to connect to Snaplex Desktop: {error}"));
                    write_json_message(
                        &mut stdout,
                        &json!({
                            "kind": "error",
                            "code": "desktop_not_responding",
                            "message": format!("Snaplex Desktop did not respond: {error}")
                        }),
                    )?;
                    continue;
                }
            },
        };

        match client.request(&message) {
            Ok(Some(reply)) => write_json_message(&mut stdout, &reply)?,
            Ok(None) => {
                logging::warn("Snaplex Desktop closed the local socket");
                desktop = None;
                write_json_message(
                    &mut stdout,
                    &json!({
                        "kind": "error",
                        "code": "desktop_disconnected",
                        "message": "Snaplex Desktop closed the local socket"
                    }),
                )?;
            }
            Err(error) => {
                logging::warn(format!("Desktop socket I/O error: {error}"));
                desktop = None;
                write_json_message(
                    &mut stdout,
                    &json!({
                        "kind": "error",
                        "code": "desktop_io_error",
                        "message": error.to_string()
                    }),
                )?;
            }
        }
    }
}

fn write_error(code: &str, message: &str) -> io::Result<()> {
    write_json_message(
        &mut io::stdout().lock(),
        &json!({
            "kind": "error",
            "code": code,
            "message": message
        }),
    )
}
