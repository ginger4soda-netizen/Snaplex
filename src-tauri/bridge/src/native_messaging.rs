use serde::Serialize;
use serde_json::Value;
use std::io::{self, ErrorKind, Read, Write};

pub const CHROME_TO_BRIDGE_MAX_BYTES: u32 = 1024 * 1024;
pub const DESKTOP_TO_BRIDGE_MAX_BYTES: u32 = 64 * 1024 * 1024;

pub fn read_json_message<R: Read>(reader: &mut R, max_size: u32) -> io::Result<Option<Value>> {
    let mut len_buf = [0_u8; 4];
    match reader.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error),
    }

    let len = u32::from_le_bytes(len_buf);
    if len > max_size {
        drain_message(reader, len)?;
        return Err(io::Error::new(
            ErrorKind::InvalidData,
            format!("message exceeds {} byte limit", max_size),
        ));
    }

    let mut payload = vec![0_u8; len as usize];
    reader.read_exact(&mut payload)?;
    let value = serde_json::from_slice(&payload).map_err(|error| {
        io::Error::new(
            ErrorKind::InvalidData,
            format!("invalid JSON message: {error}"),
        )
    })?;
    Ok(Some(value))
}

pub fn write_json_message<W: Write, T: Serialize>(writer: &mut W, value: &T) -> io::Result<()> {
    let payload = serde_json::to_vec(value).map_err(|error| {
        io::Error::new(
            ErrorKind::InvalidData,
            format!("failed to encode JSON message: {error}"),
        )
    })?;
    if payload.len() > u32::MAX as usize {
        return Err(io::Error::new(
            ErrorKind::InvalidData,
            "message exceeds Native Messaging frame size",
        ));
    }
    writer.write_all(&(payload.len() as u32).to_le_bytes())?;
    writer.write_all(&payload)?;
    writer.flush()
}

fn drain_message<R: Read>(reader: &mut R, len: u32) -> io::Result<()> {
    let mut limited = reader.take(len as u64);
    io::copy(&mut limited, &mut io::sink())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{read_json_message, write_json_message};
    use serde_json::json;

    #[test]
    fn round_trips_length_prefixed_json() {
        let mut bytes = Vec::new();
        write_json_message(&mut bytes, &json!({ "kind": "ping" })).unwrap();

        let value = read_json_message(&mut bytes.as_slice(), 1024)
            .unwrap()
            .unwrap();

        assert_eq!(value, json!({ "kind": "ping" }));
    }

    #[test]
    fn eof_before_frame_returns_none() {
        let value = read_json_message(&mut [].as_slice(), 1024).unwrap();
        assert!(value.is_none());
    }
}
