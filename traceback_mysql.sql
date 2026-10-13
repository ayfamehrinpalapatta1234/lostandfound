-- =====================================================================
-- TraceBack - College Lost & Found Management System
-- Complete MySQL Database Schema, Current Data & Retrieval Queries
-- Designed strictly according to the ER Diagram and Relational Schema
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DATABASE CREATION
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS traceback_db
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE traceback_db;

-- ---------------------------------------------------------------------
-- 2. TABLE DEFINITIONS (DDL)
-- ---------------------------------------------------------------------

-- TABLE: USERS (Entity: USERS)
-- Attributes: UserID (PK), Name (Fname, Minit, Lname), ClgEmail (Unique), 
--             Dept, Role, Password, Institution, email_verified, created_at
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    fname VARCHAR(50) NOT NULL,
    minit VARCHAR(10) DEFAULT '',
    lname VARCHAR(50) NOT NULL,
    clg_email VARCHAR(100) UNIQUE NOT NULL,
    dept VARCHAR(100) NOT NULL,
    role ENUM('Student', 'Faculty', 'Staff', 'Admin') NOT NULL DEFAULT 'Student',
    password VARCHAR(255) NOT NULL,
    institution VARCHAR(150) DEFAULT 'Campus College of Engineering',
    email_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- TABLE: PHONE / USER_PHONES (Multivalued Phone Attribute)
-- Relational Schema: USER ID (FK) + Phoneno (Composite Primary Key)
CREATE TABLE IF NOT EXISTS user_phones (
    user_id VARCHAR(50) NOT NULL,
    phoneno VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, phoneno),
    CONSTRAINT fk_phone_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE: FOUND_ITEMS (Entity: FOUND ITEMS)
-- Attributes: FoundID (PK), ItemName, DateFound, TimeFound, LocationFound,
--             StorageLocation, Description, Category, Color, Brand, 
--             IdentifyingFeatures, Image, Status, UserID (FK)
CREATE TABLE IF NOT EXISTS found_items (
    found_id VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(120) NOT NULL,
    date_found DATE NOT NULL,
    time_found TIME NULL,
    location_found VARCHAR(150) NOT NULL,
    storage_location VARCHAR(150) DEFAULT 'Campus Security Office',
    description TEXT NOT NULL,
    category VARCHAR(60) NOT NULL,
    color VARCHAR(50) DEFAULT '',
    brand VARCHAR(60) DEFAULT '',
    identifying_features TEXT NULL,
    image_url VARCHAR(255) DEFAULT 'fina.png',
    status ENUM('Available', 'Claimed', 'Returned') DEFAULT 'Available',
    user_id VARCHAR(50) NOT NULL,
    contact_number VARCHAR(25) DEFAULT '',
    additional_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_found_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE: LOST_ITEMS (Entity: LOST ITEMS)
-- Attributes: LostID (PK), ItemName, DateLost, TimeLost, LocationLost,
--             Description, Category, Color, Brand, SerialNumber, Image,
--             Status, UserID (FK)
CREATE TABLE IF NOT EXISTS lost_items (
    lost_id VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(120) NOT NULL,
    date_lost DATE NOT NULL,
    time_lost TIME NULL,
    location_lost VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(60) NOT NULL,
    color VARCHAR(50) DEFAULT '',
    brand VARCHAR(60) DEFAULT '',
    serial_number VARCHAR(100) DEFAULT '',
    image_url VARCHAR(255) DEFAULT 'fina.png',
    status ENUM('Lost', 'Recovered', 'Closed') DEFAULT 'Lost',
    user_id VARCHAR(50) NOT NULL,
    contact_number VARCHAR(25) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lost_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE: CLAIMS (Entity: CLAIMS)
-- Attributes: ClaimsID (PK), ForeignID (FK to FoundID), UserID (FK to Claimant),
--             Status, ProofOfOwnership, ClaimDate, Explanation, ReviewMessage, VerifiedBy
CREATE TABLE IF NOT EXISTS claims (
    claims_id VARCHAR(50) PRIMARY KEY,
    foreign_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    status ENUM('Pending', 'Under Review', 'Approved', 'Rejected', 'Resolved') DEFAULT 'Pending',
    proof_of_ownership TEXT NOT NULL,
    claim_date DATE NOT NULL,
    explanation TEXT NOT NULL,
    review_message TEXT NULL,
    verified_by VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_item 
        FOREIGN KEY (foreign_id) REFERENCES found_items(found_id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_claim_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_claim_verifier 
        FOREIGN KEY (verified_by) REFERENCES users(user_id) 
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- TABLE: NOTIFICATIONS (Entity: NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    related_item_id VARCHAR(50) NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. CURRENT DATA INSERTION (DML)
-- ---------------------------------------------------------------------

-- Insert Users
INSERT INTO users (user_id, fname, minit, lname, clg_email, dept, role, password, institution, email_verified, created_at)
VALUES 
('usr-admin-01', 'Security', 'A', 'Admin', 'admin@traceback.edu', 'Campus Security', 'Admin', '93438d0c146a6f4816de3a9cade6f67c69da13438f900678b13c14d3f7c443d8', 'Campus College of Engineering', TRUE, '2026-07-01 08:00:00'),
('usr-demo-01', 'Ayfa', 'M', 'Mehrin', 'ayfa@campus.edu', 'Computer Science', 'Student', '93438d0c146a6f4816de3a9cade6f67c69da13438f900678b13c14d3f7c443d8', 'Campus College of Engineering', TRUE, '2026-07-10 10:00:00'),
('usr-demo-02', 'Rahul', 'K', 'Sharma', 'rahul.k@campus.edu', 'Electronics & Comm', 'Student', '93438d0c146a6f4816de3a9cade6f67c69da13438f900678b13c14d3f7c443d8', 'Campus College of Engineering', TRUE, '2026-07-12 11:00:00')
ON DUPLICATE KEY UPDATE clg_email=VALUES(clg_email);

-- Insert User Phone Numbers
INSERT INTO user_phones (user_id, phoneno)
VALUES 
('usr-admin-01', '+91 9876543210'),
('usr-demo-01', '+91 9123456789'),
('usr-demo-02', '+91 9898989898')
ON DUPLICATE KEY UPDATE phoneno=VALUES(phoneno);

-- Insert Current Active Lost Items
INSERT INTO lost_items (lost_id, item_name, date_lost, time_lost, location_lost, description, category, color, brand, serial_number, image_url, status, user_id, contact_number, created_at)
VALUES
('lst-mv5lmcrd-q02fl', 'watch', '2026-10-12', '10:00:00', 'it room', 'nice black wrist watch', 'Documents', 'Black', 'Casio', '', 'fina.png', 'Lost', 'usr-demo-01', '+91 9123456789', '2026-10-12 18:41:48')
ON DUPLICATE KEY UPDATE item_name=VALUES(item_name);

-- ---------------------------------------------------------------------
-- 4. DATABASE RETRIEVAL QUERIES
-- ---------------------------------------------------------------------

-- QUERY 1: Retrieve All Users with Their Phone Numbers (1-to-N Join)
SELECT 
    u.user_id,
    CONCAT(u.fname, ' ', IF(u.minit != '', CONCAT(u.minit, '. '), ''), u.lname) AS full_name,
    u.clg_email,
    u.dept,
    u.role,
    u.institution,
    u.email_verified,
    p.phoneno AS contact_phone
FROM users u
LEFT JOIN user_phones p ON u.user_id = p.user_id
ORDER BY u.created_at ASC;

-- QUERY 2: Retrieve All Lost Items with Reporter Details
SELECT 
    l.lost_id,
    l.item_name,
    l.category,
    l.date_lost,
    l.time_lost,
    l.location_lost,
    l.description,
    l.color,
    l.brand,
    l.status,
    u.clg_email AS reported_by_email,
    CONCAT(u.fname, ' ', u.lname) AS reporter_name,
    l.created_at
FROM lost_items l
JOIN users u ON l.user_id = u.user_id
ORDER BY l.created_at DESC;

-- QUERY 3: Retrieve All Found Items with Finder Details
SELECT 
    f.found_id,
    f.item_name,
    f.category,
    f.date_found,
    f.time_found,
    f.location_found,
    f.storage_location,
    f.description,
    f.status,
    CONCAT(u.fname, ' ', u.lname) AS found_by,
    f.created_at
FROM found_items f
JOIN users u ON f.user_id = u.user_id
ORDER BY f.created_at DESC;

-- QUERY 4: Retrieve Dashboard Summary Statistics (Count from 0)
SELECT 
    (SELECT COUNT(*) FROM lost_items WHERE status = 'Lost') AS total_lost_reports,
    (SELECT COUNT(*) FROM found_items WHERE status = 'Available') AS total_found_reports,
    (SELECT COUNT(*) FROM claims WHERE status = 'Pending') AS pending_claims;

-- QUERY 5: Retrieve Claims with Claimant and Item Details (For Admin Review)
SELECT 
    c.claims_id,
    f.item_name AS claimed_item,
    f.category,
    f.location_found,
    c.status AS claim_status,
    c.claim_date,
    c.explanation,
    c.proof_of_ownership,
    c.review_message,
    CONCAT(u.fname, ' ', u.lname) AS claimant_name,
    u.clg_email AS claimant_email,
    p.phoneno AS claimant_phone
FROM claims c
JOIN found_items f ON c.foreign_id = f.found_id
JOIN users u ON c.user_id = u.user_id
LEFT JOIN user_phones p ON u.user_id = p.user_id
ORDER BY c.created_at DESC;

-- QUERY 6: Retrieve Possible Matches between Lost and Found Reports
SELECT 
    l.lost_id,
    l.item_name AS lost_item,
    f.found_id,
    f.item_name AS found_item,
    l.category,
    l.location_lost,
    f.location_found,
    l.date_lost,
    f.date_found
FROM lost_items l
JOIN found_items f ON l.category = f.category
WHERE l.status = 'Lost' 
  AND f.status = 'Available'
  AND (
      l.item_name LIKE CONCAT('%', f.item_name, '%')
      OR f.item_name LIKE CONCAT('%', l.item_name, '%')
      OR l.location_lost = f.location_found
  );
SHOW DATABASES;
USE traceback_db;
SHOW TABLES;
select * from claims ;
select * from found_items;
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'traceback_db'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

USE traceback_db;

SHOW CREATE TABLE claims;
