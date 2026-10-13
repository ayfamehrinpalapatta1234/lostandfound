-- =====================================================================
-- TraceBack - Supabase / PostgreSQL Schema with Row Level Security (RLS)
-- Matches Relational Schema: USERS, USER_PHONES, FOUND_ITEMS, LOST_ITEMS, CLAIMS, NOTIFICATIONS
-- =====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fname VARCHAR(50) NOT NULL,
    minit VARCHAR(10) DEFAULT '',
    lname VARCHAR(50) NOT NULL,
    clg_email VARCHAR(100) UNIQUE NOT NULL,
    dept VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Student',
    password VARCHAR(255) NOT NULL,
    institution VARCHAR(150) DEFAULT 'Campus College of Engineering',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER PHONES TABLE
CREATE TABLE IF NOT EXISTS public.user_phones (
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    phoneno VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, phoneno)
);

-- 3. FOUND ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.found_items (
    found_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    status VARCHAR(30) DEFAULT 'Available',
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    contact_number VARCHAR(20) DEFAULT '',
    additional_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LOST ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.lost_items (
    lost_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    status VARCHAR(30) DEFAULT 'Lost',
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    contact_number VARCHAR(20) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.claims (
    claims_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    foreign_id UUID NOT NULL REFERENCES public.found_items(found_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'Pending',
    proof_of_ownership TEXT DEFAULT '',
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    explanation TEXT NOT NULL,
    review_message TEXT DEFAULT '',
    verified_by UUID REFERENCES public.users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    related_item_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public items are viewable by all authenticated users
CREATE POLICY "Public items are viewable by anyone" ON public.found_items FOR SELECT USING (true);
CREATE POLICY "Public lost items are viewable by anyone" ON public.lost_items FOR SELECT USING (true);

-- Users can only insert/update/delete their own reports
CREATE POLICY "Users can insert own found reports" ON public.found_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own found reports" ON public.found_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own found reports" ON public.found_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lost reports" ON public.lost_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lost reports" ON public.lost_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lost reports" ON public.lost_items FOR DELETE USING (auth.uid() = user_id);

-- Claims: Users can view their own claims or claims on items they reported
CREATE POLICY "Users can view own claims" ON public.claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own claims" ON public.claims FOR INSERT WITH CHECK (auth.uid() = user_id);
