# Deploy ReqFlow ke VPS

Stack: Docker Compose — `pocketbase` (backend) + `web` (frontend static, nginx) + `caddy` (reverse proxy + auto HTTPS).

## Prasyarat

- VPS Ubuntu/Debian dengan domain sudah diarahkan (A record) ke IP VPS.
- Docker + Docker Compose plugin terinstall di VPS.
- Port 80 dan 443 kosong (belum dipakai service lain).

## Langkah

1. **Clone repo ke VPS**

   ```bash
   git clone <url-repo-ini> reqflow
   cd reqflow
   ```

2. **Buat file `.env`** di root repo (jangan commit file ini):

   ```bash
   cp .env.example .env
   ```

   Edit `.env`, isi domain asli:

   ```
   DOMAIN=domain-lo.com
   ```

3. **Jalankan stack**

   ```bash
   docker compose up -d --build
   ```

   Caddy otomatis provision HTTPS (Let's Encrypt) buat domain di atas — pastikan DNS domain udah propagate sebelum langkah ini, kalau belum Caddy bakal retry otomatis.

4. **Buat admin account PocketBase pertama kali**

   Buka `https://domain-lo.com/_/` di browser, ikuti form buat akun admin (email + password). Ini akun admin PocketBase (beda dari user `it_admin` di app — admin PocketBase punya akses penuh ke semua data lewat Admin UI).

5. **(Opsional) Setup Google Sign-In**

   Di Admin UI → Settings → Auth Providers → Google:
   - Daftar OAuth2 client di [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (jenis "Web application").
   - Redirect URI: `https://domain-lo.com/api/oauth2-redirect`
   - Masukin Client ID + Client Secret ke Admin UI, aktifkan toggle.

6. **Promote user pertama jadi IT/Admin**

   Setelah ada yang signup lewat app (`https://domain-lo.com`), buka Admin UI → Collections → `users` → klik record user itu → ubah field `role` jadi `it_admin` → Save.

## Redeploy setelah update kode

```bash
git pull
docker compose up -d --build
```

Data PocketBase (`pb_data` volume) dan sertifikat Caddy (`caddy_data` volume) persist lintas rebuild/restart — gak hilang kecuali `docker compose down -v`.

## Cek status / troubleshooting

```bash
docker compose ps
docker compose logs -f caddy       # cek proses HTTPS provisioning
docker compose logs -f pocketbase  # cek migration/schema apply
```
