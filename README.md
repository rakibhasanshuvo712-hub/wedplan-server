# WedPlan — Wedding Planning Platform (Backend Server API)

A robust, enterprise-grade REST API backend built with Express.js, MongoDB, Mongoose, and Stripe for **WedPlan**, an end-to-end wedding planning platform connecting couples with wedding service vendors. Features strict server-side role-based access control (RBAC), multi-tiered vendor subscription management with Stripe Checkout and Webhooks, booking state workflows, and administrative governance.

---

## 🔗 Project Links

- **Server Repository**: [https://github.com/your-username/wedplan-server](https://github.com/your-username/wedplan-server)
- **Client Repository**: [https://github.com/your-username/wedplan-client](https://github.com/your-username/wedplan-client)
- **Live Backend API**: `https://api.wedplan.yourdomain.com` (or Railway/Render deployment URL)
- **Live Client Application**: `https://wedplan.yourdomain.com`

---

## 🌟 Important Features

### 1. Role-Based Access Control (RBAC) & Authentication
- **Secure JWT Authentication**: Passwords hashed with bcryptjs (10 salt rounds); JSON Web Tokens with configurable expiration (`7d`).
- **Server-Side Enforcement**: All protected endpoints enforce role verification (`customer`, `vendor`, `admin`).
- **Blocked Account Enforcement**: Blocked users are strictly denied access to all protected APIs.
- **Resource Ownership Verification**: Vendors can only manage their own services and booking responses; customers can only cancel their own pending booking requests.
- **Admin Security**: Admin accounts cannot be created via public registration; seeded securely via environment variables.

### 2. Wedding Services Management
- **Public Discovery**: Browse approved and active services with full-text search across title, description, and location.
- **Filtering & Sorting**: Multi-category filtering, location filtering, and price sorting (ascending and descending).
- **Vendor Tier Limits**:
  - **Free Plan**: Restricted to a maximum of 3 active services.
  - **Premium Plan**: Unlimited active service listings with priority badge.
- **Admin Moderation**: Lifecycle workflow (`pending` ➔ `approved` / `rejected`). Unapproved listings are hidden from public browse.

### 3. Booking Workflow & Conflict Prevention
- **Anti-Duplicate Booking Protection**: Prevents duplicate active booking requests for the same service on the same calendar date.
- **Self-Booking Protection**: Prevents vendors from booking their own services.
- **Lifecycle State Machine**: `pending` ➔ `accepted` / `rejected` / `cancelled`.
  - Customers can only cancel `pending` bookings.
  - Vendors can accept or reject `pending` bookings. Once finalized, state transitions cannot be altered.

### 4. Stripe Checkout & Webhook Integration
- **Stripe Checkout Sessions**: Instant redirect sessions for vendor premium subscription upgrade ($49.00).
- **Verified Webhooks**: Validates Stripe webhook signatures (`stripe-signature` via raw buffer). Premium membership is activated **only** upon verified webhook events (`checkout.session.completed`).
- **Financial Audit Ledger**: Every transaction is stored in the `transactions` collection with session IDs, timestamps, and currency details. Admin cannot manually alter transaction status.

### 5. Admin Governance & Statistics
- Real-time statistics: Total registered users, vendors, customers, services, pending review count, total platform bookings, and gross platform revenue.
- User management: Search, filter by role, inspect activity history, and block/unblock accounts.
- Listing audit: Review pending services, approve, reject, or permanently delete inappropriate listings.

### 6. Image Uploads
- Direct upload support to **ImgBB** via API proxy with automatic local fallback storage in `/uploads`.

---

## 🛠 Technology Stack

- **Runtime & Framework**: Node.js (v18+), Express.js
- **Database**: MongoDB (Atlas) via Mongoose ODM
- **Authentication**: JWT (`jsonwebtoken`), `bcryptjs`
- **Payment Processing**: Stripe SDK (`stripe`)
- **File Uploads**: `multer`
- **Security & Headers**: `helmet`, `cors`, `dotenv`, `morgan`
- **Testing**: Jest, Supertest

---

## 🗄 Database Architecture

WedPlan uses MongoDB with four main collections:

```
users (Collection)
├── name (String)
├── email (String, unique)
├── password (String, hashed, select: false)
├── image (String)
├── role (enum: 'customer', 'vendor', 'admin')
├── isBlocked (Boolean, default: false)
├── businessName (String, for vendors)
├── subscriptionPlan (enum: 'free', 'premium', default: 'free')
└── subscriptionExpiresAt (Date)

services (Collection)
├── vendorId (ObjectId -> users)
├── serviceName (String, text indexed)
├── category (String: Photography, Venues, Decor, Catering, Makeup, Fashion)
├── description (String)
├── price (Number)
├── location (String)
├── images ([String])
├── status (enum: 'pending', 'approved', 'rejected', default: 'pending')
└── isActive (Boolean, default: true)

bookings (Collection)
├── serviceId (ObjectId -> services)
├── vendorId (ObjectId -> users)
├── customerId (ObjectId -> users)
├── eventDate (Date)
├── eventLocation (String)
├── message (String)
└── status (enum: 'pending', 'accepted', 'rejected', 'cancelled')

transactions (Collection)
├── vendorId (ObjectId -> users)
├── plan (String, default: 'premium')
├── amount (Number)
├── currency (String, default: 'usd')
├── stripeSessionId (String, unique)
├── stripeSubscriptionId (String)
└── status (enum: 'succeeded', 'pending', 'failed')
```

---

## 📋 Environment Variables

Create a `.env` file in the project root:

```env
# Server Config
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
CLIENT_URL=http://localhost:3000

# MongoDB Database URI
DB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/wedplan?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Stripe Payment (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Evaluation Admin Account (Auto-Seeded on Startup)
ADMIN_EMAIL=admin@wedplan.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=WedPlan Admin

# ImgBB API Key (Optional)
IMGBB_API_KEY=
```

---

## 🚀 Installation & Local Setup

```bash
# 1. Clone repository
git clone https://github.com/<your-username>/wedplan-server.git
cd wedplan-server

# 2. Install dependencies
npm install

# 3. Seed initial database (admin, sample services, sample accounts)
npm run seed

# 4. Run automated test suite
npm test

# 5. Start development server
npm run dev
# Server will listen on http://localhost:5000
```

---

## 🔑 Default Credentials for Evaluation

The database seeder automatically initializes the following verified test accounts:

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Admin** | `admin@wedplan.com` | `Admin@123456` | Full platform administrative governance |
| **Vendor (Premium)** | `vendor@wedplan.com` | `Vendor@123456` | Unlimited active services, booking management |
| **Customer** | `customer@wedplan.com` | `Customer@123456` | Browse, search, filter, booking requests, cancellations |

---

## 📡 API Endpoint Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register customer or vendor (Admin registration blocked) |
| `POST` | `/api/auth/login` | Public | Sign in with email & password |
| `POST` | `/api/auth/google` | Public | Google OAuth profile sync / sign in |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `PUT` | `/api/auth/profile` | Authenticated | Update user profile (Name, image, business name) |
| `PUT` | `/api/auth/change-password` | Authenticated | Change account password |

### 💍 Wedding Services (`/api/services`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/services` | Public | Browse approved services with search, filter, and sort |
| `GET` | `/api/services/featured` | Public | Get featured wedding services for home banner |
| `GET` | `/api/services/categories` | Public | Get categories with active count breakdown |
| `GET` | `/api/services/:id` | Public / Auth | View single service details |
| `POST` | `/api/services` | Vendor | Create new service (Enforces 3 active limit on free plan) |
| `GET` | `/api/services/my-services` | Vendor | Get all listings belonging to logged-in vendor |
| `PUT` | `/api/services/:id` | Vendor / Admin | Update service details (Vendor must own service) |
| `DELETE` | `/api/services/:id` | Vendor / Admin | Delete service (Vendor must own service) |
| `PATCH`| `/api/services/:id/availability` | Vendor | Toggle availability status (`isActive`) |

### 📅 Bookings (`/api/bookings`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/bookings` | Customer | Submit booking request (Validates date conflicts) |
| `GET` | `/api/bookings/my-bookings` | Customer | View all bookings submitted by logged-in customer |
| `PATCH/PUT`| `/api/bookings/:id/cancel` | Customer | Cancel pending booking (Accepted/rejected cannot be cancelled) |
| `GET` | `/api/bookings/vendor-requests`| Vendor | View all booking requests for vendor's services |
| `PATCH/PUT`| `/api/bookings/:id/status` | Vendor | Accept or reject pending booking request |
| `GET` | `/api/bookings/:id` | Authenticated | View booking details (Customer, Vendor, or Admin) |

### 💳 Payments & Stripe (`/api/payments`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/payments/create-checkout-session` | Vendor | Create Stripe Checkout session for Premium |
| `POST` | `/api/payments/webhook` | Stripe | Webhook listener (Constructs raw event signature) |
| `GET` | `/api/payments/verify-session/:sessionId` | Authenticated | Verify session status with Stripe |
| `GET` | `/api/payments/my-transactions` | Vendor | Get vendor's subscription transaction history |

### 📊 Dashboard Statistics (`/api/dashboard` & Direct)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/vendor/overview` | Vendor | Vendor dashboard statistics & plan limit details |
| `GET` | `/api/customer/overview` | Customer | Customer booking counts & recent history |
| `GET` | `/api/dashboard/vendor` | Vendor | Alias for vendor dashboard stats |
| `GET` | `/api/dashboard/customer` | Customer | Alias for customer dashboard stats |

### 🛡 Admin Governance (`/api/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/overview` | Admin | Real-time platform metrics and revenue totals |
| `GET` | `/api/admin/users` | Admin | Search, filter, and paginate registered users |
| `GET` | `/api/admin/users/:id` | Admin | Inspect individual user and their activities |
| `PATCH/PUT`| `/api/admin/users/:id/block` | Admin | Block or unblock a user account |
| `GET` | `/api/admin/services` | Admin | Review all submitted services (Pending, Approved, Rejected) |
| `PATCH/PUT`| `/api/admin/services/:id/status` | Admin | Approve or reject submitted service |
| `DELETE`| `/api/admin/services/:id` | Admin | Permanently delete inappropriate listing |
| `GET` | `/api/admin/transactions` | Admin | Read-only ledger of platform transactions |

### 🖼 Image Uploads (`/api/upload`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/upload` | Authenticated | Upload image (ImgBB forwarder with local fallback) |

---

## 🧪 Step-by-Step Testing Instructions for Evaluators

1. **Verify Health & Seeding**:
   - Run `npm test` to verify the 16 comprehensive integration tests pass.
   - Run `npm run seed` to ensure MongoDB has admin, vendor, customer, and services populated.

2. **Test Role Restrictions & Authentication**:
   - Send `POST /api/auth/register` with role `admin` -> returns `403 Forbidden` (admin cannot be registered publicly).
   - Log in with `admin@wedplan.com` / `Admin@123456` -> returns JWT with role `admin`.
   - Log in with `customer@wedplan.com` / `Customer@123456` -> returns JWT with role `customer`.
   - Access `GET /api/admin/overview` with customer token -> returns `403 Forbidden`.
   - Access `GET /api/admin/overview` with admin token -> returns `200 OK` with comprehensive metrics.

3. **Test Vendor Free Plan Limit (Max 3 Active Services)**:
   - Register a new free vendor: `POST /api/auth/register` with `role: "vendor"`.
   - Create 3 services -> all succeed with status `pending`.
   - Approve all 3 with admin token: `PATCH /api/admin/services/:id/status` with `status: "approved"`.
   - Attempt to create a 4th service -> returns `403 Forbidden` with `"Free plan limit reached (maximum 3 active services). Please upgrade to Premium to publish unlimited services."`.

4. **Test Booking Validation & Conflict Check**:
   - Customer submits a booking: `POST /api/bookings` with `eventDate: "2026-12-25"`.
   - Customer submits another booking for the same service on `"2026-12-25"` -> returns `400 Bad Request` with `"An active or accepted booking request already exists for this service on the selected date."`.
   - Vendor accepts request: `PATCH /api/bookings/:id/status` with `status: "accepted"`.
   - Customer tries to cancel accepted booking: `PATCH /api/bookings/:id/cancel` -> returns `400 Bad Request` (only pending bookings can be cancelled).

5. **Test Stripe Checkout**:
   - Vendor sends `POST /api/payments/create-checkout-session` -> returns Stripe Checkout URL.
   - After payment in Stripe test mode, webhook updates vendor `subscriptionPlan` to `premium`.
