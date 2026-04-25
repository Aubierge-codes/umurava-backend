# Umurava AI Recruitment Platform — Backend

A powerful Node.js backend powering the Umurava AI recruitment platform.

## 🌐 Live API

**Base URL:** https://umurava-backend.up.railway.app

## ✨ Features

- 🔐 JWT Authentication with email verification
- 📧 Email notifications via Resend
- 🤖 AI CV screening powered by Google Gemini
- 📄 PDF parsing and text extraction
- ☁️ Cloudinary file storage
- 🗄️ MongoDB Atlas database
- 📬 BullMQ job queue with Redis (Upstash)
- 👑 Admin permission request system

## 🚀 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB Atlas + Mongoose
- **Queue:** BullMQ + Redis (Upstash)
- **AI:** Google Gemini API
- **Storage:** Cloudinary
- **Email:** Resend
- **Deployment:** Railway

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/verify-email` | Verify email code |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/jobs` | List jobs |
| POST | `/api/admin/job` | Create job |
| PUT | `/api/admin/job/:id` | Update job |
| DELETE | `/api/admin/job/:id` | Delete job |
| GET | `/api/admin/top-candidates` | Top ranked candidates |

### Admin Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin-requests` | Submit admin request |
| GET | `/api/admin-requests/my` | My requests |
| GET | `/api/admin-requests` | All requests (admin only) |
| PUT | `/api/admin-requests/:id/review` | Approve/reject (admin only) |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications/jobs` | Public job listings |
| POST | `/api/applications/apply` | Upload CVs |
| GET | `/api/applications/top/:jobId` | Top candidates |
| GET | `/api/applications/status/:id` | Application status |

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Redis (Upstash)
- Google Gemini API key
- Cloudinary account
- Resend account

### Installation

```bash
git clone https://github.com/Aubierge-codes/umurava-backend.git
cd umurava-backend
npm install
```

### Environment Variables

Create `Backend/.env`:

```env
PORT=4000
NODE_ENV=development
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
REDIS_HOST=your_upstash_host
REDIS_PORT=6379
REDIS_PASSWORD=your_upstash_password
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
EMAIL_USER=your_gmail
EMAIL_PASS=your_gmail_app_password
RESEND_API_KEY=your_resend_key
ADMIN_EMAILS=your_admin_email
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
```

### Run locally

```bash
# Start server
npm run dev

# Start worker
npm run worker
```

## 🔗 Related

- [Frontend Repository](https://github.com/Aubierge-codes/umurava-frontend)
- [Live Demo](https://umurava-frontend-orpin.vercel.app)
