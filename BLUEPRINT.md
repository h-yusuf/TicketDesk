# ReqFlow

> From Request to Resolution.

ReqFlow adalah internal request management system yang memungkinkan user
mengajukan request, memantau status pengajuan, dan menerima update proses
request secara terstruktur.

Sistem digunakan sebagai penghubung antara User, IT/Admin, Firebase,
AI processing, dan Notion.

---

# 1. Project Overview

## Problem

Saat ini request internal biasanya dikirim melalui:

- WhatsApp
- Email
- Chat
- Form manual

Akibatnya:

- Request sulit dilacak
- Status tidak transparan
- History request tersebar
- Format request tidak konsisten
- IT sulit melakukan tracking
- Informasi yang masuk ke Notion sering tidak terstruktur

## Solution

ReqFlow menyediakan satu tempat untuk:

1. User login
2. User membuat request
3. IT melakukan review
4. Request disetujui / ditolak / diminta revisi
5. Request yang disetujui diproses AI
6. AI merapikan request
7. Request dikirim ke Notion
8. IT memproses request melalui Notion
9. Status disinkronkan kembali ke aplikasi
10. User dapat melihat progress request

---

# 2. Main Flow

```text
User
  |
  v
Login
  |
  v
Dashboard
  |
  v
Create Request
  |
  v
Firestore
  |
  v
IT Review
  |
  +--------------------+
  |                    |
  v                    v
Reject               Approve
  |                    |
  v                    v
Rejected           AI Processing
                       |
                       v
                  Notion API
                       |
                       v
                    Notion
                       |
                       v
                 IT Processing
                       |
                       v
               Status Update
                       |
                       +------------------+
                       v                  v
                   Firestore         Discord Webhook
                       |             (notify channel:
                       v              new request +
                    User              status change)

```

---

# 3. Discord Notification

- Trigger: Cloud Function on Firestore `requests` write (create) & status field change.
- Channel: existing Discord channel via **Webhook URL** (not bot token).
- Secret: `DISCORD_WEBHOOK_URL` stored as env var / Firebase Functions config — never committed to repo.
- Payload: request id, title, requester, status, timestamp.



                    