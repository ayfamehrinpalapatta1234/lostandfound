-- =====================================================================
-- TraceBack - College Lost & Found Management System Database Schema
-- Matches Relational Schema & ER Diagram:
-- USERS, USER_PHONES, FOUND_ITEMS, LOST_ITEMS, CLAIMS, NOTIFICATIONS
-- Compatible with SQLite, MySQL 8.0, and PostgreSQL
-- =====================================================================

-- 1. USERS TABLE
-- Entity USERS: Userid (PK), Name (Fname, Minit, Lname), ClgEmail (Unique),
-- Department, Role, Password
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    fname VARCHAR(50) NOT NULL,
    minit VARCHAR(10) DEFAULT '',
    lname VARCHAR(50) NOT NULL,
    clg_email VARCHAR(100) UNIQUE NOT NULL,
    dept VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Student', -- 'Student', 'Faculty', 'Staff', 'Admin'
    password VARCHAR(255) NOT NULL,
    institution VARCHAR(150) DEFAULT 'Campus College of Engineering',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. USER PHONE TABLE (Handles multivalued Phone no attribute)
-- Relational Schema: USER ID (FK) + Phoneno (Composite PK)
CREATE TABLE IF NOT EXISTS user_phones (
    user_id VARCHAR(36) NOT NULL,
    phoneno VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, phoneno),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. FOUND ITEMS TABLE
-- Entity FOUND ITEMS: FOUNDID (PK), Item name, Date found, Time found,
-- Location found, Storage Location, Description, Category, Status, Image
-- Relationship: USERS (1) Reports (N) FOUND ITEMS
CREATE TABLE IF NOT EXISTS found_items (
    found_id VARCHAR(36) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    date_found DATE NOT NULL,
    time_found TIME,
    location_found VARCHAR(150) NOT NULL,
    storage_location VARCHAR(150) DEFAULT 'Campus Security Office',
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    color VARCHAR(50) DEFAULT '',
    brand VARCHAR(50) DEFAULT '',
    identifying_features TEXT DEFAULT '',
    image_url VARCHAR(255) DEFAULT 'fina.png',
    status VARCHAR(30) DEFAULT 'Available', -- 'Available', 'Claimed', 'Returned'
    user_id VARCHAR(36) NOT NULL,
    contact_number VARCHAR(20) DEFAULT '',
    additional_notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. LOST ITEMS TABLE
-- Entity LOST ITEMS: Lost-ID (PK), Item name, Date lost, Location lost,
-- Description, Category, Status, Image
-- Relationship: USERS (1) Report (N) LOST ITEMS
CREATE TABLE IF NOT EXISTS lost_items (
    lost_id VARCHAR(36) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    date_lost DATE NOT NULL,
    time_lost TIME,
    location_lost VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    color VARCHAR(50) DEFAULT '',
    brand VARCHAR(50) DEFAULT '',
    serial_number VARCHAR(100) DEFAULT '',
    image_url VARCHAR(255) DEFAULT '',
    status VARCHAR(30) DEFAULT 'Lost', -- 'Lost', 'Recovered', 'Closed'
    user_id VARCHAR(36) NOT NULL,
    contact_number VARCHAR(20) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. CLAIMS TABLE
-- Entity CLAIMS: Claims ID (PK), Claim Date, claim status, proof of ownership
-- Relationships: FOUND ITEMS (1) has (N) CLAIMS; USERS (1) Verifies (N) CLAIMS
CREATE TABLE IF NOT EXISTS claims (
    claims_id VARCHAR(36) PRIMARY KEY,
    foreign_id VARCHAR(36) NOT NULL, -- references found_items(found_id)
    user_id VARCHAR(36) NOT NULL,    -- claimant user_id
    status VARCHAR(30) DEFAULT 'Pending', -- 'Pending', 'Under Review', 'Approved', 'Rejected', 'Resolved'
    proof_of_ownership TEXT DEFAULT '',
    claim_date DATE NOT NULL,
    explanation TEXT NOT NULL,
    review_message TEXT DEFAULT '',
    verified_by VARCHAR(36),          -- admin/staff user_id who verified
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (foreign_id) REFERENCES found_items(found_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    related_item_id VARCHAR(36),
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_found_category ON found_items(category);
CREATE INDEX IF NOT EXISTS idx_found_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_found_user ON found_items(user_id);
CREATE INDEX IF NOT EXISTS idx_lost_category ON lost_items(category);
CREATE INDEX IF NOT EXISTS idx_lost_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_user ON lost_items(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_found ON claims(foreign_id);
CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user_id);

-- =====================================================================
-- INITIAL SEED DATA
-- Default Admin and Student accounts, along with campus items matching landing page
-- =====================================================================

-- Users (Password hashes are salted SHA-256 for 'password123')
INSERT OR IGNORE INTO users (user_id, fname, minit, lname, clg_email, dept, role, password, institution)
VALUES 
('usr-admin-01', 'Security', 'A', 'Admin', 'admin@traceback.edu', 'Campus Security', 'Admin', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Campus Security Office'),
('usr-demo-01', 'Ayfa', 'M', 'Mehrin', 'ayfa@campus.edu', 'Computer Science', 'Student', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'College of Engineering'),
('usr-demo-02', 'Rahul', 'K', 'Sharma', 'rahul.k@campus.edu', 'Electronics & Comm', 'Student', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'College of Engineering');

-- User Phones
INSERT OR IGNORE INTO user_phones (user_id, phoneno)
VALUES 
('usr-admin-01', '+91 9876543210'),
('usr-demo-01', '+91 9123456789'),
('usr-demo-02', '+91 9898989898');

-- Found Items (matches items from existing home.html slider)
INSERT OR IGNORE INTO found_items (found_id, item_name, date_found, time_found, location_found, storage_location, description, category, color, brand, identifying_features, image_url, status, user_id, contact_number, additional_notes)
VALUES
('fnd-001', 'MacBook Air M2', '2026-07-22', '14:30:00', 'IT Block - Room 302', 'Campus Security Office', 'Silver Apple MacBook Air with a small blue sticker on bottom right lid. Left behind after lab session.', 'Electronics', 'Silver', 'Apple', 'Small blue astronaut sticker on outer casing', 'laptop.png', 'Available', 'usr-admin-01', '+91 9876543210', 'Found plugged into wall near projector.'),
('fnd-002', 'Stainless Steel Water Bottle', '2026-07-21', '11:15:00', 'Central Library - 2nd Floor', 'Library Help Desk', 'Matte black insulated water bottle with metal carabiner on cap.', 'Other', 'Black', 'Milton', 'Engraved initials R.S near bottom base', 'bottle.png', 'Available', 'usr-demo-01', '+91 9123456789', 'Left on table 14 beside reference section.'),
('fnd-003', 'College Backpack', '2026-07-20', '16:45:00', 'Main Gate Security Post', 'Main Gate Office', 'Grey and navy waterproof college backpack containing spiral notebooks and engineering graphics kit.', 'Bags', 'Grey/Navy', 'Wildcraft', 'Keychain with guitar attached to main zip', 'bag.png', 'Available', 'usr-admin-01', '+91 9876543210', 'Handed over by campus security patrol.'),
('fnd-004', 'Over-Ear Headphones', '2026-07-20', '18:00:00', 'Auditorium Hall', 'Campus Security Office', 'Black wireless Bluetooth over-ear headphones inside a black zippered hard case.', 'Electronics', 'Black', 'Sony', 'Foam padding on headband slightly scuffed', 'headphones.png', 'Available', 'usr-demo-02', '+91 9898989898', 'Found on row F seat 12 after seminar.');

-- Lost Items
INSERT OR IGNORE INTO lost_items (lost_id, item_name, date_lost, time_lost, location_lost, description, category, color, brand, serial_number, image_url, status, user_id, contact_number)
VALUES
('lst-001', 'MacBook Air', '2026-07-22', '14:00:00', 'IT Block', 'Silver 13-inch MacBook Air forgotten after Data Structures lab exam.', 'Electronics', 'Silver', 'Apple', 'C02G40Z...', 'laptop.png', 'Lost', 'usr-demo-01', '+91 9123456789'),
('lst-002', 'Casio Scientific Calculator', '2026-07-23', '09:30:00', 'Mechanical Workshop', 'Casio FX-991EX ClassWiz calculator inside black protective sliding case.', 'Electronics', 'Black', 'Casio', '', 'calculator.png', 'Lost', 'usr-demo-02', '+91 9898989898');

-- Sample Claim
INSERT OR IGNORE INTO claims (claims_id, foreign_id, user_id, status, proof_of_ownership, claim_date, explanation, review_message)
VALUES
('clm-001', 'fnd-002', 'usr-demo-02', 'Pending', 'Can state initials R.S engraved on base and receipt of purchase.', '2026-07-22', 'This water bottle belongs to me; left it while studying for exam.', 'Awaiting claimant student ID verification.');
