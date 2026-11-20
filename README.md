# WedPlan — Wedding Planning Platform (Backend Server)

Robust, secure REST API backend for **WedPlan**, an end-to-end wedding planning platform connecting couples with wedding service vendors, featuring multi-role access control, Stripe subscriptions, booking workflows, and administrative governance.

---

## 🌟 Important Features

- **Role-Based Access Control (RBAC)**: Secure authorization middleware for `customer`, `vendor`, and `admin` roles.
- **JWT Authentication**: Password hashing using bcryptjs, token signing/verification, and blocked-account enforcement.
- **Service Management**:
  - Public browsing, full-text search, multi-category and location filtering, price-based sorting (`price-asc`, `price-desc`, `newest`).
  - Tiered vendor listing limits (Free tier: max 3 active services; Premium tier: unlimited).
  - Admin approval/rejection lifecycle workflow (`pending` -> `approved` / `rejected`).
- **Booking Request Workflow**:
  - Customer booking submissions with date conflict prevention.
  - State machine: `pending` -> `accepted` / `rejected` / `cancelled`.
  - Self-booking restrictions and cancellation rules.
- **Stripe Checkout & Webhook Integration**:
  - Secure checkout sessions for Premium vendor subscriptions ($49.00/yr).
  - Webhook verification for automated subscription activation and transaction ledger tracking.
- **Administrative Governance**:
  - Real-time metrics overview (users, vendors, customers, services, revenue).
  - User moderation (instant block/unblock).
  - Service audits (approve, reject, delete inappropriate listings).
  - Read-only transaction financial audit logs.

---

## 🛠 Technology Stack

- **Runtime & Framework**: Node.js, Express.js
- **Database**: MongoDB (Atlas) via Mongoose ODM
- **Authentication**: JWT (`jsonwebtoken`), `bcryptjs`
- **Payment Processing**: Stripe SDK (`stripe`)
- **Security & Utilities**: `helmet`, `cors`, `dotenv`, `morgan`

---

## 📋 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
CLIENT_URL=http://localhost:3000

# Database
DB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/wedplan

# JWT Authentication
JWT_SECRET=your_jwt_super_secret_key_here
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Evaluation Admin Credentials
ADMIN_EMAIL=admin@wedplan.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=WedPlan Admin
```

---

## 🚀 Installation & Local Setup

```bash
# 1. Clone repository
git clone https://github.com/<your-username>/wedplan-server.git
cd wedplan-server

# 2. Install dependencies
npm install

# 3. Seed initial admin & sample services
npm run seed

# 4. Start development server
npm run dev
# Server will run at http://localhost:5000
```

---

## 🔑 Default Credentials for Evaluation

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@wedplan.com` | `Admin@123456` |
| **Vendor (Premium)** | `vendor@wedplan.com` | `Vendor@123456` |
| **Customer** | `customer@wedplan.com` | `Customer@123456` |

---

## 📡 API Endpoint Overview

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, `GET /api/auth/me`, `PUT /api/auth/profile`
- **Services**: `GET /api/services`, `GET /api/services/featured`, `GET /api/services/categories`, `GET /api/services/:id`, `POST /api/services`, `GET /api/services/vendor/my-services`, `PUT /api/services/:id`, `DELETE /api/services/:id`
- **Bookings**: `POST /api/bookings`, `GET /api/bookings/my-bookings`, `PUT /api/bookings/:id/cancel`, `GET /api/bookings/vendor-requests`, `PUT /api/bookings/:id/respond`
- **Payments**: `POST /api/payments/create-checkout-session`, `POST /api/payments/verify-session`, `POST /api/payments/webhook`, `GET /api/payments/my-transactions`
- **Admin**: `GET /api/admin/overview`, `GET /api/admin/users`, `PUT /api/admin/users/:id/block`, `GET /api/admin/services`, `PUT /api/admin/services/:id/status`, `DELETE /api/admin/services/:id`, `GET /api/admin/transactions`
