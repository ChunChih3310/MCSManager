# Rust WebRCON

MCSManager can send console commands through Rust WebRCON when the instance's RCON protocol is set to **WebRCON (Rust)**. Existing instances continue to use Source RCON unless the protocol is changed.

Rust must be started with `+rcon.web 1`, a dedicated `+rcon.port`, and `+rcon.password`. MCSManager's RCON host, port, and password must match those values. The RCON host is resolved by the **daemon**, not by the browser or the game container.

Only administrators can select Rust WebRCON or change its RCON settings. Assigned users can still send commands through the instance console. The daemon enforces this restriction during configuration updates: a WebSocket handshake is an HTTP request, so letting tenants choose its destination would expose internal HTTP services to requests from the daemon. Existing Source RCON permissions are unchanged. Update both the panel and daemon to apply this policy; older panels do not send the user's restriction to the daemon.

For a Docker instance on the same host as the daemon, map the RCON TCP port only to the host loopback address, for example `127.0.0.1:28016:28016/tcp`. Do not forward the RCON port on the router or expose it publicly: Rust WebRCON uses unencrypted WebSocket (`ws://`) and authenticates using the password in the URL path.

Use a long, randomly generated alphanumeric password. URL encoding of special characters is covered by client tests, but authentication with such passwords has not been verified against a real Rust server.

Stop the instance before enabling RCON or switching its protocol in MCSManager. Changing Rust's startup options or Docker port mapping also requires a Rust restart. A close before a reply or a response timeout does **not** prove that a command failed, so MCSManager does not retry commands automatically. An explicit send failure is always reported, including during shutdown. A close during shutdown is ignored only after the local write succeeds; this does not confirm Rust executed the command. Set the instance stop command to a Rust command such as `quit` to send it over WebRCON; `^c` retains MCSManager's special process-interrupt behavior.
