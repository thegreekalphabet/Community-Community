# 🌟 Community Connect

**A comprehensive, real-time community help network application connecting neighbors, volunteers, and organizations out of a strong spirit of localized aid and shared solidarity.**

---

## 🎯 Objective

The primary objective of **Community Connect** is to create a seamless, localized micro-volunteering ecosystem. When crises hit or minor neighborly inconveniences occur, speed is of the essence. Our platform empowers individuals to efficiently request immediate help—whether it's an urgent medical need like blood donation, finding shelter, or requesting basic groceries. In return, helpers earn respect within the network through our highly gamified "Karma" system.

## 📖 Overview

**Community Connect** bridges the gap between those in urgent need and the generous volunteers nearby. Built with a responsive, modern HTML/CSS/JS frontend interface and a robust Node.js/Express backend paired with a MySQL database, it provides a stable and secure environment for coordinating assistance. 

Every request features an **Urgency Score**, calculated dynamically based on constraints, severity, and the user's trust level. Users engage by offering assistance, sharing requests, or verifying organizations, driving a genuine, impactful localized network.

---

## ✨ Features

- **🔐 User Registration & Authentication:** Secure session-based auth flow combined with email/password logins and password reset functionality.
- **📍 Real-Time Requests Feed:** Browse a real-time feed categorized by tags (🩸 Blood, 💊 Medical, 🍱 Food, 🏠 Shelter, 🤝 Volunteer, 📦 Other).
- **🚨 Dynamic Urgency Scoring:** Algorithm intelligently sorts requests in the feed combining factors like time remaining, category weight, and severity context.
- **❤️ Seamless Interactions:** "Like," "Share," and "Commit Help" functionality dynamically updates directly on UI.
- **🌟 Karma & Trust System:** Fulfill requests, increase your track record, step up from *Newcomer* to *Legend*, and boost the visibility of your own requests.
- **⚖️ Community Moderation (Flags):** Users can flag inappropriate or spammy requests, temporarily sending them to a moderation queue if flagged enough.
- **📱 Responsive, Premium UI/UX:** Built with a sophisticated, pristine modern design language featuring fluid animations, accessible contrasts, and crisp typography.

---

## 🚀 Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Backend:** Node.js, Express.js.
- **Database:** MySQL.
- **Sessions & Auth:** `express-session`, `uuid`.

---

## 🛠️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v14 or higher)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/)

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/yourusername/community-connect.git
cd community-connect

# Install dependencies
npm install
```

### 2. Environment Configuration
Create or modify the `.env` file in the root directory. Fill in your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_secure_password
DB_NAME=community_connect
PORT=3000
```

### 3. Database Initialization
Automatically create schemas, users, posts, responses, and tokens tables safely:
```bash
npm run setup-db
```

### 4. Start the Application!
```bash
npm start
```
Open your browser and navigate to `http://localhost:3000`.

---

## 🗄️ Database Schema

The platform primarily utilizes the following robust relational tables:

- **`users`**: Manages accounts. Tracks karma, trust scores, roles, and verification status.
- **`posts`**: Captures help requests. Incorporates category type, severity, location, status, flags, and an expiry timestamp.
- **`post_responses`**: Connects responders (`users`) to specific `posts`, confirming the help loop.
- **`post_likes`**: Standard metric matrix keeping track of like records on requests.
- **`password_reset_tokens`**: Facilitates secure password resets safely using UUID-based expiring URLs.

---

## 📡 API Endpoints 

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register a new user |
| `POST` | `/api/login` | Authenticate an existing user |
| `GET` | `/api/auth/status` | Verify if session exists & active user info |
| `POST` | `/api/password-reset-request` | Sends reset token via logic handling |
| `GET` | `/api/posts` | Fetch posts mapped by category/severity/location |
| `POST` | `/api/posts` | Publish a new community help request |
| `POST` | `/api/posts/:id/respond` | Mark user intent natively to assist |
| `POST` | `/api/posts/:id/confirm` | Poster validates the help natively, rewarding Karma |
| `POST` | `/api/posts/:id/like` | Toggles the like on a specific request |
| `POST` | `/api/posts/:id/flag` | Flags a post for moderation |
| `GET` | `/api/users/:id/karma` | Detailed check on Karma score metrics |

---

## 💡 The Karma & Trust Ecosystem

Active helpers move up ranks giving them better reputation visually and higher weighted algorithm priority if they themselves need to post a request. The system rewards varying amounts based on the `Severity` of the request they resolved:

- **Standard Help:** +10 Karma points (+ 20 completion bonus)
- **Urgent Help:** +30 Karma points (+ 20 completion bonus)
- **Critical Help:** +50 Karma points (+ 20 completion bonus)

**Rankings:**

🏆 `Newcomer` ➔ 🎖️ `Helper` (100+) ➔ 🛡️ `Advocate` (500+) ➔ 🦸 `Guardian` (1500+) ➔ 👑 `Legend` (5000+)

> *Through shared kindness and an intent to assist, we redefine the modern neighborhood.*