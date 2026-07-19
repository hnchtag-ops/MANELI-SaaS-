-- 
-- MANELI™ KERNEL — SUPABASE FOUNDATION DATASHEET
-- 

-- -----------------------------------------------------------------------------
-- 1. Custom Types & Enumerations
-- -----------------------------------------------------------------------------
CREATE TYPE tenant_status AS ENUM ('STAGING', 'PROVISIONED', 'SUSPENDED');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member');

-- -----------------------------------------------------------------------------
-- 2. Master Tenants Registry Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status tenant_status NOT NULL DEFAULT 'STAGING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on core tenant records
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tenants RLS Policies
CREATE POLICY select_public_active_subdomains ON public.tenants
    FOR SELECT
    USING (status = 'PROVISIONED');

CREATE POLICY service_role_unconditional_bypass ON public.tenants
    FOR ALL
    TO service_role
    USING (true);

-- -----------------------------------------------------------------------------
-- 3. Tenant Users Mapping (Workspace Boundaries)
-- -----------------------------------------------------------------------------
CREATE TABLE public.tenant_users (
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (tenant_id, user_id)
);

-- Enable RLS on Mapping records
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Tenant Users RLS Policies
CREATE POLICY select_own_tenant_members ON public.tenant_users
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY owner_modify_tenant_members ON public.tenant_users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE tenant_users.tenant_id = tenant_users.tenant_id
              AND tenant_users.user_id = auth.uid()
              AND tenant_users.role = 'owner'
        )
    );

-- -----------------------------------------------------------------------------
-- 4. Multi-Tenant JWT Claim Injection Helper
-- -----------------------------------------------------------------------------
-- This function allows checking current tenant contexts efficiently during transactions
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS UUID AS $$
    SELECT NULLIF(
        current_setting('request.jwt.claims', true)::json->>'tenant_id',
        ''
    )::uuid;
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- 5. Automated Updated At Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_timestamp
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. User Profiles (Identity Foundation)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL, -- references auth.users(id) in full supabase environment
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY select_own_profile ON public.profiles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY update_own_profile ON public.profiles
    FOR UPDATE
    USING (user_id = auth.uid());

-- Automated Updated At Trigger for profiles
CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Workspace Architecture (Tenant-Level Segregations)
-- -----------------------------------------------------------------------------
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL, -- references auth.users(id) in full supabase environment
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspaces RLS Policies
CREATE POLICY select_my_workspaces ON public.workspaces
    FOR SELECT
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
              AND workspace_members.user_id = auth.uid()
        )
    );

CREATE POLICY insert_my_workspaces ON public.workspaces
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY update_my_workspaces ON public.workspaces
    FOR UPDATE
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
              AND workspace_members.user_id = auth.uid()
              AND workspace_members.role IN ('owner', 'admin')
        )
    );

CREATE POLICY delete_my_workspaces ON public.workspaces
    FOR DELETE
    USING (owner_id = auth.uid());

-- Automated Updated At Trigger for workspaces
CREATE TRIGGER update_workspaces_timestamp
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Membership System (Granular Role-Based Gating)
-- -----------------------------------------------------------------------------
CREATE TABLE public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL, -- references auth.users(id) in full supabase environment
    role user_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Workspace Members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace Members RLS Policies
CREATE POLICY select_workspace_members ON public.workspace_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = workspace_members.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members AS wm
            WHERE wm.workspace_id = workspace_members.workspace_id
              AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY manage_workspace_members ON public.workspace_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = workspace_members.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members AS wm
            WHERE wm.workspace_id = workspace_members.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

-- -----------------------------------------------------------------------------
-- 9. Dynamic Feature Table Placeholder (CueAudio, QuoteFlow, InvoiceFlow support)
-- -----------------------------------------------------------------------------
CREATE TABLE public.features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(100) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Features
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

-- Features RLS Policies
CREATE POLICY select_features ON public.features
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = features.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = features.workspace_id
              AND workspace_members.user_id = auth.uid()
        )
    );

CREATE POLICY manage_features ON public.features
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = features.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = features.workspace_id
              AND workspace_members.user_id = auth.uid()
              AND workspace_members.role IN ('owner', 'admin')
        )
    );

-- Automated Updated At Trigger for features
CREATE TRIGGER update_features_timestamp
    BEFORE UPDATE ON public.features
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. Subscriptions & Billing Engine (Revenue Layer)
-- -----------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    subscription_id VARCHAR(255) NOT NULL,
    plan VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions RLS Policies
CREATE POLICY select_subscriptions ON public.subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = subscriptions.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = subscriptions.workspace_id
              AND workspace_members.user_id = auth.uid()
        )
    );

CREATE POLICY manage_subscriptions ON public.subscriptions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = subscriptions.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = subscriptions.workspace_id
              AND workspace_members.user_id = auth.uid()
              AND workspace_members.role IN ('owner', 'admin')
        )
    );

-- Automated Updated At Trigger for subscriptions
CREATE TRIGGER update_subscriptions_timestamp
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Billing Events
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Billing Events RLS Policies
CREATE POLICY select_billing_events ON public.billing_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = billing_events.workspace_id
              AND workspaces.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = billing_events.workspace_id
              AND workspace_members.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 11. Tracks Architecture (CueAudio Blueprint Module)
-- -----------------------------------------------------------------------------
CREATE TABLE public.tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_url TEXT,
    audio_url TEXT,
    price NUMERIC,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on tracks
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Tracks RLS Policies allowing read/write ONLY if matching active workspace context
CREATE POLICY select_my_workspace_tracks ON public.tracks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = tracks.workspace_id
              AND (
                  workspaces.owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.workspace_members
                      WHERE workspace_members.workspace_id = workspaces.id
                        AND workspace_members.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY insert_my_workspace_tracks ON public.tracks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = tracks.workspace_id
              AND (
                  workspaces.owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.workspace_members
                      WHERE workspace_members.workspace_id = workspaces.id
                        AND workspace_members.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY update_my_workspace_tracks ON public.tracks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = tracks.workspace_id
              AND (
                  workspaces.owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.workspace_members
                      WHERE workspace_members.workspace_id = workspaces.id
                        AND workspace_members.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY delete_my_workspace_tracks ON public.tracks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE workspaces.id = tracks.workspace_id
              AND (
                  workspaces.owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.workspace_members
                      WHERE workspace_members.workspace_id = workspaces.id
                        AND workspace_members.user_id = auth.uid()
                  )
              )
        )
    );

-- Automated Updated At Trigger for tracks
CREATE TRIGGER update_tracks_timestamp
    BEFORE UPDATE ON public.tracks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();



