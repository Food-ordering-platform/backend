# 🍔 ChowEazy Backend API

> The official backend REST API for **ChowEazy** — a comprehensive, multi-tenant food ordering and logistics platform.

This system acts as the central engine coordinating a three-way marketplace between **Customers**, **Vendors (Restaurants)**, and **Riders (Logistics)**, complete with real-time tracking, automated financial ledgers, and dynamic distance-based pricing.

---

## ✨ System Features

### 🔐 Authentication & Authorization

- **Multi-Role RBAC:** Dedicated access controls for `CUSTOMER`, `VENDOR`, `RIDER`, and `ADMIN`.
- **Hybrid Authentication:** Supports both standard Email/Password (hashed via `bcrypt`) and seamless Google OAuth integrations.
- **Token Sessions:** Json web tokens for secure, persistent logins across Web and Mobile clients.
- **OTP Verification:** Robust One-Time Password generation and validation for email/phone verification and logistics handoffs.

---

### 🍕 Marketplace & Order Management

- **Vendor Storefronts:** Restaurants can manage their open/close status, prep times, menu categories, and item availability.
- **Order State Machine:** Strict, automated order transitions:

  ```
  PENDING ➔ PREPARING ➔ READY_FOR_PICKUP ➔ RIDER_ACCEPTED ➔ OUT_FOR_DELIVERY ➔ DELIVERED
  ```
  
- **Media Management:** Direct image uploads for user avatars and menu items via **Cloudinary** and **Multer**.

---

### 🛵 Logistics & Dispatch

- **Geospatial Distance Calculation:** Uses the Haversine formula (`src/utils/haversine.ts`) to calculate accurate distances between restaurants and customers for dynamic delivery fee generation.
- **Secure Last-Mile Handoff:** System generates a secure `deliveryCode` (OTP) that customers must provide to riders to mark an order as `DELIVERED`.
- **Rider Earnings:** Automated calculation and logging of rider delivery payouts upon successful trips.

---

### 💳 Financial Ledger & Payments

- **Centralized Transactions:** A robust `Transaction` table acts as a ledger tracking credits/debits for Orders, Delivery Fees, Platform Fees, and Withdrawals.
- **Webhook Processing:** Raw body parsing configured specifically for secure payment gateway webhook validation (`src/payment/payment.controller.ts`).
- **Idempotency:** Unique `idempotencyKey` and reference tokens to prevent duplicate charges and race conditions during payment processing.

---

### 🔔 Notifications

Omnichannel delivery across:

- 📧 **Email** — Nodemailer
- 📱 **Mobile Push** — using Expo Server SDK
---

## 📂 Project Structure (monolithic architecture)

```

```
```

│   
├── prisma/
│   ├── migrations/               # Auto-generated migration history
│   ├── schema.prisma             # Database schema & relationships
│   └── seed.ts                   # Database seeder for initial data
├── src/
│   ├── admin/                    # Admin oversight & platform analytics
│   │   ├── admin.controller.ts   # Handles admin HTTP requests
│   │   ├── admin.service.ts      # Business logic (stats, moderation)
│   │   ├── admin.route.ts        # Admin route definitions
│   │   └── admin.validator.ts    # Request body validation schemas
│   │
│   ├── auth/                     # Registration, login, OAuth & OTP
│   │   ├── auth.controller.ts    # Handles auth HTTP requests
│   │   ├── auth.service.ts       # Business logic (JWT, bcrypt, OAuth)
│   │   ├── auth.route.ts         # Auth route definitions
│   │   └── auth.validator.ts     # Login/register validation schemas
│   │
│   ├── order/                    # Order placement, checkout & state machine
│   │   ├── order.controller.ts   # Handles order HTTP requests
│   │   ├── order.service.ts      # Business logic (state transitions, pricing)
│   │   ├── order.route.ts        # Order route definitions
│   │   └── order.validator.ts    # Order creation validation schemas
│   │
│   ├── payment/                  # Payment initialization & webhooks
│   │   ├── payment.controller.ts # Handles payment & webhook HTTP requests
│   │   ├── payment.service.ts    # Business logic (ledger, idempotency)
│   │   ├── payment.route.ts      # Payment route definitions
│   │   └── payment.validator.ts  # Payment request validation schemas
│   │
│   ├── restuarant/               # Vendor menu, store settings & availability
│   │   ├── restaurant.controller.ts  # Handles restaurant HTTP requests
│   │   ├── restaurant.service.ts     # Business logic (menu, availability)
│   │   ├── restaurant.route.ts       # Restaurant route definitions
│   │   └── restaurant.validator.ts   # Menu & store validation schemas
│   │
│   ├── rider/                    # Delivery dispatch, acceptance & completion
│   │   ├── rider.controller.ts   # Handles rider HTTP requests
│   │   ├── rider.service.ts      # Business logic (dispatch, earnings, OTP)
│   │   ├── rider.route.ts        # Rider route definitions
│   │   └── rider.validator.ts    # Delivery action validation schemas
│   │
│   ├── vendor/                   # Vendor dashboards & metrics
│   │   ├── vendor.controller.ts  # Handles vendor HTTP requests
│   │   ├── vendor.service.ts     # Business logic (analytics, payouts)
│   │   ├── vendor.route.ts       # Vendor route definitions
│   │   └── vendor.validator.ts   # Vendor request validation schemas
│   │
│   ├── cloudinary/               # Image upload configuration
│   │   └── cloudinary.config.ts  # Multer + Cloudinary setup
│   │
│   ├── config/                   # Core app configurations
│   │   └── pricing.config.ts     # Dynamic delivery pricing rules
│   │
│   ├── utils/                    # Shared helpers & clients
│   │   ├── mailer.ts             # Email sending (SendGrid/Resend)
│   │   ├── haversine.ts          # Geospatial distance calculation
│   │   ├── notifications.ts      # Push notification helpers
│   │   └── prisma.ts             # Prisma client singleton
│   │
│   ├── app.ts                    # Express setup, CORS & middlewares
│   └── index.ts                  # HTTP/WebSocket server entry point
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript compiler configuration
```
---
### **3️⃣ Optional: Make it more detailed**
You can show modules/services like:

```mermaid
flowchart TD
    Customer --> API[API Gateway]
    Vendor --> API
    Rider --> API
    API --> Auth[Auth Service]
    API --> Orders[Order Service]
    API --> Payments[Payment Service]
    API --> Notifications[Notification Service]
    Auth --> DB[(PostgreSQL)]
    Orders --> DB
    Payments --> DB
```

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | v20.x or higher |
| PostgreSQL & prisma | v14.x or higher |

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/backend.git
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and populate it with your credentials:

```env
# Server
PORT=4000
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/choweazy?schema=public"

# Security & Sessions
JWT_SECRET="your_super_secret_jwt_key"

# Payments (e.g., Paystack/Flutterwave)
PAYMENT_SECRET_KEY="your_payment_provider_secret"
PAYMENT_WEBHOOK_SECRET="your_webhook_signature_secret"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# Mailing
GMAIL_APP_USERNAME="your_gmail_app_username"
GMAIL_APP_PASSWORD="your_gmail_app_password"
```

### 4. Database Setup (Prisma)

Run migrations to push the schema to your Postgres database and generate the Prisma Client:

```bash
npx prisma generate
npx prisma migrate dev
```

Optionally, seed the database with initial admin accounts and test data:

```bash
npm run seed
```

### 5. Start the Server

**Development Mode (Hot Reloading):**

```bash
npm run dev
```

**Production Build:**

```bash
npm run build
npm start
```

---


---

## 🛡️ Security & Error Handling

- **Error Handler:** Standardizes all API responses. Automatically catches CORS issues and Multer `LIMIT_FILE_SIZE` exceptions ensuring the server never crashes on bad input.
- **Hybrid CORS:** Explicitly whitelisted domains for Web clients, Admin Dashboards, and Mobile apps.
- **Input Validation:** Incoming request bodies are strictly validated using **Zod** (`src/**/*.validator.ts`) before hitting the controllers.

---

<div align="center">
  Built with ❤️ for the <strong>ChowEazy</strong> Ecosystem
</div>
