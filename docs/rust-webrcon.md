# Rust WebRCON

MCSManager can send console commands through Rust WebRCON when the instance's RCON protocol is set to **WebRCON (Rust)**. Existing instances continue to use Source RCON unless the protocol is changed.

Rust must be started with `+rcon.web 1`, a dedicated `+rcon.port`, and `+rcon.password`. MCSManager's RCON host, port, and password must match those values. The RCON host is resolved by the **daemon**, not by the browser or the game container.

For a Docker instance on the same host as the daemon, map the RCON TCP port only to the host loopback address, for example `127.0.0.1:28016:28016/tcp`. Do not forward the RCON port on the router or expose it publicly: Rust WebRCON uses unencrypted WebSocket (`ws://`) and authenticates using the password in the URL path.

Stop the instance before enabling RCON or switching its protocol in MCSManager. Changing Rust's startup options or Docker port mapping also requires a Rust restart. A close before a reply or a response timeout does **not** prove that a command failed, so MCSManager does not retry commands automatically. Set the instance stop command to a Rust command such as `quit` to send it over WebRCON; `^c` retains MCSManager's special process-interrupt behavior.
