import {
    createUserRoleService,
    type UserRoleRepository,
} from "../../application/auth/user-role-service.ts";

import { supabase } from "../../lib/supabase/client.ts";
import {supabaseLibraryCampaignService} from "../library/supabase-library-campaign-service.ts";

/**
 * Existing user_profiles-backed role lookup.
 *
 * Preserve the current RLS-governed query and its
 * fail-closed behavior on database errors.
 */
export const supabaseUserRoleRepository: UserRoleRepository = {
    async isAdmin(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from("user_profiles")
            .select("user_type")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) return false;

        return data?.user_type === "admin";
    }
};

export const supabaseUserRoleService = createUserRoleService(supabaseUserRoleRepository);