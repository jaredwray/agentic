---
"agentic": minor
---

Require Socket Firewall on every GitHub Actions job

Every workflow job now installs [Socket Firewall Free](https://docs.socket.dev/docs/socket-firewall-free)
via SHA-pinned `SocketDev/action` (`mode: firewall-free`) with `firewall-version` pinned to a
reviewed [sfw-free](https://github.com/SocketDev/sfw-free/releases) release — never `latest`. The
defense-in-depth catalog tracks this as a § 4 item; this repo's CI and check-workflows jobs
dogfood it. `lockdown-repo.sh` always allowlists `SocketDev/*`. Release-management's publish
template and both dependency-management GitHub Actions groups keep the pins current.
