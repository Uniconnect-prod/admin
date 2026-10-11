# Multi-Platform Enterprise Report Management System

A high-performance, multi-tenant analytics, subscriber telemetry, and date-wise authorization reporting dashboard built for digital consumer platforms: **ghsuperwinings**, **ghanagameium**, and **crazymuzik**.

---

## 🌐 Live Deployments
- **Production Frontend (Vercel)**: [https://reporting-dash-ofa2.vercel.app/](https://reporting-dash-ofa2.vercel.app/)
- **Production Backend API (Render)**: [https://reporting-dash-kxeu.onrender.com/](https://reporting-dash-kxeu.onrender.com/)

---

## 📑 Table of Contents
1. [Architecture & Tech Stack](#-architecture--tech-stack)
2. [Key System Features & Dashboard Layout](#-key-system-features--dashboard-layout)
3. [Project Structure](#-project-structure)
4. [Quick Start & Setup](#-quick-start--setup)
5. [Authorized System Accounts & Credentials](#-authorized-system-accounts--credentials)
6. [Database Architecture & Security Proxies](#-database-architecture--security-proxies)
7. [Platform-Based Authorization & Date-Wise Access Engine](#-platform-based-authorization--date-wise-access-engine)
8. [Complete API Specification](#-complete-api-specification)
   - [1. Authentication & Single Sign-In](#1-authentication--single-sign-in)
   - [2. Public Platform Showcase](#2-public-platform-showcase)
   - [3. Platforms Discovery & Scope](#3-platforms-discovery--scope)
   - [4. Dashboard Telemetry & Platform Comparison](#4-dashboard-telemetry--platform-comparison)
   - [5. Subscribers Management](#5-subscribers-management)
   - [6. Renewals & Billing Telemetry](#6-renewals--billing-telemetry)
   - [7. Churn Cohort Analytics](#7-churn-cohort-analytics)
   - [8. Quizzes & Content Management](#8-quizzes--content-management)
   - [9. User Management & Date-Wise Access Control](#9-user-management--date-wise-access-control)
   - [10. Streaming CSV Export](#10-streaming-csv-export)
   - [11. Dynamic Platform Management & Multi-Tenant Registry](#11-dynamic-platform-management--multi-tenant-registry)
9. [Troubleshooting & Common Issues](#-troubleshooting--common-issues)
10. [Automated Verification Suite](#-automated-verification-suite)

---

## 🛠 Architecture & Tech Stack

### Frontend (`/client`)
- **Framework**: React 19 + Vite
- **Language**: JavaScript (ES modules, strictly no TypeScript)
- **Styling**: SCSS with modular tokens, mixins, responsive breakpoints, and dark gradient overlays
- **Routing**: React Router DOM v7
- **HTTP Client**: Axios with interceptors for JWT injection, active platform headers (`x-platform-code`, `x-platform-id`), and auto-refresh
- **Charts & Visualizations**: Recharts (Interactive Bar, Area, Line, Donut charts)
- **Icons**: Lucide React
- **Branding**: Dynamic platform emblems and automated hero carousel

### Backend (`/server`)
- **Runtime**: Node.js & Express (ES modules)
- **Database Architecture**:
  - **Live Production MongoDB (READ-ONLY Source)**: Directly queries and aggregates live production collections (`ghsuperwinings`, `ghanagameium`, `crazymuzik`) using native `MongoClient` with read preference `secondaryPreferred`. Strictly guarded via a JavaScript security proxy that rejects any write, insert, update, delete, or drop operations.
  - **Reporting Admin MongoDB**: Dedicated administrative database (`gh_reporting_admin`) for application-owned authentication, admin users, roles, platform access configuration, date-wise access validity windows, and audit logs.
- **Security & Middleware**:
  - Strict read-only proxy guarding live source production collections
  - JWT authentication (short-lived access tokens + rotating refresh tokens)
  - Date-wise authorization engine with real-time UTC timestamp evaluation
  - Strict Role-Based Access Control (RBAC) with `requireSuperAdmin` and `platformGuard`
  - Tenant header isolation (`X-Platform-ID` / `x-platform-code`)
  - Helmet security headers and CORS protection
  - Rate limiting on authentication routes
- **Logging**: Audit logging on data modifications and operator access events

---

## ✨ Key System Features & Dashboard Layout

### 1. Dedicated GHSUPERWINNINGS Analytics Dashboard
The dashboard has been simplified and focused exclusively on the **GHSUPERWINNINGS** platform:
- **Platform Code**: `GHSUPERWINNINGS` (database name: `ghsuperwinings`, ID: `1`)
- **Strict Read-Only Mode**: Zero MongoDB write operations against production collections. Guarded via the native security proxy.
- **Dynamic Date Evaluation**: Date boundaries calculated using business timezone `Africa/Accra` (UTC+0).
- **60-Second Auto-Refresh**: Background polling with automatic Axios request cancellation (`AbortController`) on component unmount.
- **Resilient States**: Shimmer skeleton loaders while fetching (no fake zeros) and explicit error state with Retry capability.

### 2. 4 Primary Business KPI Cards
- **Today's Renewals / Total Renewals**: Successful, billed renewal transactions (`command = 'NotifyRenewal'`, `chargeAmount > 0`, and `status = 'A'`) processed today in `Africa/Accra`. Explicitly excludes failed transactions (`status = 'S'`, insufficient balance, 0 charge) so counts reflect real monetized renewals (~4,052 vs raw 21k unbilled callbacks). Dynamically labels as "Total Renewals" when viewing custom date ranges.
- **Total Subscribers**: Authoritative subscriber base loaded directly from the production subscriber registry: `users` collection for `ghsuperwinings` (23,584 unique subscribers) and `subscriptions` collection for `ghanagameium` (4,456 subscribers). Aligned with the [Subscribers Management] module.
- **Active Subscribers**: Real-time active subscriber count evaluated from the production registry (`subscriptionStatus: 'active'`), representing 4,000 active subscribers for SuperWinnings and 485 for Gameium.
- **Gross Billing (Revenue)**: Total settlement billing revenue in GHC generated from billed transactions (`chargeAmount` from `sdplog`). Synchronized directly with the Business Settlement Report (`totals.grandTotal`) for selected date intervals (e.g., GHC 2,712.49 for Sept 1–30, 2026).

### 3. Daily Subscription & Settlement Breakdown List Table
Directly below the 4 primary KPI cards, the dashboard displays the exact settlement table matching the enterprise acquisition specification:
- **Columns**:
  - `Date`: Calendar date of subscription events (`YYYY-MM-DD`).
  - `New_Subscriber_Num`: Total new subscriber registrations/activations with billed breakdown.
  - `Activation Parking`: Subscriptions parked in grace/pending billing due to insufficient balance.
  - `Super Winnings Daily`: Revenue in GHC (or transaction count) for Offer `9923310010`.
  - `Super Winnings on-demand Daily`: Revenue in GHC (or transaction count) for Offer `9923310009`.
  - `Grand Total`: Total settlement billing across all offers (`Daily + On-demand`).
- **Visual Section Boundary**: Vertical double separator (`||`) between Activation Parking and Offer Billing columns.
- **Interactive Controls**:
  - View mode switcher: `[ 💵 Revenue (GHC) | 📊 Transactions ]`
  - Date search & filtering
  - Streaming CSV export (`Export CSV`)
  - Running summary totals row at table footer
  - Pagination controls

### 4. GHSUPERWINNINGS Telemetry & Offer Profiles
- **Database Scope**: `ghsuperwinings`
- **Business Timezone**: `Africa/Accra`
- **Offer Profiles**:
  - `9923310010`: Super Winnings Daily
  - `9923310009`: Super Winnings On-demand Daily
- **Dedicated User Management**: Accessible via the dedicated `/users` route for authorized operator controls.

### 5. Single Common Sign-In
- No platform dropdown or manual platform selection on the login page.
- User submits credentials; the backend evaluates all platform authorizations against `CURRENT_TIMESTAMP` and automatically sets the active platform session.

---

## 📁 Project Structure

```text
reporting/
├── client/                      # React Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/          # PageHeader, DataTable, StatusBadge, Modal, KpiCard, ChartCard
│   │   │   └── layout/          # Sidebar, Navbar, AppLayout
│   │   ├── context/             # AuthContext (Single sign-in & platform switching)
│   │   ├── pages/
│   │   │   ├── auth/            # LoginPage (Automated carousel, hero showcase)
│   │   │   ├── dashboard/       # DashboardPage (4 KPIs, Platform Comparison Charts, Personnel)
│   │   │   ├── subscribers/     # SubscribersPage (Filters, search, pagination)
│   │   │   ├── renewals/        # RenewalsPage (Transaction breakdowns)
│   │   │   ├── churn/           # ChurnPage (Cohort and churn retention)
│   │   │   ├── quizzes/         # QuizzesPage (Content management)
│   │   │   └── users/           # UsersPage (RBAC, Date windows, Add/Edit modals)
│   │   ├── services/            # Axios instance (JWT and tenant header injection)
│   │   └── styles/              # SCSS variables, mixins, global typography
│   ├── vite.config.js           # Vite configuration with /api proxy to port 5000
│   └── package.json
│
├── server/                      # Node.js Express Backend
│   ├── data/                    # Local storage fallback
│   ├── src/
│   │   ├── config/              # Environment config, dual-MongoDB connector & proxy
│   │   ├── controllers/         # Auth, Platform, User, Report, Subscriber, Quiz controllers
│   │   ├── middleware/          # auth, platformGuard, requireSuperAdmin, rateLimiter, auditLogger
│   │   ├── models/              # db.js (MongoDB adapter emulation for admin collections)
│   │   ├── routes/              # Express API routers
│   │   ├── services/            # sourceDataService.js (Real live MongoDB aggregation engine)
│   │   └── utils/               # platformAccessHelper, seedData, token
│   ├── server.js                # Server entry point
│   ├── .env                     # Environment variables (MongoDB URIs, JWT secrets)
│   └── package.json
└── README.md
```

---

## 🚀 Quick Start & Setup

### Prerequisites
- **Node.js** (v18.0 or newer recommended)
- **npm** (v9.0 or newer)

### 1. Server Setup
```bash
cd server
npm install
npm run dev
```
The backend initializes connections to MongoDB and listens on **`http://localhost:5000`**.

### 2. Client Setup
```bash
cd client
npm install
npm run dev
```
The frontend launches on **`http://localhost:5173`** (or `http://localhost:5174` if port 5173 is occupied).

### 3. Production Build
```bash
cd client
npm run build
```
Generates an optimized production bundle in `client/dist`.

---

## 🔑 Authorized System Accounts & Credentials

### 1. Web Application / Dashboard Login

| Account Type | Username / Email | Password | Platform Scope | Default Role |
|---|---|---|---|---|
| **Super Admin** | `main_admin`<br>`main_admin@enterprise.com` | `Password123!` | Consolidated (`ALL`) Platforms | Universal Super Administrator across all platforms (`ghsuperwinings`, `ghanagameium`, `crazymuzik`). Full access to User Management, Platform Comparison, and exports. |
| **Platform Admin** | `ghsnapflix_rahul`<br>`rahul@ghsnapflix.com` | `Password123!` | `ghsuperwinings` (Platform ID: 1) | Dedicated Platform Administrator for SuperWinnings. Access to subscribers, billing, renewals, churn, and reporting. |

### 2. MongoDB Configuration

Configure your MongoDB connections via environment variables in `server/.env` (refer to `server/.env.example`):

| Variable | Description |
|---|---|
| `SOURCE_MONGODB_URI` | MongoDB connection string for live source databases (`ghsuperwinings`, `ghanagameium`, `crazymuzik` - STRICT READ-ONLY) |
| `REPORTING_MONGODB_URI` | MongoDB connection string for reporting admin database (`gh_reporting_admin`) |

---

## 🛡 Database Architecture & Security Proxies

### 1. Strict Read-Only Source Proxy (`server/src/config/mongo.js`)
All queries to the live production databases (`ghsuperwinings`, `ghanagameium`, `crazymuzik`) pass through a JavaScript `Proxy`:
```javascript
const FORBIDDEN_WRITE_METHODS = new Set([
  'insertOne', 'insertMany', 'updateOne', 'updateMany',
  'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndUpdate',
  'findOneAndReplace', 'findOneAndDelete', 'bulkWrite', 'drop',
  'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'rename'
]);
```
Any invocation of a write method immediately throws a `[SECURITY_VIOLATION]` exception, ensuring live production subscriber records cannot be modified or deleted by the reporting application.

### 2. Reporting Admin Database (`gh_reporting_admin`)
Dedicated exclusively to application management:
- `admin_users`: Administrative operator accounts and bcrypt password hashes.
- `admin_roles`: System roles (`Super Admin`, `Platform Admin`, `Author`, `Analyst`, `Viewer`).
- `admin_platform_access`: Platform-to-user mappings with `start_date`, `end_date`, and `status`.
- `admin_platforms`: Registered platform metadata and enabled modules.
- `admin_audit_logs`: Detailed audit logs of logins, operator updates, and modifications.

---

## 🔒 Platform-Based Authorization & Date-Wise Access Engine

Every user-to-platform association contains `start_date`, `end_date`, and `status`:
```sql
CREATE TABLE IF NOT EXISTS platform_access (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE' or 'REVOKED'
  created_by INTEGER,
  created_at DATETIME
);
```

### Real-Time Status Evaluation Logic
Evaluated on every API request and at login against `CURRENT_TIMESTAMP`:

$$\text{Status} = \begin{cases} 
\text{REVOKED} & \text{if } \text{status} = \text{'REVOKED'} \\
\text{UPCOMING} & \text{if } \text{now} < \text{start\_date} \\
\text{EXPIRED} & \text{if } \text{now} > \text{end\_date} \\
\text{ACTIVE} & \text{if } \text{start\_date} \le \text{now} \le \text{end\_date}
\end{cases}$$

- **Expiring Soon Indicator**: Flagged as `isExpiringSoon = true` when $\text{end\_date} - \text{now} \le 7 \text{ days}$.
- **Strict Guarding**: Handled server-side in `platformGuard.js`. Non-active access attempts are rejected with HTTP 403.

---

## 📡 Complete API Specification

### 1. Authentication & Single Sign-In

#### `POST /api/auth/login`
Single Sign-In entry point. Backend verifies credentials and evaluates assigned platforms.
- **Request Body**:
  ```json
  {
    "username": "main_admin",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Authentication successful.",
    "data": {
      "token": "<JWT_ACCESS_TOKEN>",
      "refreshToken": "<JWT_REFRESH_TOKEN>",
      "user": {
        "id": 1,
        "name": "Main Admin",
        "email": "main_admin@enterprise.com",
        "username": "main_admin",
        "isSuperAdmin": true,
        "activeRole": "Super Admin"
      },
      "activePlatform": {
        "id": "ALL",
        "code": "ALL",
        "name": "All Platforms",
        "isAll": true
      },
      "availablePlatforms": [
        {
          "id": 1,
          "code": "GHSUPERWININGS",
          "name": "ghsuperwinings",
          "role": "Super Admin",
          "isCurrentlyActive": true
        },
        {
          "id": 2,
          "code": "GHANAGAMEIUM",
          "name": "ghanagameium",
          "role": "Super Admin",
          "isCurrentlyActive": true
        },
        {
          "id": 3,
          "code": "CRAZYMUZIK",
          "name": "crazymuzik",
          "role": "Super Admin",
          "isCurrentlyActive": true
        }
      ]
    }
  }
  ```
- **Error Responses `403 Forbidden`**:
  - `PLATFORM_ACCESS_EXPIRED`: Authorization period has ended.
  - `PLATFORM_ACCESS_UPCOMING`: Scheduled start date is in the future.
  - `PLATFORM_ACCESS_REVOKED`: Platform access has been revoked.
  - `NO_PLATFORMS_ASSIGNED`: No platforms assigned to this user.

#### `GET /api/auth/me`
Validates active JWT token and returns profile with evaluated active platforms.
- **Headers**: `Authorization: Bearer <token>`

#### `POST /api/auth/refresh-token`
Exchanges a valid refresh token for a fresh access token.
- **Request Body**: `{ "refreshToken": "<token>" }`

---

### 2. Public Platform Showcase

#### `GET /api/platforms/showcase`
Public endpoint (no auth required) powering the login page carousel.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "code": "GHSUPERWININGS",
        "name": "ghsuperwinings",
        "badge": "Trivia & Rewards",
        "tagline": "Daily Trivia, Brain Battles & Instant MoMo Cash Prizes",
        "description": "Interactive SMS and web trivia challenges covering sports, general knowledge, pop culture, and science.",
        "bgImage": "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=1200&q=80",
        "accentColor": "#00E676",
        "stats": [
          { "label": "Quiz Masters", "value": "78K+" },
          { "label": "Daily Winners", "value": "1,200+" },
          { "label": "Win Rate", "value": "34.2%" }
        ]
      }
    ]
  }
  ```

---

### 3. Platforms Discovery & Scope

#### `GET /api/platforms`
Lists all platforms currently active in the system.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**: Array of registered platform objects with enabled modules.

---

### 4. Dashboard Telemetry & Platform Comparison

#### `GET /api/reports/overview`
Aggregated telemetry and KPI metrics from the live source databases.
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `x-platform-code: <CODE>` (or `ALL`)
- **Query Params**: `range=today|7d|30d|90d|12m|custom`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`
- **Response `200 OK`**: Returns `kpis` (`todayRenewals`, `totalSubscribers`, `activeSubscribers`, `grossRevenue`, `renewalRate`, `arpu`, `newSubscribers`, `churnRate`).

#### `GET /api/reports/platform-comparison`
Real database cross-platform telemetry and user authorization breakdown. **Restricted to Super Admin**.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "comparison": [
        {
          "platformId": 1,
          "name": "ghsuperwinings",
          "code": "GHSUPERWININGS",
          "totalUsers": 3,
          "activeUsers": 2,
          "expiredUsers": 1,
          "expiringSoon": 0,
          "subscribers": 7103,
          "activeSubscribers": 582,
          "renewals": 44689,
          "failedRenewals": 1820,
          "revenue": 2068.79,
          "renewalRate": "96.1%",
          "renewalRateValue": 96.1
        },
        {
          "platformId": 2,
          "name": "ghanagameium",
          "code": "GHANAGAMEIUM",
          "totalUsers": 1,
          "activeUsers": 1,
          "expiredUsers": 0,
          "expiringSoon": 0,
          "subscribers": 4456,
          "activeSubscribers": 485,
          "renewals": 1984,
          "failedRenewals": 3896,
          "revenue": 1984.00,
          "renewalRate": "33.7%",
          "renewalRateValue": 33.7
        },
        {
          "platformId": 3,
          "name": "crazymuzik",
          "code": "CRAZYMUZIK",
          "totalUsers": 1,
          "activeUsers": 1,
          "expiredUsers": 0,
          "expiringSoon": 0,
          "subscribers": 0,
          "activeSubscribers": 0,
          "renewals": 0,
          "failedRenewals": 0,
          "revenue": 0.00,
          "renewalRate": "—",
          "renewalRateValue": 0
        }
      ]
    }
  }
  ```

---

### 5. Subscribers Management

#### `GET /api/subscribers`
Paginated, searchable subscriber records from source collections.
- **Headers**: `Authorization: Bearer <token>`, `x-platform-code: <CODE>`
- **Query Params**: `page=1`, `limit=20`, `search=233...`, `status=active|churned|all`

---

### 6. Renewals & Billing Telemetry

#### `GET /api/renewals`
Auto-renewal transaction logs and billing attempt breakdowns.
- **Headers**: `Authorization: Bearer <token>`, `x-platform-code: <CODE>`
- **Query Params**: `page=1`, `limit=25`, `status=Successful|Failed`

---

### 7. Churn Cohort Analytics

#### `GET /api/churn`
Churn event tracking, voluntary/involuntary cancellations, and retention analytics.
- **Headers**: `Authorization: Bearer <token>`, `x-platform-code: <CODE>`

---

### 8. Quizzes & Content Management

#### `GET /api/quizzes`
Trivia question banks and difficulty categories.
- **Headers**: `Authorization: Bearer <token>`, `x-platform-code: GHSUPERWININGS`

#### `POST /api/quizzes/upload`
Uploads questions in CSV or JSON format (Author or Admin role required).
- **Headers**: `Authorization: Bearer <token>`, `x-platform-code: GHSUPERWININGS`

---

### 9. User Management & Date-Wise Access Control
*(All write operations are strictly restricted to Super Administrators via `requireSuperAdmin`)*

#### `GET /api/users`
Lists all administrators and operators with platform assignments, roles, and validity windows.
- **Headers**: `Authorization: Bearer <token>`

#### `POST /api/users`
Provisions a new operator with platform assignments and validity dates.
- **Headers**: `Authorization: Bearer <token>` (Super Admin only)
- **Validation**: Enforces `start_date <= end_date`.
- **Request Body**:
  ```json
  {
    "name": "Kwame Mensah",
    "email": "kwame@enterprise.com",
    "username": "kwame_operator",
    "password": "Password123!",
    "status": "ACTIVE",
    "platform_assignments": [
      {
        "platform_id": 1,
        "role_id": 2,
        "start_date": "2026-10-01",
        "end_date": "2027-10-01",
        "status": "ACTIVE"
      }
    ]
  }
  ```

#### `PUT /api/users/:id`
Updates operator profile, role, status (`ACTIVE`, `INACTIVE`, `REVOKED`), and validity windows.
- **Headers**: `Authorization: Bearer <token>` (Super Admin only)

#### `DELETE /api/users/:id`
Revokes platform access and removes operator account.
- **Headers**: `Authorization: Bearer <token>` (Super Admin only)

---

### 10. Streaming CSV Export

#### `GET /api/export/subscribers`
Streams a CSV download isolated to the user's active platform.
- **Headers**: `Authorization: Bearer <token>`, `x-platform-code: <CODE>`
- **Response Headers**:
  - `Content-Type: text/csv`
  - `Content-Disposition: attachment; filename="subscribers-export.csv"`

### 11. Dynamic Platform Management & Multi-Tenant Registry
*(Restricted to Super Administrators via `requireSuperAdmin`)*

#### `GET /api/platform-management`
Lists all registered platforms with connection status, configuration status, and enabled modules.
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**: `search=...`, `status=ACTIVE|DRAFT|NEEDS_VALIDATION|DISABLED`, `country=...`

#### `POST /api/platform-management`
Registers a new platform with connection details, collection roles, field mappings, and offers.
- **Headers**: `Authorization: Bearer <token>`

#### `POST /api/platform-management/test-connection` or `POST /api/platform-management/:id/test-connection`
Executes real-time ping and authentication verification against the configured MongoDB instance.
- **Request Body**: `{ "mongo_uri": "mongodb+srv://...", "database_name": "..." }`
- **Response**: `{ "success": true, "latencyMs": 142, "collections": [...] }`

#### `POST /api/platform-management/discover-schema` or `POST /api/platform-management/:id/discover-schema`
Discovers accessible collections, document counts, and automatically suggests canonical field mappings from sample records.

#### `PUT /api/platform-management/:id/mappings`
Updates collection and canonical field mappings (`msisdn`, `timestamp`, `transaction_id`, `command`, `status`, `subscription_status`, `charge_amount`, `offer_code`, `failure_reason`, `next_billing_date`).

#### `PUT /api/platform-management/:id/offers`
Configures offer definitions, billing frequencies (daily, ondemand, monthly), and prices.

#### `POST /api/platform-management/:id/validate`
Runs a read-only dry-run aggregation, verifies field existence, previews sample normalized records, and calculates 24h & 30d KPI metrics.

#### `POST /api/platform-management/:id/activate`
Activates the platform. It immediately becomes accessible to authorized users and reporting engines without redeployment.

#### `POST /api/platform-management/:id/disable`
Soft-disables the platform. Preserves all configurations and historical records.

---

## 🛠 Troubleshooting & Common Issues

### 1. Port 5000 Conflict (`listen EADDRINUSE: address already in use :::5000`)
If another background Node process or legacy project is holding port 5000, Express will throw `EADDRINUSE`.
**Resolution (Windows PowerShell)**:
```powershell
# 1. Identify which process is holding port 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object LocalPort, OwningProcess, State

# 2. Terminate the conflicting process
Stop-Process -Id <PID> -Force

# 3. Start the server
cd server
npm run dev
```

### 2. Browser Shows `400 Bad Request` or `404 Not Found` on Login
- **Cause**: Occurs if Vite's `/api` proxy forwarded requests to an old/different backend service running on port 5000.
- **Resolution**: Ensure the Reporting backend (`d:/reporting/server/server.js`) is running on port 5000 and verify via `GET http://localhost:5000/api/platforms/showcase`.

### 3. MongoDB Atlas Cluster Storage Quota Notice
```
⚠️ [Mongo] Reporting admin metadata sync skipped (cluster storage quota): you are over your space quota, using 512 MB of 512 MB.
```
- **Context**: The Atlas shared M0 free cluster tier has reached its 512 MB limit.
- **Application Behavior**: The reporting backend handles this gracefully — read-only queries against live collections continue unimpeded, and existing administrative users remain fully authorized.

---

## 🧪 Verification & Security Policies
 
The enterprise reporting engine enforces strict validation across all access rules, date boundaries, and RBAC guards:

- **Single Sign-In**: Super administrators authenticate centrally and switch contexts dynamically without hardcoded platform credentials.
- **Date-Wise Validity**: Platform access records are evaluated in real time (UTC) against active windows (Active, Upcoming, Expired, Revoked).
- **Read-Only Database Proxy**: Live production MongoDB collections are strictly guarded by read-only security proxies that reject mutations.
- **Role-Based Guards**: Modification and user administration endpoints strictly require Super Admin privileges (`requireSuperAdmin`).
- **Sanitized Configurations**: All connections and secrets are managed strictly via environment variables.

### Running Automated Test Suite
To verify strict read-only database enforcement, secret masking, baseline platform migration, historical financial report fidelity, and dynamic platform registration without code changes:
```bash
node ./server/test/verify_dynamic_platform_system.js
```
