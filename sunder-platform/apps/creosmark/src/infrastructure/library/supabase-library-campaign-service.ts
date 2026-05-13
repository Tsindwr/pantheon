import { createLibraryCampaignService } from "../../application/library/services.ts";
import { supabaseLibraryCampaignRepository } from "./supabase-library-campaign-repository.ts";

export const supabaseLibraryCampaignService = createLibraryCampaignService(
  supabaseLibraryCampaignRepository,
);
