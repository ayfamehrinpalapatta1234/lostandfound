# TraceBack - College Lost & Found Management System

**TraceBack** is a full-stack lost-and-found management platform designed primarily for college students and campus security. It allows students and campus staff to report lost belongings, log found items, perform search with multi-criteria filtering, file verified ownership claims, and match lost-and-found reports through an explainable algorithmic scoring engine.

---

## 📸 Database ER & Relational Schema Mapping

The database schema directly implements the system's handwritten ER and Relational Schema diagrams:

1. **`users`**:
   - `user_id` (PK), `fname`, `minit`, `lname`, `clg_email` (UNIQUE), `dept`, `role` (Student/Faculty/Staff/Admin), `password` (Salted SHA-256 Hash), `institution`, `created_at`
2. **`user_phones`** (Handles multivalued Phone no attribute):
   - `user_id` (FK -> `users`), `phoneno`
   - Composite Primary Key: `(user_id, phoneno)`
3. **`found_items`**:
   - `found_id` (PK), `item_name`, `date_found`, `time_found`, `location_found`, `storage_location`, `description`, `category`, `color`, `brand`, `identifying_features`, `image_url`, `status` ('Available', 'Claimed', 'Returned'), `user_id` (FK -> `users`), `contact_number`, `additional_notes`, `created_at`
4. **`lost_items`**:
   - `lost_id` (PK), `item_name`, `date_lost`, `time_lost`, `location_lost`, `description`, `category`, `color`, `brand`, `serial_number`, `image_url`, `status` ('Lost', 'Recovered', 'Closed'), `user_id` (FK -> `users`), `contact_number`, `created_at`
5. **`claims`**:
   - `claims_id` (PK), `foreign_id` (FK -> `found_items`), `user_id` (FK -> `users`), `status` ('Pending', 'Under Review', 'Approved', 'Rejected', 'Resolved'), `proof_of_ownership`, `claim_date`, `explanation`, `review_message`, `verified_by`, `created_at`
6. **`notifications`**:
   - `notification_id` (PK), `user_id` (FK -> `users`), `title`, `message`, `related_item_id`, `is_read`, `created_at`

---

## 🚀 How to Run the Project

### Option A: Zero-Dependency Pure Node.js Server (Recommended)
This uses the built-in HTTP server, crypto, and persistent database engine with **zero external npm installs**:

```bash
# Navigate to the project directory
cd lostandfound-backend/frontend-repo

# Run the server
node server.js
```

Then open your browser at:
👉 **`http://localhost:5000`** (or `http://localhost:5000/home.html`)

### Option B: Standalone / GitHub Pages Mode
The project includes a client API bridge (`api.js`) with an intelligent fallback engine. If opened directly in a browser (`file:///...`) or hosted on GitHub Pages:
- All pages remain 100% interactive.
- Initial seed data (MacBook Air, Milton bottle, Wildcraft backpack, Casio calculator) is pre-loaded into LocalStorage.
- Reporting, searching, and claiming work without needing a live backend process.

---

## 🔑 Default Seed Accounts

The system comes pre-seeded with accounts for testing:

| Role | College Email | Default Password |
|---|---|---|
| **Admin / Campus Security** | `admin@traceback.edu` | `password123` |
| **Student (Demo 1)** | `ayfa@campus.edu` | `password123` |
| **Student (Demo 2)** | `rahul.k@campus.edu` | `password123` |

---

## 📑 Completed Pages & Features

1. **Landing Page (`home.html`, `index.html`)**:
   - Maintained original hero animation with drifting campus item PNGs.
   - Interactive search bar connected to search engine.
   - Dynamic Recently Found Items slider cards with "View Details".
   - 5-step campus workflow cards.
2. **Authentication (`login.html`, `register.html`)**:
   - Matches original form styling and colors.
   - Registration includes all schema fields: First Name, Middle Initial, Last Name, College Email, Department, Role, Phone, Password.
   - Duplicate email prevention, client and server validation, salted SHA-256 password hashing.
3. **User Dashboard (`dashboard.html`)**:
   - Preserves dark navy `#0b1b45` sidebar and SaaS card layout.
   - Real database calculations for Lost Reports, Found Reports, and Pending Claims.
   - Dynamic Recent Campus Activity feed.
   - Possible Matches recommendation widget.
4. **Report Lost Item (`reportlost.html`)**:
   - 4-section structured form: Item Info, Location & Date, Identification/Serial, Photo upload.
   - Real-time image preview with removal button.
   - Duplicate click prevention.
5. **Report Found Item (`reportfound.html`)**:
   - 4-section structured form: Item Info, Found Location & Custody, Marks & Notes, Photo upload.
   - Sets safe initial status ('Available') and saves storage custody location.
6. **Search & Browse (`search.html`)**:
   - Real-time text search across item name, description, brand, location.
   - Multi-criteria filters: Item Type (Lost/Found/All), Category (10 college categories), Location.
   - Privacy-safe results (never leaks private contact numbers or serial numbers publicly).
7. **Item Details (`details.html`)**:
   - Full specification view: image, metadata, location, date, status, report ID.
   - "Submit Claim" action for found items.
   - Owner actions ("Delete Report") with confirmation.
8. **My Reports (`myreports.html`)**:
   - Tabbed view for user's Lost and Found notices.
   - Direct links to View Details and Delete.
9. **Claiming & Verification (`claim.html`, `myclaims.html`)**:
   - File claims with ownership justification and proof evidence.
   - Duplicate active claim prevention.
   - Administrator verification panel allowing Campus Security to review evidence, mark "Approved", "Under Review", or "Rejected", and send feedback.
10. **Profile & Settings (`profile.html`, `settings.html`)**:
    - Update name, contact phone, department, institution.
    - Password change with verification.
    - Notification preference toggles.
11. **Possible Matches Engine (Section 4)**:
    - Explainable algorithmic scoring comparing category (35%), keyword tokens (30%), color (10%), brand (10%), location proximity (10%), date proximity (5%).
    - Generates similarity percentages with plain-English matching reasons.

---

## 🗄️ Database Scripts & Migrations

- `schema.sql`: Standard SQL DDL compatible with SQLite, MySQL 8.0, and PostgreSQL. Includes table creation, primary/foreign keys, indexes, and initial seed records.
- `supabase_schema.sql`: Production-grade PostgreSQL script configured with Supabase Row Level Security (RLS) policies.
- `.env.example`: Configuration template for port, JWT secret, and database connection strings.
