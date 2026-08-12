# Deploy ReqFlow ke VPS

Stack: Docker Compose — `pocketbase` (backend+DB, port host `8090`) + `web`
(frontend static, nginx, port host `8091`). Gak ada reverse proxy/domain
di repo ini — itu diatur dari panel VPS (aaPanel dll), bukan bagian
compose stack.

## Prasyarat

- Docker + Docker Compose plugin terinstall di VPS.
- Port 8090 dan 8091 kosong di host (`ss -tlnp | grep -E ':8090|:8091'`).

## Langkah

1. **Clone repo ke VPS**

   ```bash
   git clone <url-repo-ini> reqflow
   cd reqflow
   ```

2. **(Opsional) Setup Discord + Notion integration**

   ```bash
   cp .env.example .env
   ```

   Isi `.env` kalau mau notif Discord (request baru + status berubah) dan
   auto-push ke Notion (pas approved). Kosongin/skip kalau belum perlu —
   app tetap jalan normal, cuma gak ngirim notif/push.

3. **Jalankan stack**

   ```bash
   docker compose up -d --build
   ```

4. **Setup reverse proxy dari aaPanel (atau panel lain)**

   Karena nginx panel jalan native di host (bukan container), dari panel
   tinggal reverse-proxy ke port yang udah di-publish:
   - Domain root (`/`) → `http://127.0.0.1:8091` (frontend)
   - Path `/api/*` dan `/_/*` → `http://127.0.0.1:8090` (PocketBase API +
     Admin UI) — **kalau mau 1 domain buat FE+BE**. Kalau mau subdomain
     beda buat API (`api.domain.com` → `127.0.0.1:8090`), rebuild web
     dengan `VITE_POCKETBASE_URL=https://api.domain.com` di-set sebelum
     `docker compose build web`.
   - SSL: pake fitur Let's Encrypt bawaan panel buat domain itu — bukan
     tanggung jawab stack ini.

5. **Buat admin account PocketBase pertama kali**

   Buka `http://127.0.0.1:8090/_/` (atau URL publik `/_/` setelah proxy
   kepasang), bikin akun admin (email + password). Ini akun admin
   PocketBase — beda dari user `it_admin` di app.

6. **(Opsional) Setup Google Sign-In**

   Di Admin UI → Settings → Auth Providers → Google:
   - Daftar OAuth2 client di [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   - Redirect URI: `https://domain-lo.com/api/oauth2-redirect`
   - Masukin Client ID + Client Secret, aktifkan toggle.

7. **Promote user pertama jadi IT/Admin**

   Setelah ada yang signup lewat app, buka Admin UI → Collections →
   `users` → klik record user itu → ubah field `role` jadi `it_admin` →
   Save.

## Redeploy setelah update kode

```bash
git pull
docker compose up -d --build
```

Data PocketBase (`pb_data` volume) persist lintas rebuild/restart — gak
hilang kecuali `docker compose down -v`.

## Cek status / troubleshooting

```bash
docker compose ps
docker compose logs -f pocketbase   # cek migration/schema apply
docker compose logs -f web
```
