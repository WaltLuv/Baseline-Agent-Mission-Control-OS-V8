# Hermes VPS — hardening before live pairing

> **Do this BEFORE pairing Hermes VPS to Mission Control.** The pairing flow
> itself never needs SSH credentials (it uses a one-time runtime key + curl
> handshake — see `VPS_HERMES_PAIRING.md`). But the VPS host must be hardened
> first: a Production Controller for 24 maintenance pipelines must not be
> reachable over `root` + password on a public IP.
>
> **No SSH credentials, root passwords, IPs, or tokens are stored in Mission
> Control, this repo, MEMORY.md, logs, screenshots, or env examples.** This
> doc is procedure only.

---

## Why

A runtime that can orchestrate agents and run pipelines is high-value. If it's
reachable via `root` login with a weak/shared password, a single guess owns the
whole agent ecosystem. Harden the host, then pair via the key handshake.

## Checklist (run on the VPS as the current admin)

### 1. Create a non-root deploy user
```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy        # or a more restricted group/sudoers entry
```

### 2. Add your SSH public key for that user
From your laptop:
```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<vps-host>
# or manually append the pubkey to /home/deploy/.ssh/authorized_keys (chmod 600)
```
Confirm you can log in as `deploy` with the key **before** the next step.

### 3. Disable password login (key-only)
In `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
```

### 4. Disable root SSH login
In `/etc/ssh/sshd_config`:
```
PermitRootLogin no
```
Then reload: `systemctl reload sshd` (keep your current session open; test a new
login in a second terminal before closing).

### 5. Enable a firewall (default-deny inbound)
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH            # or: ufw allow <ssh-port>/tcp
ufw enable
```

### 6. Restrict exposed ports
Only expose what's required. The Hermes agent reaches **out** to Mission
Control for handshake/heartbeat — it does **not** need a public inbound port for
pairing. If a management/HTTP port must be exposed, bind it to localhost and
reach it via an SSH tunnel, or restrict the source with `ufw allow from <ip>`.
Audit with `ss -tulpn`.

### 7. Store the Hermes runtime key safely
After minting the pairing key in Mission Control (`/app/runtimes` → Hermes VPS →
Generate pairing key), put it in a root-only env file — never in shell history,
a repo, or a chat:
```bash
install -m 600 -o root -g root /dev/null /etc/hermes-vps.env
# edit /etc/hermes-vps.env:
#   MC_URL=https://<your-mc-host>
#   MC_API_KEY=mca_...        # the one-time key from Mission Control
#   RUNTIME_KIND=hermes-vps
#   HERMES_WORKSPACE=/opt/data/profiles/slim-charles
set -a; source /etc/hermes-vps.env; set +a   # current shell only; never echo
```

### 8. Rotate any exposed root password
If the box ever had a weak/shared root password (e.g. a default from
provisioning), rotate it now and **remove it from anywhere it was written**.
With root SSH disabled and password auth off, password login is no longer a
remote vector — but rotate anyway for console/recovery access.

### 9. Verify heartbeat from Hermes VPS
Run the curl handshake from `VPS_HERMES_PAIRING.md`, then in Mission Control →
`/app/runtimes` confirm the **Hermes VPS** card flips to **Connected** with a
recent `last seen`. The card never shows Connected without a real heartbeat.

---

## Standing rules

- Never paste a root password into Mission Control (there is no field for it,
  by design).
- Never commit, log, screenshot, or store SSH credentials / the runtime key.
- The runtime key is shown **once** at mint; it lives only in
  `/etc/hermes-vps.env` (chmod 600) on the VPS and as a SHA-256 hash in
  Mission Control's `agent_api_keys`.
- Revoke instantly from the Hermes VPS card ("Revoke runtime") if the host is
  ever suspected compromised — this revokes the key and drops the registry row,
  so further handshakes get 401.

*Pairing mechanics: `docs/security/VPS_HERMES_PAIRING.md`. UI:
`src/components/runtimes/hermes-vps-card.tsx`.*
