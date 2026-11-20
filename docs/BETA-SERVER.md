# Realm's beta server

One rented Linux server runs Realm for the closed beta (Google Play's 12+ testers, and the website
at the same time). The database stays on **Neon**, uploads on **Cloudflare R2** and email on
**Resend**, so the server only runs Realm itself, Valkey (online status, rate limits, the job queue),
LiveKit (voice and video) and Caddy (https).

Files: `infra/beta/` (`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.example`).

| Address | What answers |
|---|---|
| `https://tomyrealm.com` | the website (its `/api` goes to the API on the same machine) |
| `https://api.tomyrealm.com` | the API for the phone app, and live updates at `/gateway` |
| `https://voice.tomyrealm.com` | voice and video signalling (calls use UDP ports, below) |

The phone app's release build already points at `api.tomyrealm.com` (`frontend/app/eas.json`).

## Where it runs: Oracle Cloud "Always Free"

The first plan was a DigitalOcean server paid with GitHub Student Pack credit, but that offer
ended on 31 July 2026. Realm now uses **Oracle Cloud's Always Free** server instead: an ARM
machine with **2 cores and 12 GB of memory**, free with no end date (Oracle cut the free size from
4 cores / 24 GB in mid-2026). Everything Realm runs has ARM builds, so nothing changes in
`infra/beta/`.

Two things to know:

- **"Out of capacity".** Free ARM machines are popular; making one can fail for a while. Try again
  later, or pick another "availability domain" on the same page.
- **Idle servers get taken back.** Oracle may reclaim an Always Free server whose processor,
  network and memory all stay under 20% for 7 days. Testers using it keeps it busy; if it's ever
  quiet for a week, the fix is upgrading the account to "Pay As You Go" (Always Free things stay
  free) with a budget alert at USD 1. That's the owner's call; ask first.

## What only you can do

1. **Sign up** at oracle.com/cloud/free ("Start for free"). Oracle asks for a card only to check
   you are a real person; an account that is never upgraded can't be charged.
   - **Home region: choose carefully.** It can't be changed later, and the free ARM server only
     exists in the home region. Pick the one closest to most testers.
2. **Make an SSH key on your PC** if there isn't one (`C:\Users\<you>\.ssh\id_ed25519.pub`):
   `ssh-keygen -t ed25519`, pressing Enter at each question.
3. **Make the server:** ☰ menu › Compute › Instances › **Create instance**.
   - Name: `realm-beta`.
   - Image: **Change image › Canonical Ubuntu 24.04** (the normal one, not "Minimal").
   - Shape: **Change shape › Ampere › VM.Standard.A1.Flex**, **2 OCPUs** and **12 GB** memory
     (it says "Always Free-eligible").
   - Networking: let it make a new virtual cloud network with a **public subnet**, and keep
     "Assign a public IPv4 address" on.
   - SSH keys: **Paste public keys**, and paste the line from `id_ed25519.pub`.
   - Boot volume: leave as it is (the free amount is up to 200 GB in total).
4. **Open the doors in Oracle's own firewall:** on the instance page, click the subnet › its
   **Default Security List** › **Add Ingress Rules**, source `0.0.0.0/0`, one rule each:
   TCP `80`, TCP `443`, UDP `443`, TCP `7881`, UDP `3478`, UDP `50000-60000`. (TCP 22 for SSH is
   already there.) Oracle blocks everything else before it reaches the server. Put one port (or
   one range) in each rule; the form's "Allows ... ports: all" line doesn't update while typing,
   so ignore it and check the saved list instead. (Done 2026-11-20.)
5. **Send me the server's public IP address.** With the SSH key in place I can do the rest from
   here, and I will ask before each step that changes something outside this PC.
6. **DNS in Cloudflare** (tomyrealm.com › DNS). Delete the old GoDaddy parking records, then add
   four **A** records pointing at the server's IP, each set to **DNS only** (grey cloud, not
   orange): `@`, `www`, `api`, `voice`. Grey matters: Caddy needs to answer directly to get the
   certificates, and calls can't pass through Cloudflare's proxy. (Done 2026-11-20; `www` is a
   CNAME to the root, which works the same. The email records stay as they are.)

## What I set up on the server

### 1. Basics (done 2026-11-20)

The server is `realm-beta`, public IP `193.122.84.3`, in Saudi Arabia West (Jeddah). Everything is
done as the `ubuntu` user, which signs in with the SSH key only.

```sh
apt update && apt -y upgrade
# automatic security updates
apt -y install unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
# 2 GB of swap so a build never runs out of memory
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

SSH (`/etc/ssh/sshd_config.d/01-realm.conf`): `PasswordAuthentication no`,
`KbdInteractiveAuthentication no`, `PermitRootLogin no`.

### 2. Firewall (done)

Two layers: Oracle's Security List (step 4 above) and the server's own firewall. Oracle's Ubuntu
comes with its own iptables rules (saved by `netfilter-persistent`). They are **kept**, because
they also guard the boot disk and metadata traffic; don't swap them for `ufw`. Realm's ports are
added just before the last "reject everything else" rule, then saved:

```sh
for r in "tcp 80" "tcp 443" "udp 443" "tcp 7881" "udp 3478" "udp 50000:60000"; do
  set -- $r
  at=$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')
  iptables -I INPUT "$at" -p "$1" -m state --state NEW -m "$1" --dport "$2" -j ACCEPT
done
netfilter-persistent save
```

The open doors: 22 (SSH), 80 (certificates and the redirect to https), 443 TCP and UDP (https and
HTTP/3), 7881 TCP (voice fallback for strict networks), 3478 UDP (voice relay) and 50000-60000 UDP
(voice media). Everything else listens on `127.0.0.1` only. All the containers use the server's own
network (`network_mode: host`), so these rules really apply to them (Docker's usual port publishing
would skip the firewall). Save the rules again only before Docker is running, so Docker's own
rules don't get saved with them.

### 3. Docker (done)

Docker Engine 29 and Compose 5 from Docker's own Ubuntu repository (checked with their key), with
logs capped at 3 x 10 MB in `/etc/docker/daemon.json`; `ubuntu` is in the `docker` group.

### 4. The code (done)

The repo `Nightmareidk/Realm` is public, so the server clones it over https with no key:

```sh
git clone https://github.com/Nightmareidk/Realm.git ~/realm
```

Updates are `git pull` in `~/realm`.

### 5. Settings (done 2026-11-20)

The owner chose to reuse the current Neon, Resend and R2 keys. They were copied from the laptop
straight into the server's `infra/beta/.env` (mode 600) without being shown anywhere, and the
temporary copies were deleted. `REALM_SECRET`, `VALKEY_PASSWORD` and the LiveKit key and secret
were made on the server. Safety reports go to the same inbox as alerts. Firebase (the
server key and the website's settings) and Openverse were added the same way later that day.
Maps need no key: Realm uses the free OpenStreetMap maps. The steps below are how it would be
done by hand:


```sh
cd ~/realm
cp infra/beta/.env.example infra/beta/.env && chmod 600 infra/beta/.env
```

Fill it in **on the server**, never in chat:

- `REALM_SECRET`, `VALKEY_PASSWORD`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: made on the server
  with `openssl rand` (commands are in the file).
- Neon, Resend and R2 keys: **make new ones** for the beta rather than reusing the ones pasted into
  chat earlier, then delete the old ones in each service.
- `REALM_E2EE_DMS=off` stays off until end-to-end encryption is finished and checked.

### 6. Cloudflare R2: allow the real website (done 2026-11-20)

In the bucket's **CORS policy**, add `https://tomyrealm.com` to `AllowedOrigins` (methods `PUT`,
`GET`, `HEAD`; header `content-type`). Without it, photo uploads from the website fail. The bucket
`realm-media` is in the **EU** jurisdiction, so in the dashboard it lives under
`R2 › realm-media (EU) › Settings`, and a link without `/eu/` says "Failed to find bucket".
`www` doesn't need its own entry: Caddy sends `www` visitors to `tomyrealm.com`.

### 7. Database changes (0027 applied 2026-11-20, with the owner's yes)

The new code needs the latest database changes on Neon. This step changes the live database, so it
**only runs after you say yes to it on its own**:

```sh
docker compose -f infra/beta/docker-compose.yml --profile tools run --rm migrate
```

### 8. Build and start (live since 2026-11-20)

Start Caddy only after `@`, `www`, `api` and `voice` all resolve to the server (check with
`nslookup <name> 8.8.8.8`) **and** Oracle's Security List has the ports from step 4. If either is
missing, Let's Encrypt times out, and too many failed tries lock a name out for an hour. If that
happens, `docker compose -f infra/beta/docker-compose.yml stop caddy`, fix it, then `start caddy`.

```sh
docker compose -f infra/beta/docker-compose.yml build
docker compose -f infra/beta/docker-compose.yml up -d
docker compose -f infra/beta/docker-compose.yml ps        # everything "running"/"healthy"
curl -s https://api.tomyrealm.com/health                   # {"ok":true}
curl -s https://api.tomyrealm.com/ready                    # {"ok":true} = the database answers
```

Then a check from outside: sign up on the website with a new address, post a photo, send a DM,
start a voice call, and do the same from the phone app's release build.

## Keeping it running

- **Logs:** `docker compose -f infra/beta/docker-compose.yml logs -f api` (or `web`, `gateway`,
  `worker`, `livekit`, `caddy`).
- **Updates:** `git pull`, then the build and `up -d` lines again. Only the changed parts restart.
- **Restarts by themselves:** every service has `restart: unless-stopped`, and comes back after a
  server reboot.
- **Alerts:** server errors and the storage warnings go to `REALM_ALERT_EMAIL`.
- **Backups:** the data that matters is on Neon (its own history and restore points) and R2. The
  server itself holds nothing that can't be rebuilt.
- **Costs:** the Oracle server is Always Free (keep the account un-upgraded, or upgraded with a
  USD 1 budget alert); Neon, R2 and Resend stay on their free plans.
  `REALM_STORAGE_LIMIT_GB` stops uploads before R2's free amount is used up.

## Before real users (after the beta)

- Rotate every key once more and remove any test accounts.
- Turn on Neon's daily backups if the plan allows, and test one restore.
- Limit the Firebase web key to tomyrealm.com (Google Cloud › Credentials), and swap the
  Firebase admin service account for one that may only send notifications.
